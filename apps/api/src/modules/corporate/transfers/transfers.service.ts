// apps/api/src/modules/corporate/transfers/transfers.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, query: { from?: string; to?: string; year?: number }) {
    const whereDate = query.year
      ? { transferDate: { gte: new Date(`${query.year}-01-01`), lt: new Date(`${query.year + 1}-01-01`) } }
      : {};

    return this.prisma.shareTransfer.findMany({
      where: {
        companyId,
        ...whereDate,
        ...(query.from ? { fromRecord: { holderTaxId: query.from } } : {}),
        ...(query.to ? { toRecord: { holderTaxId: query.to } } : {}),
      },
      include: {
        fromRecord: { select: { holderName: true, holderTaxId: true } },
        toRecord: { select: { holderName: true, holderTaxId: true } },
      },
      orderBy: { transferDate: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const t = await this.prisma.shareTransfer.findFirst({
      where: { id, companyId },
      include: {
        fromRecord: true,
        toRecord: true,
      },
    });
    if (!t) throw new NotFoundException('Transferência não encontrada');
    return t;
  }

  /**
   * Registra uma transferência e atualiza os saldos dos registros envolvidos.
   * Operação atômica via $transaction.
   */
  async create(companyId: string, userId: string, dto: CreateTransferDto) {
    const [fromRecord, toRecord] = await Promise.all([
      this.prisma.shareholderRecord.findFirst({ where: { id: dto.fromRecordId, companyId, deletedAt: null } }),
      this.prisma.shareholderRecord.findFirst({ where: { id: dto.toRecordId, companyId, deletedAt: null } }),
    ]);

    if (!fromRecord) throw new NotFoundException('Registro do cedente não encontrado');
    if (!toRecord) throw new NotFoundException('Registro do cessionário não encontrado');

    const qty = new Decimal(dto.quantity);

    if (new Decimal(fromRecord.quantity).lt(qty)) {
      throw new BadRequestException(
        `Cedente possui ${fromRecord.quantity} ${fromRecord.shareType} — transferência de ${dto.quantity} excede o saldo.`
      );
    }
    return this.prisma.$transaction(async (tx) => {
      // 1. Deduz do cedente
      const newFromQty = new Decimal(fromRecord.quantity).sub(qty);
      const newFromTotal = newFromQty.mul(new Decimal(fromRecord.nominalValue));
      await tx.shareholderRecord.update({
        where: { id: fromRecord.id },
        data: { quantity: newFromQty, totalValue: newFromTotal, isActive: newFromQty.gt(0) },
      });
      // 2. Adiciona ao cessionário
      const newToQty = new Decimal(toRecord.quantity).add(qty);
      const newToTotal = newToQty.mul(new Decimal(toRecord.nominalValue));
      await tx.shareholderRecord.update({
        where: { id: toRecord.id },
        data: { quantity: newToQty, totalValue: newToTotal, isActive: true },
      });
      // 3. Recalcular percentOwned de todos os titulares da empresa
      const allRecords = await tx.shareholderRecord.findMany({
        where: { companyId, deletedAt: null },
      });
      const totalQty = allRecords.reduce((s, r) => s.add(new Decimal(r.quantity)), new Decimal(0));
      if (totalQty.gt(0)) {
        await Promise.all(allRecords.map(r =>
          tx.shareholderRecord.update({
            where: { id: r.id },
            data: { percentOwned: new Decimal(r.quantity).div(totalQty).mul(100) },
          })
        ));
      }
      // 3. Registra a transferência
      return tx.shareTransfer.create({
        data: {
          companyId,
          entryType: dto.entryType as any,
          fromRecordId: dto.fromRecordId,
          toRecordId: dto.toRecordId,
          shareType: dto.shareType as any,
          series: dto.series,
          quantity: dto.quantity,
          nominalValue: dto.nominalValue,
          transferValue: dto.transferValue,
          shareNumberFrom: dto.shareNumberFrom,
          shareNumberTo: dto.shareNumberTo,
          transferDate: new Date(dto.transferDate),
          reason: dto.reason as any,
          instrumentType: dto.instrumentType,
          instrumentDate: dto.instrumentDate ? new Date(dto.instrumentDate) : null,
          notaryOffice: dto.notaryOffice,
          bookNumber: dto.bookNumber,
          pageNumber: dto.pageNumber,
          notes: dto.notes,
          bookId: dto.bookId,
          createdById: userId,
        },
        include: {
          fromRecord: { select: { holderName: true } },
          toRecord: { select: { holderName: true } },
        },
      });
    });
  }

  async averbar(companyId: string, id: string, userId: string) {
    const t = await this.findOne(companyId, id);
    if (t.averbacaoDate) throw new BadRequestException('Transferência já averbada');
    return this.prisma.shareTransfer.update({
      where: { id },
      data: { averbacaoDate: new Date(), averbacaoUserId: userId },
    });
  }
}
