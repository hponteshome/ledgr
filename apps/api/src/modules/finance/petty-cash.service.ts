// apps/api/src/modules/finance/petty-cash.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PettyCashService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, includeInactive = false) {
    return this.prisma.pettyCash.findMany({
      where: includeInactive ? { companyId } : { companyId, active: true },
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

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'CREATE_PETTY_CASH',
          targetId: fund.id,
          before: null,
          after: { name: fund.name, targetBalance: fund.targetBalance },
          ip: null,
        },
      });

      return fund;
    });
  }

  async update(companyId: string, id: string, dto: any, userId: string, ip?: string) {
    const before = await this.findOne(companyId, id);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.targetBalance !== undefined) data.targetBalance = new Prisma.Decimal(String(dto.targetBalance).replace(',','.'));
    if (dto.alertThreshold !== undefined) data.alertThreshold = new Prisma.Decimal(String(dto.alertThreshold).replace(',','.'));
    if (dto.responsibleId !== undefined) data.responsibleId = dto.responsibleId || null;
    if (dto.expenseAccountId !== undefined) data.expenseAccountId = dto.expenseAccountId || null;
    if (dto.cashAccountId !== undefined) data.cashAccountId = dto.cashAccountId || null;

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.pettyCash.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'UPDATE_PETTY_CASH',
          targetId: id,
          before: { name: before.name, targetBalance: before.targetBalance, alertThreshold: before.alertThreshold, responsibleId: before.responsibleId },
          after: { name: after.name, targetBalance: after.targetBalance, alertThreshold: after.alertThreshold, responsibleId: after.responsibleId },
          ip: ip ?? null,
        },
      });
      return after;
    });
  }

  async remove(companyId: string, id: string, userId: string, ip?: string) {
    const fund = await this.findOne(companyId, id);
    if (new Prisma.Decimal(fund.currentBalance).greaterThan(0)) {
      throw new BadRequestException('Nao e possivel excluir um fundo com saldo diferente de zero. Registre uma despesa (ou repasse o saldo) para zerar antes de excluir.');
    }
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.pettyCash.update({ where: { id }, data: { active: false } });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'DELETE_PETTY_CASH',
          targetId: id,
          before: { name: fund.name, active: true },
          after: { name: fund.name, active: false },
          ip: ip ?? null,
        },
      });
      return after;
    });
  }

  async toggleActive(companyId: string, id: string, active: boolean, userId: string, ip?: string) {
    const fund = await this.findOne(companyId, id);
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.pettyCash.update({ where: { id }, data: { active } });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: active ? 'ACTIVATE_PETTY_CASH' : 'DEACTIVATE_PETTY_CASH',
          targetId: id,
          before: { name: fund.name, active: fund.active },
          after: { name: fund.name, active },
          ip: ip ?? null,
        },
      });
      return after;
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

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: dto.type === 'EXPENSE' ? 'PETTY_CASH_EXPENSE' : 'PETTY_CASH_REPLENISHMENT',
          targetId: fundId,
          before: { balanceBefore: fund.currentBalance },
          after: { balanceAfter: newBalance, amount, description: dto.description },
          ip: null,
        },
      });

      return { entry, currentBalance: newBalance };
    });
  }

  async updateEntry(companyId: string, fundId: string, entryId: string, dto: any, userId: string, ip?: string) {
    await this.findOne(companyId, fundId);
    const entry = await this.prisma.pettyCashEntry.findFirst({ where: { id: entryId, pettyCashId: fundId, companyId } });
    if (!entry) throw new NotFoundException('Movimento nao encontrado.');
    if (entry.type === 'OPENING') throw new BadRequestException('Nao e possivel editar o lancamento de abertura. Use "Editar Fundo" para ajustar o saldo inicial.');
    if (entry.closureId) throw new BadRequestException('Este lancamento pertence a um fechamento ja realizado e nao pode mais ser editado.');

    const newAmount = dto.amount !== undefined ? new Prisma.Decimal(String(dto.amount).replace(',','.')) : new Prisma.Decimal(entry.amount);
    const newType = dto.type ?? entry.type;
    const newDate = dto.date !== undefined ? new Date(dto.date) : entry.date;
    const newDescription = dto.description !== undefined ? dto.description : entry.description;

    return this.prisma.$transaction(async (tx) => {
      const allEntries = await tx.pettyCashEntry.findMany({
        where: { pettyCashId: fundId },
        orderBy: { createdAt: 'asc' },
      });

      let running = new Prisma.Decimal(0);
      const recalculated: { id: string; balanceAfter: Prisma.Decimal }[] = [];

      for (const e of allEntries) {
        const isTarget = e.id === entryId;
        const type = isTarget ? newType : e.type;
        const amount = isTarget ? newAmount : new Prisma.Decimal(e.amount);
        running = type === 'EXPENSE' ? running.minus(amount) : running.plus(amount);
        if (running.lessThan(0)) {
          throw new BadRequestException(`A edicao deixaria o saldo negativo apos o lancamento de ${e.date.toISOString().slice(0,10)}. Ajuste o valor antes de salvar.`);
        }
        recalculated.push({ id: e.id, balanceAfter: running });
      }

      for (const r of recalculated) {
        if (r.id === entryId) {
          await tx.pettyCashEntry.update({
            where: { id: entryId },
            data: {
              type: newType,
              amount: newAmount,
              category: dto.category !== undefined ? dto.category : entry.category,
              date: newDate,
              description: newDescription,
              receiptRef: dto.receiptRef !== undefined ? dto.receiptRef : entry.receiptRef,
              supplier: dto.supplier !== undefined ? dto.supplier : entry.supplier,
              balanceAfter: r.balanceAfter,
            },
          });
        } else {
          await tx.pettyCashEntry.update({ where: { id: r.id }, data: { balanceAfter: r.balanceAfter } });
        }
      }

      const finalBalance = recalculated[recalculated.length - 1].balanceAfter;
      await tx.pettyCash.update({ where: { id: fundId }, data: { currentBalance: finalBalance } });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'UPDATE_PETTY_CASH_ENTRY',
          targetId: entryId,
          before: { type: entry.type, amount: entry.amount, description: entry.description, date: entry.date },
          after: { type: newType, amount: newAmount, description: newDescription, date: newDate },
          ip: ip ?? null,
        },
      });

      return { finalBalance };
    });
  }

  async removeEntry(companyId: string, fundId: string, entryId: string, userId: string, ip?: string) {
    await this.findOne(companyId, fundId);
    const entry = await this.prisma.pettyCashEntry.findFirst({ where: { id: entryId, pettyCashId: fundId, companyId } });
    if (!entry) throw new NotFoundException('Movimento nao encontrado.');
    if (entry.type === 'OPENING') throw new BadRequestException('Nao e possivel excluir o lancamento de abertura. Exclua o fundo inteiro se necessario.');
    if (entry.closureId) throw new BadRequestException('Este lancamento pertence a um fechamento ja realizado e nao pode mais ser excluido.');

    return this.prisma.$transaction(async (tx) => {
      const allEntries = await tx.pettyCashEntry.findMany({
        where: { pettyCashId: fundId },
        orderBy: { createdAt: 'asc' },
      });

      let running = new Prisma.Decimal(0);
      const recalculated: { id: string; balanceAfter: Prisma.Decimal }[] = [];

      for (const e of allEntries) {
        if (e.id === entryId) continue;
        running = e.type === 'EXPENSE' ? running.minus(e.amount) : running.plus(e.amount);
        if (running.lessThan(0)) {
          throw new BadRequestException('A exclusao deixaria o saldo negativo em algum ponto do historico. Nao e possivel excluir este lancamento.');
        }
        recalculated.push({ id: e.id, balanceAfter: running });
      }

      await tx.pettyCashEntry.delete({ where: { id: entryId } });
      for (const r of recalculated) {
        await tx.pettyCashEntry.update({ where: { id: r.id }, data: { balanceAfter: r.balanceAfter } });
      }

      const finalBalance = recalculated.length > 0 ? recalculated[recalculated.length - 1].balanceAfter : new Prisma.Decimal(0);
      await tx.pettyCash.update({ where: { id: fundId }, data: { currentBalance: finalBalance } });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'DELETE_PETTY_CASH_ENTRY',
          targetId: entryId,
          before: { type: entry.type, amount: entry.amount, description: entry.description, date: entry.date },
          after: null,
          ip: ip ?? null,
        },
      });

      return { finalBalance };
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

  async getCategoryAccountMap(companyId: string) {
    return this.prisma.pettyCashCategoryAccount.findMany({
      where: { companyId },
      include: { account: { select: { id: true, code: true, name: true } } },
    });
  }

  async setCategoryAccountMap(companyId: string, category: string, accountId: string) {
    return this.prisma.pettyCashCategoryAccount.upsert({
      where: { companyId_category: { companyId, category: category as any } },
      create: { companyId, category: category as any, accountId },
      update: { accountId },
    });
  }

  async getClosurePreview(companyId: string, fundId: string) {
    const fund = await this.findOne(companyId, fundId);
    const entries = await this.prisma.pettyCashEntry.findMany({
      where: { pettyCashId: fundId, companyId, closureId: null, type: 'EXPENSE' },
      orderBy: { date: 'asc' },
    });
    const categoryMap = await this.prisma.pettyCashCategoryAccount.findMany({ where: { companyId } });
    const mapByCategory = new Map(categoryMap.map(m => [m.category, m.accountId]));

    const entriesWithSuggestion = entries.map(e => ({
      ...e,
      suggestedAccountId: e.accountId ?? (e.category ? mapByCategory.get(e.category) ?? null : null),
    }));

    const totalExpenses = entries.reduce((sum, e) => sum.plus(e.amount), new Prisma.Decimal(0));

    return {
      fund,
      entries: entriesWithSuggestion,
      totalExpenses,
      needsCashAccount: !fund.cashAccountId,
      oldestUnclosedDate: entries.length > 0 ? entries[0].date : null,
    };
  }

  async closeCashier(
    companyId: string,
    fundId: string,
    userId: string,
    payload: { entries: { id: string; accountId: string }[]; cashAccountId?: string; saveMappings?: boolean },
    ip?: string,
  ) {
    const fund = await this.findOne(companyId, fundId);

    const cashAccountId = payload.cashAccountId ?? fund.cashAccountId;
    if (!cashAccountId) {
      throw new BadRequestException('Selecione a conta de caixa do fundo antes de fechar.');
    }

    const unclosedExpenses = await this.prisma.pettyCashEntry.findMany({
      where: { pettyCashId: fundId, companyId, closureId: null, type: 'EXPENSE' },
    });

    if (unclosedExpenses.length === 0) {
      throw new BadRequestException('Nao ha despesas pendentes para fechar neste periodo.');
    }

    const accountByEntryId = new Map(payload.entries.map(e => [e.id, e.accountId]));
    for (const entry of unclosedExpenses) {
      const acc = accountByEntryId.get(entry.id) ?? entry.accountId;
      if (!acc) {
        throw new BadRequestException(`A despesa "${entry.description}" precisa de uma conta contabil antes de fechar.`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const allEntriesInPeriod = await tx.pettyCashEntry.findMany({
        where: { pettyCashId: fundId, companyId, closureId: null },
        orderBy: { date: 'asc' },
      });

      const periodStart = allEntriesInPeriod.length > 0 ? allEntriesInPeriod[0].date : fund.createdAt;
      const periodEnd = new Date();

      const totalsByAccount = new Map<string, Prisma.Decimal>();
      for (const entry of unclosedExpenses) {
        const acc = (accountByEntryId.get(entry.id) ?? entry.accountId)!;
        const current = totalsByAccount.get(acc) ?? new Prisma.Decimal(0);
        totalsByAccount.set(acc, current.plus(entry.amount));
      }

      const totalExpenses = [...totalsByAccount.values()].reduce((s, v) => s.plus(v), new Prisma.Decimal(0));

      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          date: periodEnd,
          description: `Fechamento Fundo Fixo - ${fund.name} - ${periodStart.toISOString().slice(0,10)} a ${periodEnd.toISOString().slice(0,10)}`,
          sourceModule: 'FINANCE',
          createdById: userId,
          items: {
            create: [
              ...[...totalsByAccount.entries()].map(([accountId, value]) => ({
                accountId, value, type: 'DEBIT' as const,
              })),
              { accountId: cashAccountId, value: totalExpenses, type: 'CREDIT' as const },
            ],
          },
        },
      });

      const closure = await tx.pettyCashClosure.create({
        data: {
          companyId,
          pettyCashId: fundId,
          periodStart,
          periodEnd,
          totalExpenses,
          journalEntryId: journalEntry.id,
          closedById: userId,
        },
      });

      for (const entry of allEntriesInPeriod) {
        const isExpense = entry.type === 'EXPENSE';
        const acc = isExpense ? (accountByEntryId.get(entry.id) ?? entry.accountId) : undefined;
        await tx.pettyCashEntry.update({
          where: { id: entry.id },
          data: {
            closureId: closure.id,
            ...(isExpense ? { accountId: acc, journalEntryId: journalEntry.id } : {}),
          },
        });
      }

      if (payload.cashAccountId && payload.cashAccountId !== fund.cashAccountId) {
        await tx.pettyCash.update({ where: { id: fundId }, data: { cashAccountId: payload.cashAccountId } });
      }

      if (payload.saveMappings) {
        for (const entry of unclosedExpenses) {
          if (!entry.category) continue;
          const acc = accountByEntryId.get(entry.id) ?? entry.accountId;
          if (!acc) continue;
          await tx.pettyCashCategoryAccount.upsert({
            where: { companyId_category: { companyId, category: entry.category } },
            create: { companyId, category: entry.category, accountId: acc },
            update: { accountId: acc },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'CLOSE_PETTY_CASH_PERIOD',
          targetId: fundId,
          before: { periodStart, periodEnd },
          after: { closureId: closure.id, totalExpenses, journalEntryId: journalEntry.id },
          ip: ip ?? null,
        },
      });

      return closure;
    });
  }

}