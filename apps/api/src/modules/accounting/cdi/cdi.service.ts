// apps/api/src/modules/accounting/cdi/cdi.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CdiService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(from?: string, to?: string) {
    return this.prisma.cdiDailyRate.findMany({
      where: {
        date: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async findByCompetence(competence: string) {
    const [yyyy, mm] = competence.split('-').map(Number);
    const from = new Date(yyyy, mm - 1, 1);
    const to   = new Date(yyyy, mm, 0);
    const rows = await this.prisma.cdiDailyRate.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    if (!rows.length) return null;
    const first = rows[0];
    const last  = rows[rows.length - 1];
    const monthlyAccum = Number(last.monthlyAccum);
    const monthlyRateFactor = monthlyAccum / 100;
    return {
      competence,
      businessDays: rows.length,
      firstDate: first.date,
      lastDate:  last.date,
      monthlyAccum,
      monthlyRateFactor,
      rates: rows,
    };
  }

  async upsertMany(rows: {
    date: string; dailyRate: number; monthlyAccum: number;
    yearAccum: number; accum30d: number; accum12m: number; accumIndex: number;
  }[]) {
    let inserted = 0, updated = 0;
    for (const r of rows) {
      const date = new Date(r.date);
      const existing = await this.prisma.cdiDailyRate.findUnique({ where: { date } });
      if (existing) {
        await this.prisma.cdiDailyRate.update({
          where: { date },
          data: {
            dailyRate:    r.dailyRate,
            monthlyAccum: r.monthlyAccum,
            yearAccum:    r.yearAccum,
            accum30d:     r.accum30d,
            accum12m:     r.accum12m,
            accumIndex:   r.accumIndex,
          },
        });
        updated++;
      } else {
        await this.prisma.cdiDailyRate.create({
          data: {
            date,
            dailyRate:    r.dailyRate,
            monthlyAccum: r.monthlyAccum,
            yearAccum:    r.yearAccum,
            accum30d:     r.accum30d,
            accum12m:     r.accum12m,
            accumIndex:   r.accumIndex,
          },
        });
        inserted++;
      }
    }
    return { inserted, updated, total: rows.length };
  }

  async deleteByDate(date: string) {
    return this.prisma.cdiDailyRate.delete({ where: { date: new Date(date) } });
  }

  async getMonthlyRates(from?: string, to?: string) {
    const all = await this.findAll(from, to);
    const map = new Map<string, { accum: number; days: number }>();
    for (const r of all) {
      const d    = new Date(r.date);
      const comp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!map.has(comp)) map.set(comp, { accum: 0, days: 0 });
      const cur = map.get(comp)!;
      cur.days++;
      cur.accum = Math.max(cur.accum, Number(r.monthlyAccum));
    }
    return Array.from(map.entries()).map(([competence, v]) => ({
      competence,
      businessDays: v.days,
      monthlyAccum: v.accum,
      monthlyRateFactor: v.accum / 100,
    })).sort((a, b) => a.competence.localeCompare(b.competence));
  }

  async getLatestDate() {
    const r = await this.prisma.cdiDailyRate.findFirst({ orderBy: { date: 'desc' } });
    return r ? r.date : null;
  }
}