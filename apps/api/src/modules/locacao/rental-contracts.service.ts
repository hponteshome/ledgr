// apps/api/src/modules/locacao/rental-contracts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRentalContractDto, UpdateRentalContractDto } from './dto/rental-contract.dto';

function toDecimal(value: number | string | undefined | null): Prisma.Decimal | undefined {
  if (value === undefined || value === null || (value as any) === '') return undefined;
  const normalized = String(value).replace(',', '.');
  return new Prisma.Decimal(normalized);
}

function toDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  return new Date(value);
}

@Injectable()
export class RentalContractsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, status?: string) {
    return this.prisma.rentalContract.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        fixedAsset: { select: { id: true, description: true, internalCode: true } },
        tenant: { select: { id: true, fullName: true, cpf: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const found = await this.prisma.rentalContract.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { fixedAsset: true, tenant: true },
    });
    if (!found) throw new NotFoundException('Contrato de locacao nao encontrado.');
    return found;
  }

  async create(companyId: string, userId: string, dto: CreateRentalContractDto) {
    return this.prisma.rentalContract.create({
      data: {
        companyId,
        createdById: userId,
        contractNumber: dto.contractNumber,
        fixedAssetId: dto.fixedAssetId,
        tenantId: dto.tenantId,
        tenantName: dto.tenantName,
        tenantTaxId: dto.tenantTaxId,
        startDate: toDate(dto.startDate)!,
        endDate: toDate(dto.endDate),
        rentAmount: toDecimal(dto.rentAmount)!,
        duePeriodicity: dto.duePeriodicity,
        dueDay: dto.dueDay,
        firstDueDate: toDate(dto.firstDueDate)!,
        explicitDueDates: dto.explicitDueDates,
        guaranteeType: dto.guaranteeType,
        guaranteeDescription: dto.guaranteeDescription,
        policyNumber: dto.policyNumber,
        policyStartDate: toDate(dto.policyStartDate),
        policyEndDate: toDate(dto.policyEndDate),
        policyCoverage: toDecimal(dto.policyCoverage),
        policyPremium: toDecimal(dto.policyPremium),
        readjustmentPeriodMonths: dto.readjustmentPeriodMonths,
        readjustmentIndex: dto.readjustmentIndex,
        readjustmentIndexOther: dto.readjustmentIndexOther,
        penaltyDescription: dto.penaltyDescription,
        penaltyReleaseDeadlineDays: dto.penaltyReleaseDeadlineDays,
        bonusDescription: dto.bonusDescription,
        bonusStartDate: toDate(dto.bonusStartDate),
        bonusEndDate: toDate(dto.bonusEndDate),
        hasIntermediary: dto.hasIntermediary ?? false,
        intermediaryType: dto.intermediaryType,
        intermediaryName: dto.intermediaryName,
        intermediaryTaxId: dto.intermediaryTaxId,
        intermediaryCreci: dto.intermediaryCreci,
        intermediaryManagesCollection: dto.intermediaryManagesCollection ?? false,
        intermediaryAdminFeeAmount: toDecimal(dto.intermediaryAdminFeeAmount),
        intermediaryCommissionPercent: toDecimal(dto.intermediaryCommissionPercent),
        status: dto.status,
        documentId: dto.documentId,
        notes: dto.notes,
      },
    });
  }

  async update(companyId: string, userId: string, id: string, dto: UpdateRentalContractDto) {
    await this.findOne(companyId, id);
    return this.prisma.rentalContract.update({
      where: { id },
      data: {
        updatedById: userId,
        contractNumber: dto.contractNumber,
        fixedAssetId: dto.fixedAssetId,
        tenantId: dto.tenantId,
        tenantName: dto.tenantName,
        tenantTaxId: dto.tenantTaxId,
        startDate: toDate(dto.startDate),
        endDate: toDate(dto.endDate),
        rentAmount: toDecimal(dto.rentAmount),
        duePeriodicity: dto.duePeriodicity,
        dueDay: dto.dueDay,
        firstDueDate: toDate(dto.firstDueDate),
        explicitDueDates: dto.explicitDueDates,
        guaranteeType: dto.guaranteeType,
        guaranteeDescription: dto.guaranteeDescription,
        policyNumber: dto.policyNumber,
        policyStartDate: toDate(dto.policyStartDate),
        policyEndDate: toDate(dto.policyEndDate),
        policyCoverage: toDecimal(dto.policyCoverage),
        policyPremium: toDecimal(dto.policyPremium),
        readjustmentPeriodMonths: dto.readjustmentPeriodMonths,
        readjustmentIndex: dto.readjustmentIndex,
        readjustmentIndexOther: dto.readjustmentIndexOther,
        penaltyDescription: dto.penaltyDescription,
        penaltyReleaseDeadlineDays: dto.penaltyReleaseDeadlineDays,
        bonusDescription: dto.bonusDescription,
        bonusStartDate: toDate(dto.bonusStartDate),
        bonusEndDate: toDate(dto.bonusEndDate),
        hasIntermediary: dto.hasIntermediary,
        intermediaryType: dto.intermediaryType,
        intermediaryName: dto.intermediaryName,
        intermediaryTaxId: dto.intermediaryTaxId,
        intermediaryCreci: dto.intermediaryCreci,
        intermediaryManagesCollection: dto.intermediaryManagesCollection,
        intermediaryAdminFeeAmount: toDecimal(dto.intermediaryAdminFeeAmount),
        intermediaryCommissionPercent: toDecimal(dto.intermediaryCommissionPercent),
        status: dto.status,
        documentId: dto.documentId,
        notes: dto.notes,
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.rentalContract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}