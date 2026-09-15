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

  async preview(companyId: string, year: number) {
    const config = await this.getConfig(companyId);

    const periodStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31`;

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

  async confirmar(companyId: string, userId: string, year: number) {
    const prev = await this.preview(companyId, year);

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
    const closingDate = `${year}-12-31`;

    const areId = config.encerramentoContaApuracaoResultadoId!;
    const areAccount = await this.prisma.chartOfAccounts.findUnique({ where: { id: areId } });
    if (!areAccount) throw new BadRequestException('Conta de Apuração do Resultado do Exercício configurada não foi encontrada.');

    const destinoId =
      prev.resultadoTipo === 'LUCRO'
        ? config.encerramentoContaLucroExercicioId!
        : config.encerramentoContaPrejuizoExercicioId!;
    const destinoAccount = await this.prisma.chartOfAccounts.findUnique({ where: { id: destinoId } });
    if (!destinoAccount) throw new BadRequestException('Conta de Lucro/Prejuízo do Exercício configurada não foi encontrada.');

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

    const entry1 = await this.journalEntryService.create(companyId, userId, {
      date: closingDate,
      description: `Encerramento do Exercício ${year} - Apuração do Resultado (Etapa 1/2)`,
      items: itemsEtapa1,
    });

    // Etapa 2: zera a ARE contra Lucro ou Prejuízo do Exercício
    const entry2 = await this.journalEntryService.create(companyId, userId, {
      date: closingDate,
      description: `Encerramento do Exercício ${year} - Transferência do Resultado (Etapa 2/2)`,
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
      where: { id: { in: [entry1.id, entry2.id] } },
      data: { isClosingEntry: true },
    });

    return { entry1, entry2, resultado: prev.resultado, resultadoTipo: prev.resultadoTipo };
  }

  // ── Reverte (soft-delete) o encerramento ja gravado de um exercicio ─────────

  async reverter(companyId: string, year: number) {
    const periodEnd = `${year}-12-31`;
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

    await this.prisma.journalEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { deletedAt: new Date() },
    });

    return { revertido: true, lancamentosRevertidos: entries.length };
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

      return {
        year,
        status: encerramento ? 'ENCERRADO' : 'ABERTO',
        totalAtivo: Math.abs(ativoRaw),
        totalPassivoPL: Math.abs(passivoRaw + plRaw),
        resultado,
        diferenca: diferencaApurada,
        equilibrado: Math.abs(diferencaApurada) < 0.01,
      };
    }));

    return resultado.sort((a, b) => b.year - a.year);
  }
}
