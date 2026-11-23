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
//
// ALTERADO 23/11/2026 (ABERTURA-01, achado na Jose Silva):
// 1. Lote de origem: sem lote ECD terminando na data de fechamento, usa o
//    lote que COMECA no dia seguinte (o saldo inicial declarado nele). A Jose
//    Silva nao tem ECD 2023; os saldos de 31/12/2023 vieram da ECD 2024.
// 2. Modo DIRETO: empresa sem nenhuma linha de de/para usa a propria conta
//    como destino (ECD importada direto no plano, sem arvore paralela).
// 3. Registrar de novo exclui o lancamento anterior de forma LOGICA
//    (deletedAt), nunca fisica.
// 4. Recusa registrar em competencia fechada (FECHADO / FECHADO_PREVIO).
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
  modo: 'DE_PARA' | 'DIRETO';
  loteOrigem: 'FIM_DO_PERIODO' | 'SALDO_INICIAL';
}

type ContaDestino = { id: string; code: string; name: string; type: any; isAnalytic: boolean };
type ParOrigemDestino = {
  sourceAccountId: string;
  source: { code: string; name: string };
  targetAccountId: string;
  target: ContaDestino;
};

@Injectable()
export class AberturaService {
  constructor(private prisma: PrismaService) {}

  async calcularAbertura(companyId: string, dataFechamentoISO: string): Promise<AberturaCalculo> {
    const inicio = new Date(dataFechamentoISO + 'T00:00:00Z');
    const fim = new Date(dataFechamentoISO + 'T23:59:59Z');

    // CORRIGIDO 15/09/2026: restringe as origens ao LOTE de importacao ECD
    // da data escolhida (arvores ECD paralelas redeclaram o mesmo saldo a
    // cada ano - sem o filtro, o imobilizado da Hotelsys era somado 9x).
    // ALTERADO 23/11/2026: sem lote terminando na data, usa o lote que
    // comeca no dia seguinte (saldo inicial).
    let loteOrigem: AberturaCalculo['loteOrigem'] = 'FIM_DO_PERIODO';
    let lotes = await this.prisma.ecdImport.findMany({
      where: { companyId, periodEnd: new Date(dataFechamentoISO + 'T00:00:00Z'), deletedAt: null },
      select: { id: true },
    });
    if (lotes.length === 0) {
      const diaSeguinte = new Date(dataFechamentoISO + 'T00:00:00Z');
      diaSeguinte.setUTCDate(diaSeguinte.getUTCDate() + 1);
      lotes = await this.prisma.ecdImport.findMany({
        where: { companyId, periodStart: diaSeguinte, deletedAt: null },
        select: { id: true },
      });
      loteOrigem = 'SALDO_INICIAL';
    }
    if (lotes.length === 0) {
      throw new BadRequestException(
        `Nenhum lote de importa\u00e7\u00e3o ECD terminando em ${dataFechamentoISO} nem come\u00e7ando no dia seguinte. Confira a data ou importe o ECD correspondente antes de calcular a abertura.`,
      );
    }
    const loteIds = lotes.map(l => l.id);

    // ALTERADO 23/11/2026: empresa sem de/para -> modo DIRETO (a propria conta).
    const totalDePara = await this.prisma.ecdAccountMapping.count({ where: { companyId } });
    const modo: AberturaCalculo['modo'] = totalDePara > 0 ? 'DE_PARA' : 'DIRETO';

    let pares: ParOrigemDestino[];
    if (modo === 'DE_PARA') {
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
      pares = mappings.map(m => ({
        sourceAccountId: m.sourceAccountId,
        source: m.sourceAccount,
        targetAccountId: m.targetAccountId,
        target: m.targetAccount,
      }));
    } else {
      const contas = await this.prisma.chartOfAccounts.findMany({
        where: { companyId, deletedAt: null, ecdImportLinks: { some: { ecdImportId: { in: loteIds } } } },
        select: { id: true, code: true, name: true, type: true, isAnalytic: true },
      });
      pares = contas.map(c => ({ sourceAccountId: c.id, source: c, targetAccountId: c.id, target: c }));
    }

    const sourceIds = pares.map(p => p.sourceAccountId);
    const balances = await this.prisma.accountBalance.findMany({
      where: { accountId: { in: sourceIds }, referenceDate: { gte: inicio, lte: fim } },
    });
    const balMap = new Map<string, number>(balances.map(b => [b.accountId, Number(b.balance)]));

    const porTarget = new Map<string, { target: ContaDestino; origens: { code: string; name: string; balance: number }[] }>();
    for (const p of pares) {
      const bal = balMap.get(p.sourceAccountId);
      if (bal === undefined || bal === 0) continue;
      const key = p.targetAccountId;
      if (!porTarget.has(key)) porTarget.set(key, { target: p.target, origens: [] });
      porTarget.get(key)!.origens.push({ code: p.source.code, name: p.source.name, balance: bal });
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
      // pura visibilidade para revisao humana antes de registrar.
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
      modo,
      loteOrigem,
    };
  }

  async registrarAbertura(
    companyId: string, dataFechamentoISO: string, dataAberturaISO: string,
    referencia: string, userId: string,
  ) {
    const calculo = await this.calcularAbertura(companyId, dataFechamentoISO);

    if (calculo.contasNaoAnaliticas.length > 0) {
      throw new BadRequestException(
        `Existem ${calculo.contasNaoAnaliticas.length} conta(s) sint\u00e9tica(s) com saldo - crie contas anal\u00edticas antes de registrar: ${calculo.contasNaoAnaliticas.map(c => c.code).join(', ')}`,
      );
    }
    if (Math.abs(calculo.diferenca) > 0.01) {
      throw new BadRequestException(`Lan\u00e7amento n\u00e3o fecha - diferen\u00e7a de ${calculo.diferenca.toFixed(2)}.`);
    }
    if (calculo.linhas.length === 0) {
      throw new BadRequestException('Nenhuma linha calculada - verifique o de/para (ecd_account_mappings) e os saldos na data de fechamento.');
    }

    // ALTERADO 23/11/2026: mesma regra do JournalEntryService - competencia fechada recusa.
    const competencia = dataAberturaISO.slice(0, 7);
    const fech = await this.prisma.fechamentoMensal.findUnique({
      where: { companyId_competencia: { companyId, competencia } },
      select: { status: true },
    });
    if (fech && (fech.status === 'FECHADO' || fech.status === 'FECHADO_PREVIO')) {
      throw new BadRequestException(`Compet\u00eancia ${competencia} est\u00e1 fechada - reabra no Fechamento Mensal antes de registrar a abertura.`);
    }

    const dataAbertura = new Date(dataAberturaISO + 'T12:00:00Z');

    return this.prisma.$transaction(async tx => {
      // CORRIGIDO 31/08/2026: re-registrar sempre SUBSTITUI, nunca soma
      // (achado real na Sunrise: 2 "ABERTURA-2018" coexistindo).
      // ALTERADO 23/11/2026: a substituicao e por exclusao LOGICA.
      const substituidos = await tx.journalEntry.updateMany({
        where: { companyId, reference: referencia, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          date: dataAbertura,
          description: `Lan\u00e7amento de Abertura ${referencia}`,
          reference: referencia,
          sourceModule: 'ACCOUNTING',
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

      return {
        journalEntryId: entry.id,
        totalItens: calculo.linhas.length,
        totalDebito: calculo.totalDebito,
        totalCredito: calculo.totalCredito,
        modo: calculo.modo,
        loteOrigem: calculo.loteOrigem,
        substituidos: substituidos.count,
      };
    });
  }
}
