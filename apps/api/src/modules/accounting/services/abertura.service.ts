// apps/api/src/modules/accounting/services/abertura.service.ts
// CRIADO 27/08/2026: Lancamentos de Abertura - converte saldos finais
// analiticos da ECD (data de fechamento) para as contas do Plano Matriz
// (data de abertura), usando o de/para ja existente (ecd_account_mappings).
// Reaproveita a mesma logica ja validada manualmente para a abertura 2018
// da Hotelsys (dedupe por valor identico - contas renomeadas ao longo dos
// anos de ECD geram origens duplicadas com o mesmo saldo, que NAO devem
// ser somadas duas vezes).
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
  origens: { code: string; name: string; balance: number }[];
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

    const mappings = await this.prisma.ecdAccountMapping.findMany({
      where: { companyId },
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
      // Dedupe por valor identico - achado real na abertura 2018 da Hotelsys:
      // contas renomeadas ao longo dos anos de ECD (mesmo saldo, codigo
      // diferente) NAO devem ser somadas duas vezes.
      const vistos = new Set<number>();
      let soma = 0;
      for (const o of origens) {
        const chave = Math.round(o.balance * 100) / 100;
        if (!vistos.has(chave)) {
          vistos.add(chave);
          soma += chave;
        }
      }
      soma = Math.round(soma * 100) / 100;
      if (soma === 0) continue;

      resultado.push({
        targetAccountId: targetId,
        targetCode: target.code,
        targetName: target.name,
        targetType: target.type,
        isAnalytic: target.isAnalytic,
        saldo: soma,
        debito: soma > 0 ? soma : 0,
        credito: soma < 0 ? -soma : 0,
        origens,
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
