// /apps/api/src/modules/accounting/services/trial-balance.service.ts
//
// ARQUIVO COMPLETO — substitui o trial-balance.service.ts atual.
// Adiciona: getVerificationBalance()
//

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TrialBalanceService {
  constructor(private prisma: PrismaService) {}

  // ─── Balancete Mensal (fotografia em uma data) ─────────────────────────────

  async getTrialBalance(companyId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const balances = await this.prisma.accountBalance.findMany({
      where: {
        companyId,
        referenceDate: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            nature: true,
            level: true,
            parentId: true,
          },
        },
      },
      orderBy: { account: { code: 'asc' } },
    });

    if (balances.length === 0) {
      return this.getLatestBalances(companyId, date);
    }

    return {
      date,
      balances: balances.map(b => ({ ...b, balance: Number(b.balance) })),
    };
  }

  // ─── Resumo do Balancete Mensal ────────────────────────────────────────────

  async getTrialBalanceSummary(companyId: string, date: Date) {
    const trialBalance = await this.getTrialBalance(companyId, date);

    const summary = {
      totalDebit: 0,
      totalCredit: 0,
      byType: {} as Record<string, { debit: number; credit: number; balance: number }>,
      byLevel: {} as Record<number, { debit: number; credit: number; balance: number }>,
    };

    trialBalance.balances.forEach((item: any) => {
      const type = item.account.type;
      const level = item.account.level || 1;
      const balance = Number(item.balance);

      if (!summary.byType[type]) summary.byType[type] = { debit: 0, credit: 0, balance: 0 };
      if (!summary.byLevel[level]) summary.byLevel[level] = { debit: 0, credit: 0, balance: 0 };

      if (item.account.nature === 'DEBIT') {
        if (balance > 0) {
          summary.byType[type].debit += balance;
          summary.byLevel[level].debit += balance;
          summary.totalDebit += balance;
        } else {
          summary.byType[type].credit += Math.abs(balance);
          summary.byLevel[level].credit += Math.abs(balance);
          summary.totalCredit += Math.abs(balance);
        }
      } else {
        if (balance > 0) {
          summary.byType[type].credit += balance;
          summary.byLevel[level].credit += balance;
          summary.totalCredit += balance;
        } else {
          summary.byType[type].debit += Math.abs(balance);
          summary.byLevel[level].debit += Math.abs(balance);
          summary.totalDebit += Math.abs(balance);
        }
      }

      summary.byType[type].balance += balance;
      summary.byLevel[level].balance += balance;
    });

    // Formato plano para os cards do frontend: { ASSET: 123.45, LIABILITY: 67.89, ... }
    const byTypePlat: Record<string, number> = {};
    Object.entries(summary.byType).forEach(([type, val]) => {
      byTypePlat[type] = Math.abs(val.balance);
    });

    return { date, summary: byTypePlat, details: trialBalance.balances };
  }

  // ─── Balancete de Verificação (movimento no período) ──────────────────────
  //
  // Lógica:
  //   • previousBalance = saldo mais recente ANTES de startDate
  //   • debits          = soma dos saldos positivos registrados no período
  //   • credits         = soma dos módulos dos saldos negativos no período
  //   • currentBalance  = previousBalance + debits - credits
  //
  // O campo AccountBalance.balance já armazena o saldo absoluto por período
  // (positivo = devedor, negativo = credor), então tratamos assim:
  //   balance > 0 → lançamento a débito
  //   balance < 0 → lançamento a crédito
  //
  async getVerificationBalance(companyId: string, startDate: Date, endDate: Date) {
    // Normalizar datas
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1. Buscar todas as contas da empresa
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        nature: true,
        level: true,
        parentId: true,
      },
      orderBy: { code: 'asc' },
    });

    // 2. Buscar saldo anterior (última entrada ANTES de startDate) para cada conta
    //    Usamos um único findMany agrupado por conta para evitar N+1
    const previousBalanceRecords = await this.prisma.accountBalance.findMany({
      where: {
        companyId,
        referenceDate: { lt: start },
      },
      orderBy: { referenceDate: 'desc' },
      select: {
        accountId: true,
        balance: true,
        referenceDate: true,
      },
    });

    // Mapa: accountId → saldo anterior (pega apenas o mais recente)
    const previousBalanceMap = new Map<string, number>();
    previousBalanceRecords.forEach(r => {
      if (!previousBalanceMap.has(r.accountId)) {
        previousBalanceMap.set(r.accountId, Number(r.balance));
      }
    });

    // 3. Buscar movimentos do período
    const periodBalances = await this.prisma.accountBalance.findMany({
      where: {
        companyId,
        referenceDate: { gte: start, lte: end },
      },
      select: {
        accountId: true,
        balance: true,
        referenceDate: true,
      },
      orderBy: { referenceDate: 'asc' },
    });

    // Mapa: accountId → { debits, credits }
    const movementMap = new Map<string, { debits: number; credits: number }>();
    periodBalances.forEach(r => {
      const val = Number(r.balance);
      if (!movementMap.has(r.accountId)) {
        movementMap.set(r.accountId, { debits: 0, credits: 0 });
      }
      const entry = movementMap.get(r.accountId)!;
      if (val > 0) {
        entry.debits += val;
      } else {
        entry.credits += Math.abs(val);
      }
    });

    // 4. Montar resultado apenas para contas que tiveram movimento ou saldo anterior
    const result = accounts
      .map(account => {
        const previousBalance = previousBalanceMap.get(account.id) ?? 0;
        const movement = movementMap.get(account.id) ?? { debits: 0, credits: 0 };
        const currentBalance = previousBalance + movement.debits - movement.credits;

        // Excluir contas sem nenhum dado
        if (previousBalance === 0 && movement.debits === 0 && movement.credits === 0) {
          return null;
        }

        return {
          account,
          previousBalance,
          debits: movement.debits,
          credits: movement.credits,
          currentBalance,
        };
      })
      .filter(Boolean);

    return {
      startDate,
      endDate,
      balances: result,
    };
  }

  // ─── Fallback: últimos saldos disponíveis até uma data ────────────────────

  private async getLatestBalances(companyId: string, date: Date) {
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        nature: true,
        level: true,
        parentId: true,
      },
    });

    const balances = await Promise.all(
      accounts.map(async account => {
        const latest = await this.prisma.accountBalance.findFirst({
          where: {
            accountId: account.id,
            companyId,
            referenceDate: { lte: date },
          },
          orderBy: { referenceDate: 'desc' },
        });

        return {
          account,
          balance: latest ? Number(latest.balance) : 0,
          referenceDate: latest?.referenceDate || date,
        };
      }),
    );

    return {
      date,
      balances: balances.filter(b => b.balance !== 0),
    };
  }
}
