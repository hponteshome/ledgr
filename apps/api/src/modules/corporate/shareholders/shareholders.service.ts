// apps/api/src/modules/corporate/shareholders/shareholders.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateShareholderDto } from './dto/create-shareholder.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ShareholdersService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, query: { entryType?: string; active?: boolean }) {
    return this.prisma.shareholderRecord.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(query.entryType ? { entryType: query.entryType as any } : {}),
        ...(query.active !== undefined ? { isActive: query.active } : {}),
      },
      include: { person: { select: { id: true, cpf: true, fullName: true } } },
      orderBy: [{ shareType: 'asc' }, { holderName: 'asc' }],
    });
  }

  async findOne(companyId: string, id: string) {
    const record = await this.prisma.shareholderRecord.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        person: true,
        transfersAsFrom: {
          include: { toRecord: { select: { holderName: true, holderTaxId: true } } },
          orderBy: { transferDate: 'desc' },
          take: 20,
        },
        transfersAsTo: {
          include: { fromRecord: { select: { holderName: true, holderTaxId: true } } },
          orderBy: { transferDate: 'desc' },
          take: 20,
        },
      },
    });
    if (!record) throw new NotFoundException('Registro de acionista não encontrado');
    return record;
  }

  async create(companyId: string, userId: string, dto: CreateShareholderDto) {
    // Valida que não há duplicata ativa para o mesmo titular + tipo de ação + série
    const existing = await this.prisma.shareholderRecord.findFirst({
      where: {
        companyId,
        holderTaxId: dto.holderTaxId,
        shareType: dto.shareType as any,
        series: dto.series ?? null,
        isActive: true,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Já existe registro ativo para ${dto.holderTaxId} com tipo ${dto.shareType}${dto.series ? ' série ' + dto.series : ''}. Use transferência ou atualize o registro existente.`
      );
    }

    const totalValue = new Decimal(dto.quantity).mul(new Decimal(dto.nominalValue));

    return this.prisma.shareholderRecord.create({
      data: {
        companyId,
        entryType: dto.entryType as any,
        holderName: dto.holderName,
        holderTaxId: dto.holderTaxId,
        holderType: dto.holderType ?? 'PF',
        personId: dto.personId,
        address: dto.address,
        shareType: dto.shareType as any,
        series: dto.series,
        quantity: dto.quantity,
        nominalValue: dto.nominalValue,
        totalValue,
        percentOwned: dto.percentOwned,
        subscriptionDate: dto.subscriptionDate ? new Date(dto.subscriptionDate) : null,
        integralizationDate: dto.integralizationDate ? new Date(dto.integralizationDate) : null,
        paidInAmount: dto.paidInAmount ?? 0,
        isFullyPaid: dto.isFullyPaid ?? false,
        hasEncumbrance: dto.hasEncumbrance ?? false,
        encumbranceDesc: dto.encumbranceDesc,
        isPledged: dto.isPledged ?? false,
        shareNumberFrom: dto.shareNumberFrom,
        shareNumberTo: dto.shareNumberTo,
        certificateNumber: dto.certificateNumber,
        notes: dto.notes,
        bookId: dto.bookId,
        createdById: userId,
      },
    });
  }

  async update(companyId: string, id: string, dto: Partial<CreateShareholderDto>) {
    await this.findOne(companyId, id);
    const totalValue = dto.quantity && dto.nominalValue
      ? new Decimal(dto.quantity).mul(new Decimal(dto.nominalValue))
      : undefined;

    return this.prisma.shareholderRecord.update({
      where: { id },
      data: {
        ...(dto.holderName && { holderName: dto.holderName }),
        ...(dto.address && { address: dto.address }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.nominalValue !== undefined && { nominalValue: dto.nominalValue }),
        ...(totalValue && { totalValue }),
        ...(dto.percentOwned !== undefined && { percentOwned: dto.percentOwned }),
        ...(dto.paidInAmount !== undefined && { paidInAmount: dto.paidInAmount }),
        ...(dto.isFullyPaid !== undefined && { isFullyPaid: dto.isFullyPaid }),
        ...(dto.hasEncumbrance !== undefined && { hasEncumbrance: dto.hasEncumbrance }),
        ...(dto.encumbranceDesc !== undefined && { encumbranceDesc: dto.encumbranceDesc }),
        ...(dto.isPledged !== undefined && { isPledged: dto.isPledged }),
        ...(dto.certificateNumber && { certificateNumber: dto.certificateNumber }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async softDelete(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.shareholderRecord.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /** Resumo do capital social para o cabeçalho do livro */
  async getCapitalSummary(companyId: string) {
    const records = await this.prisma.shareholderRecord.findMany({
      where: { companyId, isActive: true, deletedAt: null },
    });

    const totalShares = records.reduce((s, r) => s + Number(r.quantity), 0);
    const totalCapital = records.reduce((s, r) => s + Number(r.totalValue), 0);
    const byType = records.reduce((acc, r) => {
      const key = r.shareType;
      if (!acc[key]) acc[key] = { quantity: 0, value: 0, holders: 0 };
      acc[key].quantity += Number(r.quantity);
      acc[key].value += Number(r.totalValue);
      acc[key].holders += 1;
      return acc;
    }, {} as Record<string, { quantity: number; value: number; holders: number }>);

    return { totalShares, totalCapital, byType, holdersCount: records.length };
  }
}