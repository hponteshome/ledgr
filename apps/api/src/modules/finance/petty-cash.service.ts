// apps/api/src/modules/finance/petty-cash.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PettyCashService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.pettyCash.findMany({
      where: { companyId, active: true },
      include: { responsible: { select: { id: true, fullName: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const fund = await this.prisma.pettyCash.findFirst({
      where: { id, companyId },
      include: { responsible: { select: { id: true, fullName: true } } },
    });
    if (!fund) throw new NotFoundException('Fundo fixo nao encontrado.');
    return fund;
  }

  async create(companyId: string, dto: any, userId: string) {
    const targetBalance = new Prisma.Decimal(String(dto.targetBalance).replace(',','.'));
    const alertThreshold = new Prisma.Decimal(String(dto.alertThreshold).replace(',','.'));

    return this.prisma.$transaction(async (tx) => {
      const fund = await tx.pettyCash.create({
        data: {
          companyId,
          name:             dto.name,
          targetBalance,
          alertThreshold,
          currentBalance:   targetBalance,
          responsibleId:    dto.responsibleId || null,
          expenseAccountId: dto.expenseAccountId || null,
          cashAccountId:    dto.cashAccountId || null,
        },
      });

      await tx.pettyCashEntry.create({
        data: {
          pettyCashId:  fund.id,
          companyId,
          type:         'OPENING',
          date:         new Date(),
          amount:       targetBalance,
          description:  'Abertura do fundo fixo — saldo inicial',
          balanceAfter: targetBalance,
          createdById:  userId,
        },
      });

      return fund;
    });
  }

  async addEntry(companyId: string, fundId: string, dto: any, userId: string) {
    const fund = await this.findOne(companyId, fundId);
    const amount = new Prisma.Decimal(String(dto.amount).replace(',','.'));
    let newBalance: Prisma.Decimal;

    if (dto.type === 'EXPENSE') {
      newBalance = new Prisma.Decimal(fund.currentBalance).minus(amount);
      if (newBalance.lessThan(0)) throw new BadRequestException('Saldo insuficiente no fundo fixo.');
    } else {
      newBalance = new Prisma.Decimal(fund.currentBalance).plus(amount);
    }

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.pettyCashEntry.create({
        data: {
          pettyCashId:  fundId,
          companyId,
          type:         dto.type,
          category:     dto.category ?? null,
          date:         new Date(dto.date),
          amount,
          description:  dto.description,
          receiptRef:   dto.receiptRef ?? null,
          supplier:     dto.supplier ?? null,
          balanceAfter: newBalance,
          createdById:  userId,
        },
      });

      await tx.pettyCash.update({
        where: { id: fundId },
        data: { currentBalance: newBalance },
      });

      return { entry, currentBalance: newBalance };
    });
  }

  async getEntries(companyId: string, fundId: string, from?: string, to?: string) {
    const where: any = { pettyCashId: fundId, companyId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to)   where.date.lte = new Date(to + 'T23:59:59');
    }
    const entries = await this.prisma.pettyCashEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    const totalExpenses     = entries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + Number(e.amount), 0);
    const totalReplenishment = entries.filter(e => e.type === 'REPLENISHMENT').reduce((s, e) => s + Number(e.amount), 0);
    return { entries, totalExpenses, totalReplenishment };
  }

  async getSummary(companyId: string, fundId: string) {
    const fund = await this.findOne(companyId, fundId);
    const current = Number(fund.currentBalance);
    const target  = Number(fund.targetBalance);
    const alert   = Number(fund.alertThreshold);
    return {
      fund,
      current,
      target,
      alert,
      pct: target > 0 ? Math.round((current / target) * 100) : 0,
      needsReplenishment: current <= alert,
      replenishmentAmount: Math.max(0, target - current),
    };
  }
}