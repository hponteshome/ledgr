// apps/api/src/modules/accounting/services/trial-balance.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TrialBalanceService {
  constructor(private prisma: PrismaService) {}

  // ─── Helpers de data ────────────────────────────────────────────────────────

  private toUTCStart(date: Date): Date {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0,
    ));
  }

  private toUTCEnd(date: Date): Date {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23, 59, 59, 999,
    ));
  }

  // ─── Helper: Busca contas ────────────────────────────────────────────────────

  private async getAccounts(companyId: string) {
    return this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
select: {
    id        : true,
    code      : true,
    name      : true,
    type      : true,
    nature    : true,
    level     : true,
    parentId  : true,
    isAnalytic: true,
},
      orderBy: { code: 'asc' },
    });
  }

  // ─── Helper: Movimentação por conta via JournalEntryItem ────────────────────
  //
  // Retorna débitos e créditos acumulados por accountId para um intervalo.
  // Fonte: JournalEntryItem → JournalEntry.date (campo @db.Date no schema).

  private async getMovements(
    companyId: string,
    from: Date,
    to: Date,
  ): Promise<Map<string, { debits: number; credits: number }>> {

    const items = await this.prisma.journalEntryItem.findMany({
      where: {
        journalEntry: {
          companyId,
          date     : { gte: from, lte: to },
          deletedAt: null,
        },
      },
      select: {
        accountId: true,
        type     : true,   // AccountNature: DEBIT | CREDIT
        value    : true,
      },
    });

    const map = new Map<string, { debits: number; credits: number }>();

    items.forEach(item => {
      if (!map.has(item.accountId))
        map.set(item.accountId, { debits: 0, credits: 0 });

      const entry = map.get(item.accountId)!;
      const val   = Number(item.value);

      if (item.type === 'DEBIT')  entry.debits  += val;
      else                        entry.credits += val;
    });

    return map;
  }

  // ─── Helper: Propaga bottom-up (analíticas → sintéticas) via parentId ───────
  //
  // Usa o relacionamento real parentId do schema — não depende de parsing de código.

  private rollUp(
    accounts: Array<{ id: string; parentId?: string | null }>,
    dataById: Map<string, { debits: number; credits: number }>,
  ): void {
    // Garante entrada para todas as contas
    accounts.forEach(a => {
      if (!dataById.has(a.id))
        dataById.set(a.id, { debits: 0, credits: 0 });
    });

    // Ordena por código desc para processar filhos antes dos pais
    // (necessário apenas como fallback; parentId é o critério real)
    const idToCode = new Map(accounts.map(a => [a.id, (a as any).code as string]));
    const sorted   = [...accounts].sort(
      (a, b) => idToCode.get(b.id)!.localeCompare(idToCode.get(a.id)!),
    );

    sorted.forEach(a => {
      if (!a.parentId) return;
      const parent = dataById.get(a.parentId);
      const child  = dataById.get(a.id);
      if (!parent || !child) return;
      parent.debits  += child.debits;
      parent.credits += child.credits;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BALANCETE MENSAL
  // GET /accounting/trial-balance?date=YYYY-MM-DD
  //
  // Exibe débitos e créditos acumulados desde o início até a data informada.
  // "Saldo Final" = débitos acumulados - créditos acumulados.
  // ═══════════════════════════════════════════════════════════════════════════

  async getTrialBalance(companyId: string, date: Date) {
    const end      = this.toUTCEnd(date);
    // Início do tempo: 1900-01-01 — garante todos os lançamentos históricos
    const beginning = new Date(Date.UTC(1900, 0, 1));

    const accounts = await this.getAccounts(companyId);
    const movMap   = await this.getMovements(companyId, beginning, end);

    this.rollUp(accounts, movMap);

    const balances = accounts
      .map(account => {
        const m       = movMap.get(account.id) ?? { debits: 0, credits: 0 };
        // Saldo: débitos - créditos (positivo = saldo devedor)
        const balance = m.debits - m.credits;
        return { account, balance, referenceDate: date };
      })
      .filter(b => b.balance !== 0);

    return { date, balances };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMO DO BALANCETE MENSAL
  // GET /accounting/trial-balance/summary?date=YYYY-MM-DD
  // ═══════════════════════════════════════════════════════════════════════════

  async getTrialBalanceSummary(companyId: string, date: Date) {
    const tb = await this.getTrialBalance(companyId, date);

    const summary = { assets: 0, liabilities: 0, revenues: 0, expenses: 0 };

    tb.balances.forEach((item: any) => {
      const type    = item.account.type;
      const balance = Number(item.balance);

      if (type === 'ASSET') {
        summary.assets += balance;
      } else if (type === 'LIABILITY' || type === 'EQUITY') {
        summary.liabilities += Math.abs(balance);
      } else if (type === 'REVENUE') {
        summary.revenues += Math.abs(balance);
      } else if (type === 'EXPENSE') {
        summary.expenses += Math.abs(balance);
      }
    });

    return {
      date,
      summary: {
        ASSET     : summary.assets,
        LIABILITY : summary.liabilities,
        REVENUE   : summary.revenues,
        EXPENSE   : summary.expenses,
        NET_RESULT: summary.revenues - summary.expenses,
      },
      details: tb.balances,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BALANCETE DE VERIFICAÇÃO
  // GET /accounting/trial-balance/verification?startDate=...&endDate=...
  //
  // Exibe para cada conta:
  //   - Saldo Anterior : débitos - créditos de TODOS os lançamentos ANTES do período
  //   - Débitos        : débitos do período
  //   - Créditos       : créditos do período
  //   - Saldo Final    : saldo anterior + débitos - créditos do período
  // ═══════════════════════════════════════════════════════════════════════════

  async getVerificationBalance(companyId: string, startDate: Date, endDate: Date) {
    const start       = this.toUTCStart(startDate);
    const end         = this.toUTCEnd(endDate);
    const beginning   = new Date(Date.UTC(1900, 0, 1));
    const beforeStart = new Date(start.getTime() - 1);

    const accounts = await this.getAccounts(companyId);

    const prevMap = await this.getMovements(companyId, beginning, beforeStart);
    this.rollUp(accounts, prevMap);

    const periodMap = await this.getMovements(companyId, start, end);
    this.rollUp(accounts, periodMap);

    // Fallback: AccountBalance (I155) para contas sem lancamentos anteriores
    const accountBalances = await this.prisma.accountBalance.findMany({
      where: { companyId, referenceDate: { lt: start } },
      orderBy: { referenceDate: "desc" },
    });
    const i155Map = new Map<string, number>();
    for (const ab of accountBalances) {
      if (!i155Map.has(ab.accountId))
        i155Map.set(ab.accountId, Number(ab.balance));
    }

    const balances = accounts
      .map(account => {
        const prev   = prevMap.get(account.id)   ?? { debits: 0, credits: 0 };
        const period = periodMap.get(account.id) ?? { debits: 0, credits: 0 };

        let previousBalance = prev.debits - prev.credits;
        if (previousBalance === 0 && i155Map.has(account.id))
          previousBalance = i155Map.get(account.id)!;

        const debits         = period.debits;
        const credits        = period.credits;
        const currentBalance = previousBalance + debits - credits;

        if (previousBalance === 0 && debits === 0 && credits === 0) return null;
        return { account, previousBalance, debits, credits, currentBalance, hasData: true };
      })
      .filter(Boolean);

    return { startDate, endDate, balances };
  }
}
