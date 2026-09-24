// apps/api/src/modules/accounting/services/encerramento-exercicio.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { JournalEntryService } from './journal-entry.service';
import { TrialBalanceService } from './trial-balance.service';

interface ResultAccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  saldo: string;
}

@Injectable()
export class EncerramentoExercicioService {
  constructor(
    private prisma: PrismaService,
    private journalEntryService: JournalEntryService,
    private trialBalance: TrialBalanceService,
  ) {}

  private toUTC(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private toUTCEnd(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }

  private async getConfig(companyId: string) {
    const config = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    if (!config) {
      throw new BadRequestException(
        'Configuração contábil da empresa não encontrada. Configure as contas de Encerramento de Exercício na aba Contábil antes de prosseguir.',
      );
    }
    return config;
  }

  // ── Prévia: calcula o resultado do período sem gravar nada ──────────────────

  // NOVO (18/09/2026): closingDateOverride permite um balanco intermediario
  // (ex: 30/06) em vez de forcar sempre 31/12 - period sempre comeca em 1o
  // de janeiro do "year" informado, so a data final fica flexivel. Grava
  // zeragem contabil de verdade, igual o encerramento anual (decisao do
  // usuario 18/09/2026).
  async preview(companyId: string, year: number, closingDateOverride?: string) {
    const config = await this.getConfig(companyId);

    const periodStart = `${year}-01-01`;
    const periodEnd = closingDateOverride || `${year}-12-31`;

    const rows = await this.prisma.$queryRaw<ResultAccountRow[]>`
      SELECT coa.id, coa.code, coa.name, coa.type,
        SUM(CASE WHEN jei.type='DEBIT' THEN jei.value ELSE -jei.value END) as saldo
      FROM chart_of_accounts coa
      JOIN journal_entry_items jei ON jei.account_id = coa.id
      JOIN journal_entries je ON je.id = jei.journal_entry_id
      WHERE coa.company_id = ${companyId}::uuid
        AND coa.type IN ('REVENUE','EXPENSE')
        AND coa.is_analytic = true
        AND coa.deleted_at IS NULL
        AND je.date BETWEEN ${periodStart}::date AND ${periodEnd}::date
        AND je.deleted_at IS NULL
      GROUP BY coa.id, coa.code, coa.name, coa.type
      HAVING SUM(CASE WHEN jei.type='DEBIT' THEN jei.value ELSE -jei.value END) != 0
      ORDER BY coa.type, coa.code
    `;

    let totalDebito = 0;
    let totalCredito = 0;
    const accounts = rows.map((r) => {
      const saldo = Number(r.saldo);
      const zeragemTipo: 'DEBIT' | 'CREDIT' = saldo < 0 ? 'DEBIT' : 'CREDIT';
      const zeragemValor = Math.abs(saldo);
      if (zeragemTipo === 'DEBIT') totalDebito += zeragemValor;
      else totalCredito += zeragemValor;
      return { id: r.id, code: r.code, name: r.name, type: r.type, saldo, zeragemTipo, zeragemValor };
    });

    const resultadoBruto = totalDebito - totalCredito; // positivo = lucro
    const resultadoTipo: 'LUCRO' | 'PREJUIZO' | 'NEUTRO' =
      resultadoBruto > 0 ? 'LUCRO' : resultadoBruto < 0 ? 'PREJUIZO' : 'NEUTRO';
    const resultado = Math.abs(resultadoBruto);

    const missingConfig: string[] = [];
    if (!config.encerramentoContaApuracaoResultadoId) missingConfig.push('Apuração do Resultado do Exercício (ARE)');
    if (resultadoTipo === 'LUCRO' && !config.encerramentoContaLucroExercicioId) missingConfig.push('Lucro do Exercício');
    if (resultadoTipo === 'PREJUIZO' && !config.encerramentoContaPrejuizoExercicioId) missingConfig.push('Prejuízo do Exercício');

    // CORRIGIDO 23/08/2026: description-match trocado por isClosingEntry (campo
    // estruturado) - texto era fragil e ja se repetia em 8 lugares do codigo.
    const existing = await this.prisma.journalEntry.findFirst({
      where: {
        companyId,
        date: { gte: this.toUTC(periodEnd), lte: this.toUTCEnd(periodEnd) },
        isClosingEntry: true,
        deletedAt: null,
      },
    });

    return {
      year,
      closingDate: periodEnd,
      accounts,
      totalDebito,
      totalCredito,
      resultado,
      resultadoTipo,
      missingConfig,
      podeEncerrar: missingConfig.length === 0 && accounts.length > 0 && !existing,
      jaEncerrado: !!existing,
    };
  }

  // ── Confirma: grava o encerramento em 2 etapas (Receita/Despesa → ARE → Lucro/Prejuízo) ──

  // NOVO 20/09/2026: confirmar/reverter da MESMA empresa passam a rodar um de cada vez. Advisory lock do
  // Postgres (pg_advisory_xact_lock) preso por uma transacao longa - so segura o lock; as gravacoes usam o
  // proprio prisma e ja estao commitadas quando o proximo entra. Dentro da trava a checagem "ja encerrado"
  // enxerga o que a requisicao anterior gravou (antes, cliques repetidos/timeouts geravam varios pares de
  // encerramento para a mesma data). Trava por empresa (e nao por data) porque a cascata mexe em outras datas.
  private async comTrava<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'encerramento:' + companyId}))`;
      return fn();
    }, { maxWait: 120000, timeout: 300000 });
  }

  async confirmar(companyId: string, userId: string, year: number, closingDateOverride?: string) {
    return this.comTrava(companyId, () => this.confirmarSemTrava(companyId, userId, year, closingDateOverride));
  }

  private async confirmarSemTrava(companyId: string, userId: string, year: number, closingDateOverride?: string) {
    const prev = await this.preview(companyId, year, closingDateOverride);

    if (prev.jaEncerrado) {
      throw new BadRequestException(`O exercício ${year} já possui lançamento de encerramento.`);
    }
    if (prev.missingConfig.length > 0) {
      throw new BadRequestException(`Configure antes de encerrar: ${prev.missingConfig.join(', ')}.`);
    }
    if (prev.accounts.length === 0) {
      throw new BadRequestException('Nenhuma conta de resultado com movimento no período informado.');
    }

    const config = await this.getConfig(companyId);
    const closingDate = prev.closingDate;

    const areId = config.encerramentoContaApuracaoResultadoId!;
    const areAccount = await this.prisma.chartOfAccounts.findUnique({ where: { id: areId } });
    if (!areAccount) throw new BadRequestException('Conta de Apuração do Resultado do Exercício configurada não foi encontrada.');

    const destinoId =
      prev.resultadoTipo === 'LUCRO'
        ? config.encerramentoContaLucroExercicioId!
        : config.encerramentoContaPrejuizoExercicioId!;
    const destinoAccount = await this.prisma.chartOfAccounts.findUnique({ where: { id: destinoId } });
    if (!destinoAccount) throw new BadRequestException('Conta de Lucro/Prejuízo do Exercício configurada não foi encontrada.');

    // NOVO 23/09/2026: antes de lançar o resultado deste ano, reclassifica o
    // saldo que Lucro/Prejuízo do Exercício carregava dos anos ANTERIORES
    // (essa conta nunca era zerada entre um encerramento e outro - acumulava
    // o resultado de todos os anos misturado com o do ano corrente, achado
    // real na Sunsys: 8 encerramentos somados na mesma conta) para as contas
    // de Lucros/Prejuízos Acumulados (saldo anterior) já previstas no schema
    // e na aba Contábil, mas nunca usadas aqui. Só roda quando há saldo de
    // fato a mover (primeiro encerramento de sempre não move nada). Falha
    // ANTES de gravar qualquer coisa se faltar configurar as contas.
    const dataAnoAnterior = `${year - 1}-12-31`;
    const antes = await this.trialBalance.getVerificationBalance(
      companyId, this.toUTC(dataAnoAnterior), this.toUTCEnd(dataAnoAnterior),
    );
    const saldoAntesMap = new Map<string, number>(
      (antes.balances as any[]).map((b) => [b.account.id, b.currentBalance]),
    );
    const idsRelacionados = [
      config.encerramentoContaLucroExercicioId,
      config.encerramentoContaPrejuizoExercicioId,
      config.encerramentoContaLucrosAcumuladosId,
      config.encerramentoContaPrejuizosAcumuladosId,
    ].filter((id): id is string => !!id);
    const contasRelacionadas = await this.prisma.chartOfAccounts.findMany({ where: { id: { in: idsRelacionados } } });
    const codeById = new Map(contasRelacionadas.map((c) => [c.id, c.code]));

    const itemsReclassificacao: { accountId: string; accountCode: string; value: number; type: 'DEBIT' | 'CREDIT' }[] = [];
    const missingAcumulados: string[] = [];

    const montarReclassificacao = (
      contaExercicioId: string | null,
      contaAcumuladosId: string | null,
      rotuloAcumulados: string,
    ) => {
      if (!contaExercicioId) return;
      const saldo = saldoAntesMap.get(contaExercicioId) ?? 0;
      if (Math.abs(saldo) < 0.01) return;
      if (!contaAcumuladosId || !codeById.has(contaAcumuladosId)) {
        missingAcumulados.push(rotuloAcumulados);
        return;
      }
      const tipoZeragem: 'DEBIT' | 'CREDIT' = saldo > 0 ? 'CREDIT' : 'DEBIT';
      const tipoDestino: 'DEBIT' | 'CREDIT' = saldo > 0 ? 'DEBIT' : 'CREDIT';
      itemsReclassificacao.push(
        { accountId: contaExercicioId, accountCode: codeById.get(contaExercicioId)!, value: Math.abs(saldo), type: tipoZeragem },
        { accountId: contaAcumuladosId, accountCode: codeById.get(contaAcumuladosId)!, value: Math.abs(saldo), type: tipoDestino },
      );
    };

    montarReclassificacao(
      config.encerramentoContaLucroExercicioId,
      config.encerramentoContaLucrosAcumuladosId,
      'Lucros Acumulados (saldo anterior)',
    );
    montarReclassificacao(
      config.encerramentoContaPrejuizoExercicioId,
      config.encerramentoContaPrejuizosAcumuladosId,
      'Prejuízos Acumulados (saldo anterior)',
    );

    if (missingAcumulados.length > 0) {
      throw new BadRequestException(
        `Configure antes de encerrar (reclassificação do resultado acumulado de anos anteriores): ${missingAcumulados.join(', ')}.`,
      );
    }

    // Etapa 1: zera cada conta de Receita/Despesa contra a ARE
    const itemsEtapa1 = prev.accounts.map((a) => ({
      accountId: a.id,
      accountCode: a.code,
      value: a.zeragemValor,
      type: a.zeragemTipo,
    }));
    itemsEtapa1.push({
      accountId: areId,
      accountCode: areAccount.code,
      value: prev.resultado,
      type: prev.resultadoTipo === 'LUCRO' ? 'CREDIT' : 'DEBIT',
    });

    // CORRIGIDO (17/09/2026): journalEntryService.create() so passou a
    // aceitar sourceModule hoje - antes gravava 'ACCOUNTING' fixo pra
    // QUALQUER chamador, entao todo encerramento aparecia como "Manual"
    // no Diario/Balancete/Comparativo de Saldos, mesmo sendo gerado pelo
    // proprio sistema. Usa RESULT_TRANSFER (label ja existente:
    // "Transferencia de Resultado").
    // NOVO 20/09/2026: se qualquer etapa abaixo falhar (2o lancamento, marcacao ou cascata), o que ja foi
    // gravado e desfeito (soft-delete) - evita lancamento "Etapa 1/2" orfao e encerramento pela metade.
    let entry0: any = null;
    let entry1: any = null;
    let entry2: any = null;
    try {
    if (itemsReclassificacao.length > 0) {
      entry0 = await this.journalEntryService.create(companyId, userId, {
        date: closingDate,
        description: `Encerramento do Exercício ${year} (${closingDate}) - Reclassificação do Resultado Acumulado de Anos Anteriores (Etapa 1/3)`,
        items: itemsReclassificacao,
        sourceModule: 'RESULT_TRANSFER',
      });
    }
    entry1 = await this.journalEntryService.create(companyId, userId, {
      date: closingDate,
      description: `Encerramento do Exercício ${year} (${closingDate}) - Apuração do Resultado (Etapa 1/2)`,
      items: itemsEtapa1,
      sourceModule: 'RESULT_TRANSFER',
    });

    // Etapa 2: zera a ARE contra Lucro ou Prejuízo do Exercício
    entry2 = await this.journalEntryService.create(companyId, userId, {
      date: closingDate,
      description: `Encerramento do Exercício ${year} (${closingDate}) - Transferência do Resultado (Etapa 2/2)`,
      sourceModule: 'RESULT_TRANSFER',
      items: [
        {
          accountId: areId,
          accountCode: areAccount.code,
          value: prev.resultado,
          type: prev.resultadoTipo === 'LUCRO' ? 'DEBIT' : 'CREDIT',
        },
        {
          accountId: destinoId,
          accountCode: destinoAccount.code,
          value: prev.resultado,
          type: prev.resultadoTipo === 'LUCRO' ? 'CREDIT' : 'DEBIT',
        },
      ],
    });

    // CRIADO 23/08/2026: marca os 2 lancamentos como encerramento via campo
    // estruturado, em vez de depender so do texto da description (que continua
    // existindo para leitura humana, mas nao e mais a fonte de verdade).
    await this.prisma.journalEntry.updateMany({
      where: { id: { in: [entry0?.id, entry1.id, entry2.id].filter(Boolean) } },
      data: { isClosingEntry: true },
    });

    // NOVO (16/09/2026): a data de encerramento de um ano nunca pode ser
    // anterior a de um ano posterior ja encerrado - o resultado acumulado
    // deste exercicio muda o que os anos seguintes ja tinham fechado.
    // Reabre (soft-delete do lancamento de encerramento) qualquer ano
    // POSTERIOR a este que ja estivesse encerrado, em cascata.
    const encerramentosPosteriores = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        isClosingEntry: true,
        deletedAt: null,
        date: { gt: this.toUTCEnd(closingDate) },
      },
      select: { id: true, date: true },
    });

    let anosReabertos: number[] = [];
    if (encerramentosPosteriores.length > 0) {
      anosReabertos = Array.from(new Set(encerramentosPosteriores.map((e) => e.date.getUTCFullYear()))).sort((a, b) => a - b);
      await this.prisma.journalEntry.updateMany({
        where: { id: { in: encerramentosPosteriores.map((e) => e.id) } },
        data: { deletedAt: new Date() },
      });
    }

    return { entry0, entry1, entry2, resultado: prev.resultado, resultadoTipo: prev.resultadoTipo, anosReabertos };
    } catch (e) {
      const ids = [entry0?.id, entry1?.id, entry2?.id].filter(Boolean) as string[];
      if (ids.length > 0) {
        try {
          await this.prisma.journalEntry.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
        } catch { /* mantem o erro original */ }
      }
      throw e;
    }
  }

  // ── Reverte (soft-delete) o encerramento ja gravado de um exercicio ─────────

  async reverter(companyId: string, year: number, closingDateOverride?: string) {
    return this.comTrava(companyId, () => this.reverterSemTrava(companyId, year, closingDateOverride));
  }

  private async reverterSemTrava(companyId: string, year: number, closingDateOverride?: string) {
    const periodEnd = closingDateOverride || `${year}-12-31`;
    // CORRIGIDO 23/08/2026: description-match trocado por isClosingEntry.
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        date: { gte: this.toUTC(periodEnd), lte: this.toUTCEnd(periodEnd) },
        isClosingEntry: true,
        deletedAt: null,
      },
    });

    if (entries.length === 0) {
      throw new BadRequestException(`Não há lançamento de encerramento gravado para o exercício ${year}.`);
    }

    // NOVO (20/09/2026): mesma regra do confirmar() - o acumulado dos anos
    // seguintes depende deste fechamento, entao reverter uma data invalida
    // TODOS os encerramentos POSTERIORES a ela. Reverte em cascata, no mesmo
    // updateMany (atomico).
    const posteriores = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        isClosingEntry: true,
        deletedAt: null,
        date: { gt: this.toUTCEnd(periodEnd) },
      },
      select: { id: true, date: true },
    });

    await this.prisma.journalEntry.updateMany({
      where: { id: { in: [...entries.map((e) => e.id), ...posteriores.map((e) => e.id)] } },
      data: { deletedAt: new Date() },
    });

    const datasPosterioresRevertidas = Array.from(new Set(posteriores.map((e) => e.date.toISOString().slice(0, 10)))).sort();
    const anosReabertos = Array.from(new Set(posteriores.map((e) => e.date.getUTCFullYear()))).sort((a, b) => a - b);

    return {
      revertido: true,
      lancamentosRevertidos: entries.length + posteriores.length,
      datasPosterioresRevertidas,
      anosReabertos,
    };
  }

  // CRIADO 15/09/2026: lista todos os exercicios com movimento contabil,
  // status de encerramento (isClosingEntry) e situacao patrimonial
  // (Ativo x Passivo+PL) na data-base 31/12 de cada ano - usado pela tela
  // "Encerramento de Exercicios". Mesma logica de equilibrio ja usada em
  // BalancoPatrimonialPage.tsx (soma currentBalance de contas nivel 1: ASSET
  // vs abs(LIABILITY+EQUITY)) - reaproveitada aqui para nao divergir.
  async listarExercicios(companyId: string) {
    const anos = await this.prisma.$queryRaw<{ year: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM date)::int as year
      FROM journal_entries
      WHERE company_id = ${companyId}::uuid AND deleted_at IS NULL
      ORDER BY year DESC
    `;

    const beginning = new Date(Date.UTC(1900, 0, 1));

    const resultado = await Promise.all(anos.map(async ({ year }) => {
      const periodStart = `${year}-01-01`;
      const periodEnd = `${year}-12-31`;

      const encerramento = await this.prisma.journalEntry.findFirst({
        where: {
          companyId,
          date: { gte: this.toUTC(periodEnd), lte: this.toUTCEnd(periodEnd) },
          isClosingEntry: true,
          deletedAt: null,
        },
      });

      const { balances } = await this.trialBalance.getVerificationBalance(
        companyId, beginning, this.toUTCEnd(periodEnd),
      );

      // CORRIGIDO 15/09/2026: reaproveita EXATAMENTE a formula ja validada do
      // ClosingPanel (TrialBalanceView.tsx) - soma SEMPRE com o sinal contabil
      // original (nunca Math.abs() por classe antes de somar - mesmo bug ja
      // documentado e corrigido ali em 21/08/2026) e INCLUI Receita/Despesa no
      // calculo do equilibrio, nao so Ativo x Passivo+PL. Sem isso, todo ano
      // com Resultado do Exercicio ainda nao fechado numa conta de PL mostrava
      // "diferenca" mesmo estando corretamente encerrado.
      let ativoRaw = 0, passivoRaw = 0, plRaw = 0, receitaRaw = 0, despesaRaw = 0;
      for (const b of balances as any[]) {
        const acc = b.account;
        if (acc.level !== 1) continue;
        if (acc.type === 'ASSET') ativoRaw += b.currentBalance;
        else if (acc.type === 'LIABILITY') passivoRaw += b.currentBalance;
        else if (acc.type === 'EQUITY') plRaw += b.currentBalance;
        else if (acc.type === 'REVENUE') receitaRaw += b.currentBalance;
        else if (acc.type === 'EXPENSE') despesaRaw += b.currentBalance;
      }
      const diferencaApurada = ativoRaw + passivoRaw + plRaw + (receitaRaw + despesaRaw);

      // CORRIGIDO 15/09/2026: currentBalance de getVerificationBalance e SEMPRE
      // cumulativo desde o inicio (saldoAnterior + movimento do periodo = saldo
      // final, independente do startDate escolhido) - nao serve para isolar o
      // resultado DE UM ANO especifico. Precisa de uma segunda chamada travada
      // no intervalo 01/01-31/12 daquele ano, usando os campos debits/credits
      // (movimento REAL do periodo, nao o saldo acumulado), com excludeClosing
      // =true - mesmo parametro/motivo ja usado no DRE (movimento bruto real,
      // sem a reclassificacao do proprio lancamento de encerramento).
      const { balances: balancesAno } = await this.trialBalance.getVerificationBalance(
        companyId, this.toUTC(periodStart), this.toUTCEnd(periodEnd), true,
      );
      let receitaAno = 0, despesaAno = 0;
      for (const b of balancesAno as any[]) {
        const acc = b.account;
        if (acc.level !== 1) continue;
        const movimento = b.debits - b.credits;
        if (acc.type === 'REVENUE') receitaAno += movimento;
        else if (acc.type === 'EXPENSE') despesaAno += movimento;
      }
      const resultado = -(receitaAno + despesaAno);

      // NOVO (18/09/2026): inclui todos os fechamentos ja gravados nesse ano
      // (anual + intermediarios) - pedido do usuario pra ver/gerenciar tudo
      // direto na lista, sem precisar abrir o modal pra descobrir.
      const fechamentos = await this.listarFechamentosDoAno(companyId, year);

      return {
        year,
        status: encerramento ? 'ENCERRADO' : 'ABERTO',
        closedAt: encerramento?.createdAt.toISOString() ?? null,
        totalAtivo: Math.abs(ativoRaw),
        totalPassivoPL: Math.abs(passivoRaw + plRaw),
        resultado,
        diferenca: diferencaApurada,
        equilibrado: Math.abs(diferencaApurada) < 0.01,
        fechamentos,
      };
    }));

    return resultado.sort((a, b) => b.year - a.year);
  }

  // NOVO (18/09/2026): lista TODOS os fechamentos ja gravados num ano
  // (anual em 31/12 + eventuais balancos intermediarios em outras datas) -
  // agrupa os 2 lancamentos de cada fechamento (Etapa 1/2) pela data, e
  // extrai o resultado/tipo lendo o valor lancado na conta de Lucro ou
  // Prejuizo do Exercicio configurada (nao recalcula, le o que foi
  // efetivamente gravado).
  async listarFechamentosDoAno(companyId: string, year: number) {
    const config = await this.getConfig(companyId);
    const periodStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31`;

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        isClosingEntry: true,
        deletedAt: null,
        date: { gte: this.toUTC(periodStart), lte: this.toUTCEnd(periodEnd) },
      },
      include: { items: true },
      orderBy: { date: 'asc' },
    });

    const porData = new Map<string, { date: string; resultado: number; resultadoTipo: 'LUCRO' | 'PREJUIZO' | 'NEUTRO' }>();
    for (const e of entries) {
      const dataISO = e.date.toISOString().slice(0, 10);
      if (!porData.has(dataISO)) porData.set(dataISO, { date: dataISO, resultado: 0, resultadoTipo: 'NEUTRO' });
      const g = porData.get(dataISO)!;
      for (const item of e.items) {
        if (item.accountId === config.encerramentoContaLucroExercicioId) {
          g.resultado = Number(item.value);
          g.resultadoTipo = 'LUCRO';
        } else if (item.accountId === config.encerramentoContaPrejuizoExercicioId) {
          g.resultado = Number(item.value);
          g.resultadoTipo = 'PREJUIZO';
        }
      }
    }

    return Array.from(porData.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
}
