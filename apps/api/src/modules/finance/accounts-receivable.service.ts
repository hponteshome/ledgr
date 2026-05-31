// apps/api/src/modules/finance/accounts-receivable.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ArEntryStatus, PaymentMethod, Prisma } from '@prisma/client';

@Injectable()
export class AccountsReceivableService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: any, userId: string) {
    return this.prisma.arEntry.create({
      data: {
        companyId,
        title:          dto.title,
        description:    dto.description ?? null,
        documentNumber: dto.documentNumber ?? null,
        origin:         dto.origin ?? 'MANUAL',
        issueDate:      dto.issueDate ? new Date(dto.issueDate) : null,
        dueDate:        new Date(dto.dueDate),
        competenceMonth: dto.competenceMonth ?? null,
        amount:         new Prisma.Decimal(dto.amount),
        customerName:    dto.customerName ?? null,
        customerCnpjCpf: dto.customerCnpjCpf ?? null,
        customerId:      dto.customerId ?? null,
        propertyId:      dto.propertyId ?? null,
        fiscalDocumentId: dto.fiscalDocumentId ?? null,
        revenueAccountId: dto.revenueAccountId ?? null,
        fixedAssetId:    dto.fixedAssetId ?? null,
        notes:           dto.notes ?? null,
        createdById:     userId,
      },
    });
  }

  async findAll(companyId: string, filters: any) {
    // Atualizar status OVERDUE automaticamente a cada listagem
    await this.markOverdue(companyId);
    const where: any = { companyId, deletedAt: null };
    if (filters.status)     where.status = filters.status;
    if (filters.origin)     where.origin = filters.origin;
    if (filters.propertyId) where.propertyId = filters.propertyId;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.from || filters.to) {
      where.dueDate = {};
      if (filters.from) where.dueDate.gte = new Date(filters.from);
      if (filters.to)   where.dueDate.lte = new Date(filters.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.arEntry.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        include: {
          customer: { select: { id: true, fullName: true, cpf: true } },
          property:   { select: { id: true, street: true, number: true, city: true } },
          fixedAsset: { select: { id: true, internalCode: true, description: true, city: true, street: true } },
          payments: true,
        },
      }),
      this.prisma.arEntry.count({ where }),
    ]);

    const totalAmount    = data.reduce((s, r) => s + Number(r.amount), 0);
    const totalReceived  = data.reduce((s, r) => s + Number(r.receivedAmount), 0);
    const totalPending   = totalAmount - totalReceived;

    return { data, total, totalAmount, totalReceived, totalPending };
  }

  async findOne(companyId: string, id: string) {
    const entry = await this.prisma.arEntry.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        customer:   true,
        property:   true,
        fixedAsset: true,
        payments: { orderBy: { receivedAt: 'desc' } },
      },
    });
    if (!entry) throw new NotFoundException('Conta a receber nao encontrada.');
    return entry;
  }

  async update(companyId: string, id: string, dto: any, userId: string) {
    await this.findOne(companyId, id);
    return this.prisma.arEntry.update({
      where: { id },
      data: {
        title:           dto.title,
        description:     dto.description,
        dueDate:         dto.dueDate ? new Date(dto.dueDate) : undefined,
        amount:          dto.amount ? new Prisma.Decimal(dto.amount) : undefined,
        customerName:    dto.customerName,
        customerCnpjCpf: dto.customerCnpjCpf,
        customerId:      dto.customerId,
        propertyId:      dto.propertyId,
        fixedAssetId:    dto.fixedAssetId,
        notes:           dto.notes,
        updatedById:     userId,
      },
    });
  }

  async receive(companyId: string, id: string, dto: any, userId: string) {
    const entry = await this.findOne(companyId, id);
    if (entry.status === 'RECEIVED') throw new BadRequestException('Conta ja recebida.');
    if (entry.status === 'CANCELLED') throw new BadRequestException('Conta cancelada.');

    const amount = new Prisma.Decimal(dto.amount);
    const newReceived = new Prisma.Decimal(entry.receivedAmount).plus(amount);
    const isFullyReceived = newReceived.gte(new Prisma.Decimal(entry.amount));

    return this.prisma.$transaction(async (tx) => {
      await tx.aRPayment.create({
        data: {
          arEntryId:      id,
          receivedAt:     new Date(dto.receivedAt),
          amount,
          discountApplied: dto.discount ? new Prisma.Decimal(dto.discount) : new Prisma.Decimal(0),
          interestApplied: dto.interest ? new Prisma.Decimal(dto.interest) : new Prisma.Decimal(0),
          fineApplied:    dto.fine ? new Prisma.Decimal(dto.fine) : new Prisma.Decimal(0),
          paymentMethod:  dto.paymentMethod ?? 'PIX',
          bankAccount:    dto.bankAccount ?? null,
          receiptRef:     dto.receiptRef ?? null,
          notes:          dto.notes ?? null,
          createdById:    userId,
        },
      });

      // Integração contábil: D Caixa/Banco / C Receita (se revenueAccountId configurado)
      const receivingAccountId = dto.receivingAccountId ?? null;
      if (receivingAccountId && entry.revenueAccountId) {
        await tx.journalEntry.create({
          data: {
            companyId,
            date:         new Date(dto.receivedAt),
            description:  Recebimento: ,
            sourceModule: 'FINANCE',
            createdById:  userId,
            items: {
              create: [
                { accountId: receivingAccountId,   value: amount, type: 'DEBIT'  },
                { accountId: entry.revenueAccountId, value: amount, type: 'CREDIT' },
              ],
            },
          },
        });
      }

      return tx.arEntry.update({
        where: { id },
        data: {
          receivedAmount: newReceived,
          status:         isFullyReceived ? 'RECEIVED' : 'PARTIAL',
          receivedAt:     isFullyReceived ? new Date(dto.receivedAt) : null,
          updatedById:    userId,
          ...(dto.nfNumero ? { documentNumber: dto.nfNumero } : {}),
        },
      });
    });
  }

  // Marca títulos vencidos automaticamente
  async markOverdue(companyId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return this.prisma.arEntry.updateMany({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ['OPEN', 'PARTIAL'] },
        dueDate: { lt: today },
      },
      data: { status: 'OVERDUE' },
    });
  }

  async cancel(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    return this.prisma.arEntry.update({
      where: { id },
      data: { status: 'CANCELLED', updatedById: userId },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.arEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async aging(companyId: string) {
    const entries = await this.prisma.arEntry.findMany({
      where: { companyId, deletedAt: null, status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
    });
    const today = new Date();
    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    for (const e of entries) {
      const diff = Math.floor((today.getTime() - new Date(e.dueDate).getTime()) / 86400000);
      const pending = Number(e.amount) - Number(e.receivedAmount);
      if (diff <= 0)       buckets.current += pending;
      else if (diff <= 30) buckets.days30  += pending;
      else if (diff <= 60) buckets.days60  += pending;
      else if (diff <= 90) buckets.days90  += pending;
      else                 buckets.over90  += pending;
    }
    return buckets;
  }
}