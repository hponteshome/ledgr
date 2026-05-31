// apps/api/src/modules/finance/cashflow.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface CashflowMonth {
  month: string; // YYYY-MM
  label: string; // Jan/2025
  inflow:         { predicted: number; realized: number; byOrigin: Record<string, number> };
  outflow:        { predicted: number; realized: number; byOrigin: Record<string, number> };
  balance:        { predicted: number; realized: number; cumulative: number };
}

@Injectable()
export class CashflowService {
  constructor(private readonly prisma: PrismaService) {}
  async minYear(companyId: string): Promise<number> {
    const [ar, ap, je] = await Promise.all([
      this.prisma.arEntry.findFirst({ where: { companyId }, orderBy: { dueDate: 'asc' }, select: { dueDate: true } }),
      this.prisma.apEntry.findFirst({ where: { companyId }, orderBy: { dueDate: 'asc' }, select: { dueDate: true } }),
      this.prisma.journalEntry.findFirst({ where: { companyId }, orderBy: { date: 'asc' }, select: { date: true } }),
    ]);
    const years = [ar?.dueDate, ap?.dueDate, je?.date].filter(Boolean).map(d => new Date(d!).getFullYear());
    return years.length ? Math.min(...years) : new Date().getFullYear();
  }


  async gerencial(companyId: string, fromMonth: string, toMonth: string, propertyId?: string, fixedAssetId?: string): Promise<CashflowMonth[]> {
    const from = new Date(`${fromMonth}-01T00:00:00`);
    const to   = new Date(`${toMonth}-01T00:00:00`);
    to.setMonth(to.getMonth() + 1);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return [];

    // Receitas (AR)
    const arEntries = await this.prisma.arEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { gte: from, lt: to },
        ...(fixedAssetId ? { fixedAssetId } : propertyId ? { propertyId } : {}),
      },
      include: { payments: true },
    });

    // Despesas (AP)
    const apEntries = await this.prisma.apEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { gte: from, lt: to },
        ...(propertyId ? { propertyId } : {}),
      },
    });

    // Montar meses
    const months: string[] = [];
    const cur = new Date(from);
    while (cur < to) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`);
      cur.setMonth(cur.getMonth()+1);
    }

    const MONTH_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    let cumulative = 0;
    const result: CashflowMonth[] = months.map(m => {
      const [y, mo] = m.split('-').map(Number);
      const label = `${MONTH_LABEL[mo-1]}/${y}`;

      // Receitas do mês
      const arMonth = arEntries.filter(e => {
        const d = new Date(e.dueDate);
        return d.getFullYear() === y && d.getMonth()+1 === mo;
      });

      const inflowPredicted = arMonth.reduce((s, e) => s + Number(e.amount), 0);
      const inflowRealized  = arMonth.reduce((s, e) => {
        if (e.status === 'RECEIVED') return s + Number(e.amount);
        return s + e.payments.reduce((ps, p) => ps + Number(p.amount), 0);
      }, 0);
      const inflowByOrigin  = arMonth.reduce((acc, e) => {
        acc[e.origin] = (acc[e.origin] ?? 0) + Number(e.amount);
        return acc;
      }, {} as Record<string, number>);

      // Despesas do mês
      const apMonth = apEntries.filter(e => {
        const d = new Date(e.dueDate);
        return d.getFullYear() === y && d.getMonth()+1 === mo;
      });

      const outflowPredicted = apMonth.reduce((s, e) => s + Number(e.amount), 0);
      const outflowRealized  = apMonth.reduce((s, e) => s + Number(e.paidAmount), 0);
      const outflowByOrigin  = apMonth.reduce((acc, e) => {
        const key = e.supplierName ?? 'Outros';
        acc[key] = (acc[key] ?? 0) + Number(e.amount);
        return acc;
      }, {} as Record<string, number>);

      const balPredicted = inflowPredicted - outflowPredicted;
      const balRealized  = inflowRealized  - outflowRealized;
      cumulative += balRealized;

      return {
        month: m,
        label,
        inflow:  { predicted: inflowPredicted,  realized: inflowRealized,  byOrigin: inflowByOrigin },
        outflow: { predicted: outflowPredicted, realized: outflowRealized, byOrigin: outflowByOrigin },
        balance: { predicted: balPredicted, realized: balRealized, cumulative },
      };
    });

    return result;
  }

  async summary(companyId: string, fromMonth: string, toMonth: string, fixedAssetId?: string) {
    const months = await this.gerencial(companyId, fromMonth, toMonth, undefined, fixedAssetId);
    return {
      months,
      totals: {
        inflowPredicted:  months.reduce((s, m) => s + m.inflow.predicted, 0),
        inflowRealized:   months.reduce((s, m) => s + m.inflow.realized, 0),
        outflowPredicted: months.reduce((s, m) => s + m.outflow.predicted, 0),
        outflowRealized:  months.reduce((s, m) => s + m.outflow.realized, 0),
        balancePredicted: months.reduce((s, m) => s + m.balance.predicted, 0),
        balanceRealized:  months.reduce((s, m) => s + m.balance.realized, 0),
      },
    };
  }
  async bancario(companyId: string, fromMonth: string, toMonth: string): Promise<any> {
    const from = new Date(`${fromMonth}-01T00:00:00`);
    const to   = new Date(`${toMonth}-01T00:00:00`);
    to.setMonth(to.getMonth() + 1);

    const transactions = await this.prisma.bankTransaction.findMany({
      where: {
        companyId,
        transactionDate: { gte: from, lt: to },
      },
      include: { statement: { select: { bankName: true, agency: true, account: true } } },
      orderBy: { transactionDate: 'asc' },
    });

    // Agrupar por mês
    const monthMap: Record<string, { credits: number; debits: number; transactions: any[] }> = {};

    for (const tx of transactions) {
      const d = new Date(tx.transactionDate);
      const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!monthMap[m]) monthMap[m] = { credits: 0, debits: 0, transactions: [] };
      if (tx.type === 'CREDIT') monthMap[m].credits += Number(tx.amount);
      else                      monthMap[m].debits  += Math.abs(Number(tx.amount));
      monthMap[m].transactions.push(tx);
    }

    const MONTH_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const months: string[] = [];
    const cur = new Date(from);
    while (cur < to) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`);
      cur.setMonth(cur.getMonth()+1);
    }

    let cumulative = 0;
    const result = months.map(m => {
      const [y, mo] = m.split('-').map(Number);
      const label = `${MONTH_LABEL[mo-1]}/${y}`;
      const data  = monthMap[m] ?? { credits: 0, debits: 0, transactions: [] };
      const balance = data.credits - data.debits;
      cumulative += balance;
      return {
        month: m, label,
        credits: data.credits,
        debits:  data.debits,
        balance,
        cumulative,
        transactionCount: data.transactions.length,
        transactions: data.transactions,
      };
    });

    return {
      months: result,
      totals: {
        credits:  result.reduce((s, m) => s + m.credits, 0),
        debits:   result.reduce((s, m) => s + m.debits, 0),
        balance:  result.reduce((s, m) => s + m.balance, 0),
      },
    };
  }
}