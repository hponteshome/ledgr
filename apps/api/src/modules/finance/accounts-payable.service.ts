// ============================================================
// LEDGR — apps/api/src/modules/finance/accounts-payable.service.ts
// ============================================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateApDto } from './dto/create-ap.dto';
import { UpdateApDto } from './dto/update-ap.dto';
import { PayAPDto } from './dto/pay-ap.dto';
import { BatchPayAPDto } from './dto/batch-pay-ap.dto';
import { FilterAPDto } from './dto/filter-ap.dto';
import { ApEntryStatus, PaymentMethod, Prisma } from '@prisma/client';

// O model real no schema é "ApEntry" (@@map("ap_entries"))
// mas o service que geramos usava "AccountsPayable" — corrigido abaixo.
// ATENÇÃO: verifique se no seu projeto o prisma client expõe
// this.prisma.apEntry ou this.prisma.accountsPayable.
// Se a migration do AccountsPayable ainda não foi aplicada,
// use this.prisma.apEntry (model ApEntry do schema existente).
//
// Este arquivo usa this.prisma.accountsPayable pois o model
// AccountsPayable foi adicionado via migration na sessão atual.
// Ajuste para apEntry se necessário.

@Injectable()
export class AccountsPayableService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // CRUD PRINCIPAL
  // ============================================================

  async create(companyId: string, dto: CreateApDto, userId: string) {
    if (dto.totalInstallments && dto.totalInstallments > 1) {
      return this.createInstallments(companyId, dto, userId);
    }
    return this.prisma.accountsPayable.create({
      data: this.mapCreateData(companyId, dto, userId),
    });
  }

  async findAll(companyId: string, filters: FilterAPDto) {
    const where = this.buildWhere(companyId, filters);
    const [data, total] = await Promise.all([
      this.prisma.accountsPayable.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }],
        include: { payments: { orderBy: { paidAt: 'desc' }, take: 1 } },
      }),
      this.prisma.accountsPayable.count({ where }),
    ]);
    const summary = await this.buildSummary(companyId, filters.competenceMonth);
    return { data, total, summary };
  }

  async findOne(companyId: string, id: string) {
    const ap = await this.prisma.accountsPayable.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
    if (!ap) throw new NotFoundException('Título não encontrado.');
    return ap;
  }

  async update(companyId: string, id: string, dto: UpdateApDto, userId: string) {
    await this.findOne(companyId, id);
    // Remove campos que não existem no UpdateApDto do Prisma se vier status
    // O status usa APStatus no AccountsPayable, não ApEntryStatus
    const { status, ...rest } = dto as any;
    return this.prisma.accountsPayable.update({
      where: { id },
      data: {
        ...rest,
        ...(status ? { status } : {}),
        updatedById: userId,
        updatedAt:   new Date(),
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.accountsPayable.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  }

  // ============================================================
  // PAGAMENTOS
  // ============================================================

  async pay(companyId: string, id: string, dto: PayAPDto, userId: string) {
    const ap = await this.findOne(companyId, id);

    // AccountsPayable.status usa APStatus ('OPEN','PARTIAL','PAID','OVERDUE','CANCELLED')
    if (ap.status === 'PAID') {
      throw new BadRequestException('Título já está totalmente pago.');
    }
    if (ap.status === 'CANCELLED') {
      throw new BadRequestException('Título cancelado não pode ser baixado.');
    }

    const payAmount       = new Prisma.Decimal(dto.amount);
    const discountApplied = dto.discountApplied ? new Prisma.Decimal(dto.discountApplied) : new Prisma.Decimal(0);
    const interestApplied = dto.interestApplied ? new Prisma.Decimal(dto.interestApplied) : new Prisma.Decimal(0);
    const fineApplied     = dto.fineApplied     ? new Prisma.Decimal(dto.fineApplied)     : new Prisma.Decimal(0);

    const newPaidTotal = new Prisma.Decimal(ap.paidAmount).plus(payAmount);
    const remainingNet = new Prisma.Decimal(ap.netAmount).minus(new Prisma.Decimal(ap.discountAmount));

    // APStatus (do AccountsPayable) tem PARTIAL, não PARTIALLY_PAID
    const newStatus = newPaidTotal.greaterThanOrEqualTo(remainingNet) ? 'PAID' : 'PARTIAL';

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.aPPayment.create({
        data: {
          accountsPayableId: id,
          paidAt:            new Date(dto.paidAt),
          amount:            payAmount,
          discountApplied,
          interestApplied,
          fineApplied,
          paymentMethod:     dto.paymentMethod as PaymentMethod,
          bankAccount:       dto.bankAccount,
          receiptRef:        dto.receiptRef,
          notes:             dto.notes,
          createdById:       userId,
        },
      });

      const updated = await tx.accountsPayable.update({
        where: { id },
        data: {
          paidAmount:       newPaidTotal,
          status:           newStatus as any, // APStatus literal
          statusUpdatedAt: new Date(),
          interestAmount:   new Prisma.Decimal(ap.interestAmount).plus(interestApplied),
          fineAmount:       new Prisma.Decimal(ap.fineAmount).plus(fineApplied),
          updatedById:      userId,
        },
      });

      // Sincroniza AgendaEvent se vinculado e quitado
      if (ap.agendaEventId && newStatus === 'PAID') {
        await tx.agendaEvent
          .update({
            where: { id: ap.agendaEventId },
            data:  { isPaid: true, paidAt: new Date(dto.paidAt) },
          })
          .catch(() => {});
      }

      // AuditLog — campos corretos conforme schema do projeto
      await tx.auditLog.create({
        data: {
          actorId:  userId,
          action:   'PAY_AP',
          targetId:  id,
          before:   null,
          after:    { paymentId: payment.id, amount: dto.amount, status: newStatus } as any,
          ip:       null,
        },
      });

      return { title: updated, payment };
    });
  }

  async batchPay(companyId: string, dto: BatchPayAPDto, userId: string) {
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const item of dto.items) {
      try {
        await this.pay(companyId, item.id, {
          paidAt:          item.paidAt,
          amount:          item.amount,
          paymentMethod:   item.paymentMethod,
          discountApplied: item.discountApplied,
          receiptRef:      item.receiptRef,
        } as PayAPDto, userId);
        results.push({ id: item.id, success: true });
      } catch (e: any) {
        results.push({ id: item.id, success: false, error: e.message });
      }
    }

    return {
      results,
      succeeded: results.filter(r => r.success).length,
      failed:    results.filter(r => !r.success).length,
      total:     dto.items.length,
    };
  }

  async cancel(companyId: string, id: string, reason: string, userId: string) {
    const ap = await this.findOne(companyId, id);
    if (ap.status === 'PAID') {
      throw new BadRequestException('Títulos pagos não podem ser cancelados.');
    }
    return this.prisma.accountsPayable.update({
      where: { id },
      data: {
        status:           'CANCELLED' as any,
        notes:             reason,
        statusUpdatedAt:  new Date(),
        updatedById:       userId,
      },
    });
  }

  // ============================================================
  // RELATÓRIO DE POSIÇÃO / AGING
  // ============================================================

  async getPositionReport(companyId: string, refDate?: string) {
    const ref = refDate ? new Date(refDate) : new Date();

    // APStatus (AccountsPayable): OPEN | PARTIAL | PAID | OVERDUE | CANCELLED
    const openStatuses = ['OPEN', 'PARTIAL', 'OVERDUE'] as any[];

    const all = await this.prisma.accountsPayable.findMany({
      where: { companyId, deletedAt: null, status: { in: openStatuses } },
      orderBy: { dueDate: 'asc' },
    });

    const mkBucket = () => ({ titles: [] as typeof all, total: new Prisma.Decimal(0) });
    const buckets = {
      overdue90plus: mkBucket(), overdue60_90: mkBucket(),
      overdue30_60:  mkBucket(), overdue1_30:  mkBucket(),
      dueToday:      mkBucket(), due7:         mkBucket(),
      due30:         mkBucket(), dueFuture:    mkBucket(),
    };

    let grandTotal = new Prisma.Decimal(0);

    for (const ap of all) {
      const remaining = new Prisma.Decimal(ap.netAmount).minus(ap.paidAmount);
      const diffDays  = Math.floor((ap.dueDate.getTime() - ref.getTime()) / 86400000);
      grandTotal = grandTotal.plus(remaining);

      const b =
        diffDays < -90 ? 'overdue90plus' :
        diffDays < -60 ? 'overdue60_90'  :
        diffDays < -30 ? 'overdue30_60'  :
        diffDays < 0   ? 'overdue1_30'   :
        diffDays === 0 ? 'dueToday'      :
        diffDays <= 7  ? 'due7'          :
        diffDays <= 30 ? 'due30'         : 'dueFuture';

      buckets[b].titles.push(ap);
      buckets[b].total = buckets[b].total.plus(remaining);
    }

    // Top fornecedores
    const bySupplier: Record<string, Prisma.Decimal> = {};
    for (const ap of all) {
      const key = ap.supplierName ?? ap.supplierCnpj ?? 'Sem fornecedor';
      bySupplier[key] = (bySupplier[key] ?? new Prisma.Decimal(0))
        .plus(new Prisma.Decimal(ap.netAmount).minus(ap.paidAmount));
    }
    const topSuppliers = Object.entries(bySupplier)
      .sort(([, a], [, b]) => b.minus(a).toNumber())
      .slice(0, 10)
      .map(([name, total]) => ({ name, total: total.toString() }));

    // Por categoria
    const byCategory: Record<string, Prisma.Decimal> = {};
    for (const ap of all) {
      const key = ap.categoryTag ?? String(ap.origin ?? 'OUTROS');
      byCategory[key] = (byCategory[key] ?? new Prisma.Decimal(0))
        .plus(new Prisma.Decimal(ap.netAmount).minus(ap.paidAmount));
    }

    return {
      refDate:     ref.toISOString(),
      grandTotal:  grandTotal.toString(),
      totalTitles: all.length,
      buckets:     Object.fromEntries(
        Object.entries(buckets).map(([k, v]) => [k, { count: v.titles.length, total: v.total.toString() }]),
      ),
      topSuppliers,
      byCategory: Object.entries(byCategory).map(([name, total]) => ({ name, total: total.toString() })),
    };
  }

  // ============================================================
  // HELPERS PRIVADOS
  // ============================================================

  private buildWhere(companyId: string, filters: FilterAPDto): Prisma.AccountsPayableWhereInput {
    const now  = new Date();
    const end7 = new Date(now); end7.setDate(end7.getDate() + 7);
    const end30= new Date(now); end30.setDate(end30.getDate() + 30);

    const where: Prisma.AccountsPayableWhereInput = { companyId, deletedAt: null };

    // APStatus usa string literals — cast direto via any
    if (filters.status)          where.status          = filters.status as any;
    if (filters.origin)          where.origin          = filters.origin;
    if (filters.competenceMonth) where.competenceMonth = filters.competenceMonth;
    if (filters.categoryTag)     where.categoryTag     = filters.categoryTag;

    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {
        ...(filters.dueDateFrom ? { gte: new Date(filters.dueDateFrom) } : {}),
        ...(filters.dueDateTo   ? { lte: new Date(filters.dueDateTo)   } : {}),
      };
    }

    if (filters.search) {
      where.OR = [
        { title:          { contains: filters.search, mode: 'insensitive' } },
        { supplierName:   { contains: filters.search, mode: 'insensitive' } },
        { documentNumber: { contains: filters.search } },
        { supplierCnpj:   { contains: filters.search } },
      ];
    }

    if (filters.aging) {
      const openForAging = ['OPEN', 'PARTIAL'] as any[];
      switch (filters.aging) {
        case 'overdue': where.dueDate = { lt: now };          where.status = { in: openForAging }; break;
        case 'today':   where.dueDate = { gte: new Date(now.toDateString()), lt: new Date(new Date(now.toDateString()).getTime() + 86400000) }; break;
        case 'week':    where.dueDate = { gte: now, lte: end7 };  break;
        case 'month':   where.dueDate = { gte: now, lte: end30 }; break;
        case 'future':  where.dueDate = { gt: end30 };            break;
      }
    }

    return where;
  }

  private mapCreateData(companyId: string, dto: CreateApDto, userId: string) {
    return {
      companyId,
      title:             dto.title,
      description:       dto.description,
      origin:            dto.origin ?? 'MANUAL',
      documentNumber:    dto.documentNumber,
      barCode:           dto.barCode,
      supplierCnpj:      dto.supplierCnpj,
      supplierName:      dto.supplierName,
      grossAmount:       new Prisma.Decimal(dto.grossAmount),
      discountAmount:    dto.discountAmount ? new Prisma.Decimal(dto.discountAmount) : new Prisma.Decimal(0),
      netAmount:         new Prisma.Decimal(dto.netAmount),
      issueDate:         new Date(dto.issueDate),
      dueDate:           new Date(dto.dueDate),
      competenceMonth:   dto.competenceMonth,
      installmentNumber: dto.installmentNumber ?? 1,
      totalInstallments: dto.totalInstallments ?? 1,
      expenseAccountId:  dto.expenseAccountId,
      costCenter:        dto.costCenter,
      categoryTag:       dto.categoryTag,
      fiscalDocumentId:  dto.fiscalDocumentId,
      notes:             dto.notes,
      createdById:       userId,
    };
  }

  private async createInstallments(companyId: string, dto: CreateApDto, userId: string) {
    const total  = dto.totalInstallments!;
    const amount = new Prisma.Decimal(dto.netAmount).dividedBy(total).toDecimalPlaces(2);

    const titles = Array.from({ length: total }, (_, i) => {
      const dueDate = new Date(dto.dueDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      return {
        ...this.mapCreateData(companyId, dto, userId),
        title:             `${dto.title} (${i + 1}/${total})`,
        netAmount:          amount,
        grossAmount:        amount,
        dueDate,
        installmentNumber:  i + 1,
        totalInstallments:  total,
      };
    });

    const [first, ...rest] = titles;
    const parent = await this.prisma.accountsPayable.create({ data: first });

    if (rest.length > 0) {
      await this.prisma.accountsPayable.createMany({
        data: rest.map(t => ({ ...t, parentId: parent.id })),
      });
    }

    return { parent, installments: total };
  }

  private async buildSummary(companyId: string, competenceMonth?: string) {
    const now  = new Date();
    const base: Prisma.AccountsPayableWhereInput = {
      companyId, deletedAt: null,
      ...(competenceMonth ? { competenceMonth } : {}),
    };
    const openStatuses = ['OPEN', 'PARTIAL'] as any[];

    const [open, overdue, dueWeek, paidMonth, totalOpenAgg, overdueAgg] = await Promise.all([
      this.prisma.accountsPayable.count({ where: { ...base, status: { in: openStatuses } } }),
      this.prisma.accountsPayable.count({ where: { ...base, status: { in: openStatuses }, dueDate: { lt: now } } }),
      this.prisma.accountsPayable.count({ where: { ...base, status: { in: openStatuses }, dueDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } } }),
      this.prisma.accountsPayable.count({ where: { ...base, status: 'PAID' as any } }),
      this.prisma.accountsPayable.aggregate({ where: { ...base, status: { in: openStatuses } }, _sum: { netAmount: true, paidAmount: true } }),
      this.prisma.accountsPayable.aggregate({ where: { ...base, status: { in: openStatuses }, dueDate: { lt: now } }, _sum: { netAmount: true } }),
    ]);

    return {
      open,
      overdue,
      dueWeek,
      paidMonth,
      totalOpen:    Number(totalOpenAgg._sum.netAmount ?? 0) - Number(totalOpenAgg._sum.paidAmount ?? 0),
      totalOverdue: Number(overdueAgg._sum.netAmount ?? 0),
    };
  }
}