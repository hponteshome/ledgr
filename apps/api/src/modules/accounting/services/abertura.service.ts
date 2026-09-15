// apps/api/src/modules/accounting/services/abertura.service.ts
// CRIADO 27/08/2026: Lancamentos de Abertura - converte saldos finais
// analiticos da ECD (data de fechamento) para as contas do Plano Matriz
// (data de abertura), usando o de/para ja existente (ecd_account_mappings).
// Reaproveita a mesma logica ja validada manualmente para a abertura 2018
// da Hotelsys.
//
// CORRIGIDO 15/09/2026: a dedupe por valor identico (premissa original:
// "mesmo saldo = mesma conta reimportada em anos diferentes, nao somar
// duas vezes") foi REMOVIDA. Investigacao real na Hotelsys (9 anos de ECD,
// 2017-2025) mostrou que a premissa e falsa quando ha arvores ECD
// paralelas/redundantes: contas de nomes iguais em anos diferentes
// (ex: "PREJUIZOS ACUMULADOS", "CAPITAL SUBSCRITO") sao linhas REAIS e
// INDEPENDENTES de chart_of_accounts, cada uma com seu proprio saldo
// declarado em 31/12/2017 - nao duplicatas de importacao. Somar TUDO sem
// excluir nada fechou em R$0,00 exatos; a dedupe estava descartando
// R$14.744.899,07 em lancamentos legitimos. A protecao contra duplicacao
// REAL (bug de importacao) continua existindo via o check de 'diferenca'
// em registrarAbertura() - se algo de fato duplicar incorretamente, o
// lancamento nao fecha e fica bloqueado, como deve ser.
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AberturaLinha {
  targetAccountId: string;
  targetCode: string;
  targetName: string;
  targetType: string;
  isAnalytic: boolean;
  saldo: number;
  debito: number;
  credito: number;
  origens: { code: string; name: string; balance: number; possivelDuplicata?: boolean }[];
}

export interface AberturaCalculo {
  linhas: AberturaLinha[];
  totalDebito: number;
  totalCredito: number;
  diferenca: number;
  contasNaoAnaliticas: { code: string; name: string }[];
}

@Injectable()
export class AberturaService {
  constructor(private prisma: PrismaService) {}

  async calcularAbertura(companyId: string, dataFechamentoISO: string): Promise<AberturaCalculo> {
    const inicio = new Date(dataFechamentoISO + 'T00:00:00Z');
    const fim = new Date(dataFechamentoISO + 'T23:59:59Z');

    // CORRIGIDO 15/09/2026: restringe as origens ao LOTE de importacao ECD
    // cujo period_end bate com a data de fechamento escolhida. Achado real
    // na Hotelsys: cada ano de ECD cria contas NOVAS em chart_of_accounts
    // (arvores ECD paralelas, nunca reaproveita a conta do ano anterior) e
    // cada uma delas declara seu proprio account_balance na MESMA data de
    // referencia (o ECD de um ano sempre redeclara o comparativo do ano
    // anterior sob suas proprias contas - pratica normal do SPED). Sem esse
    // filtro, uma conta como "Edificios e Benfeitorias" era somada uma vez
    // POR ANO de ECD que redeclarava o mesmo saldo (9x na Hotelsys, 2017 a
    // 2025), multiplicando o valor real do imobilizado. A tentativa anterior
    // (dedupe por valor identico) foi removida por ser uma premissa falsa
    // em outro sentido: contas REALMENTE diferentes, consolidadas de
    // origens distintas no mesmo destino, podem legitimamente ter o mesmo
    // valor - a duplicacao real esta em QUAL LOTE a origem pertence, nao no
    // valor do saldo.
    const lotes = await this.prisma.ecdImport.findMany({
      where: { companyId, periodEnd: new Date(dataFechamentoISO + 'T00:00:00Z'), deletedAt: null },
      select: { id: true },
    });
    if (lotes.length === 0) {
      throw new BadRequestException(
        `Nenhum lote de importação ECD encontrado com data de fechamento ${dataFechamentoISO}. Confira a data ou importe o ECD correspondente antes de calcular a abertura.`,
      );
    }
    const loteIds = lotes.map(l => l.id);

    const mappings = await this.prisma.ecdAccountMapping.findMany({
      where: {
        companyId,
        sourceAccount: { ecdImportLinks: { some: { ecdImportId: { in: loteIds } } } },
      },
      include: {
        sourceAccount: { select: { id: true, code: true, name: true } },
        targetAccount: { select: { id: true, code: true, name: true, type: true, isAnalytic: true } },
      },
    });

    const sourceIds = mappings.map(m => m.sourceAccountId);
    const balances = await this.prisma.accountBalance.findMany({
      where: { accountId: { in: sourceIds }, referenceDate: { gte: inicio, lte: fim } },
    });
    const balMap = new Map<string, number>(balances.map(b => [b.accountId, Number(b.balance)]));

    const porTarget = new Map<string, { target: any; origens: { code: string; name: string; balance: number }[] }>();
    for (const m of mappings) {
      const bal = balMap.get(m.sourceAccountId);
      if (bal === undefined || bal === 0) continue;
      const key = m.targetAccountId;
      if (!porTarget.has(key)) porTarget.set(key, { target: m.targetAccount, origens: [] });
      porTarget.get(key)!.origens.push({ code: m.sourceAccount.code, name: m.sourceAccount.name, balance: bal });
    }

    const resultado: AberturaLinha[] = [];
    for (const [targetId, { target, origens }] of porTarget) {
      // Soma TODAS as origens - sem dedupe por valor (ver nota acima).
      let soma = 0;
      for (const o of origens) {
        soma += Math.round(o.balance * 100) / 100;
      }
      soma = Math.round(soma * 100) / 100;
      if (soma === 0) continue;

      // Sinaliza (sem excluir) origens com valor identico no mesmo destino -
      // pura visibilidade para revisao humana antes de registrar. Coincidencia
      // de valor entre contas de consolidacoes diferentes e normal (ver nota
      // acima) - isto NUNCA remove nada da soma, so avisa na tela.
      const contagemPorValor = new Map<number, number>();
      for (const o of origens) {
        const chave = Math.round(o.balance * 100) / 100;
        contagemPorValor.set(chave, (contagemPorValor.get(chave) ?? 0) + 1);
      }
      const origensComAviso = origens.map(o => ({
        ...o,
        possivelDuplicata: (contagemPorValor.get(Math.round(o.balance * 100) / 100) ?? 0) > 1,
      }));

      resultado.push({
        targetAccountId: targetId,
        targetCode: target.code,
        targetName: target.name,
        targetType: target.type,
        isAnalytic: target.isAnalytic,
        saldo: soma,
        debito: soma > 0 ? soma : 0,
        credito: soma < 0 ? -soma : 0,
        origens: origensComAviso,
      });
    }

    resultado.sort((a, b) => a.targetCode.localeCompare(b.targetCode));

    const totalDebito = Math.round(resultado.reduce((s, r) => s + r.debito, 0) * 100) / 100;
    const totalCredito = Math.round(resultado.reduce((s, r) => s + r.credito, 0) * 100) / 100;

    return {
      linhas: resultado,
      totalDebito,
      totalCredito,
      diferenca: Math.round((totalDebito - totalCredito) * 100) / 100,
      contasNaoAnaliticas: resultado.filter(r => !r.isAnalytic).map(r => ({ code: r.targetCode, name: r.targetName })),
    };
  }

  async registrarAbertura(
    companyId: string, dataFechamentoISO: string, dataAberturaISO: string,
    referencia: string, userId: string,
  ) {
    const calculo = await this.calcularAbertura(companyId, dataFechamentoISO);

    if (calculo.contasNaoAnaliticas.length > 0) {
      throw new BadRequestException(
        `Existem ${calculo.contasNaoAnaliticas.length} conta(s) sintética(s) com saldo - crie contas analíticas antes de registrar: ${calculo.contasNaoAnaliticas.map(c => c.code).join(', ')}`,
      );
    }
    if (Math.abs(calculo.diferenca) > 0.01) {
      throw new BadRequestException(`Lançamento não fecha - diferença de ${calculo.diferenca.toFixed(2)}.`);
    }
    if (calculo.linhas.length === 0) {
      throw new BadRequestException('Nenhuma linha calculada - verifique o de/para (ecd_account_mappings) e os saldos na data de fechamento.');
    }

    const dataAbertura = new Date(dataAberturaISO + 'T12:00:00Z');

    // CORRIGIDO 31/08/2026: registrarAbertura() nao verificava se ja existia
    // uma abertura com a MESMA referencia antes de criar outra - cada clique
    // em "Registrar" so somava mais uma entrada, causando dupla (ou tripla)
    // contagem. Achado real na Sunrise: apos remapear o de/para e re-registrar,
    // 2 lancamentos "ABERTURA-2018" coexistiram, dobrando varias contas no
    // Balancete. Corrigido: apaga qualquer lancamento com a MESMA referencia
    // para esta empresa antes de criar o novo - re-registrar sempre SUBSTITUI,
    // nunca soma.
    const entriesAntigas = await this.prisma.journalEntry.findMany({
      where: { companyId, reference: referencia },
      select: { id: true },
    });
    if (entriesAntigas.length > 0) {
      const idsAntigos = entriesAntigas.map(e => e.id);
      await this.prisma.journalEntryItem.deleteMany({ where: { journalEntryId: { in: idsAntigos } } });
      await this.prisma.journalEntry.deleteMany({ where: { id: { in: idsAntigos } } });
    }

    const entry = await this.prisma.journalEntry.create({
      data: {
        companyId,
        date: dataAbertura,
        description: `Lançamento de Abertura ${referencia}`,
        reference: referencia,
        createdById: userId,
        items: {
          create: calculo.linhas.map(l => ({
            accountId: l.targetAccountId,
            value: l.saldo > 0 ? l.saldo : -l.saldo,
            type: l.saldo > 0 ? 'DEBIT' : 'CREDIT',
          })),
        },
      },
    });

    return { journalEntryId: entry.id, totalItens: calculo.linhas.length, totalDebito: calculo.totalDebito, totalCredito: calculo.totalCredito };
  }
}
