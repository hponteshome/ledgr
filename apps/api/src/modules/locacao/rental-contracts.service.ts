// apps/api/src/modules/locacao/rental-contracts.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma, DocumentType, DocumentStatus, DocumentVisibility } from '@prisma/client';
import { CreateRentalContractDto, UpdateRentalContractDto } from './dto/rental-contract.dto';
import * as crypto from 'crypto';
import * as Handlebars from 'handlebars';
import { valorPorExtenso } from './utils/extenso.util';
import {
  formatDateBR,
  formatDateExtenso,
  formatCurrencyBRL,
  formatCep,
  formatCpfCnpj,
  monthsBetween,
  maritalStatusLabel,
  guaranteeTypeLabel,
  readjustmentIndexLabel,
} from './utils/contract-format.util';

function toDecimal(value: number | string | undefined | null): Prisma.Decimal | undefined {
  if (value === undefined || value === null || (value as any) === '') return undefined;
  const normalized = String(value).replace(',', '.');
  return new Prisma.Decimal(normalized);
}

function toDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  // Campos DATE-only (sem hora): o driver pg le/grava usando getters LOCAIS do
  // processo Node (documentado em node-postgres), nao UTC. Construir via
  // new Date(ano, mes-1, dia) (construtor local) garante que o dia gravado no
  // Postgres seja exatamente o dia pretendido, independente do fuso do processo
  // (desde que TZ esteja fixado corretamente - ver main.ts).
  const parts = value.split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
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
    if (found.documentId) {
      const doc = await this.prisma.document.findUnique({
        where: { id: found.documentId },
        select: { id: true, status: true, currentVersion: true },
      });
      return { ...found, document: doc };
    }
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
        tenantRg: dto.tenantRg,
        tenantProfession: dto.tenantProfession,
        tenantMaritalStatus: dto.tenantMaritalStatus,
        tenantNationality: dto.tenantNationality,
        tenantStreet: dto.tenantStreet,
        tenantNumber: dto.tenantNumber,
        tenantComplement: dto.tenantComplement,
        tenantNeighborhood: dto.tenantNeighborhood,
        tenantCity: dto.tenantCity,
        tenantState: dto.tenantState,
        tenantZipCode: dto.tenantZipCode,
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
        tenantRg: dto.tenantRg,
        tenantProfession: dto.tenantProfession,
        tenantMaritalStatus: dto.tenantMaritalStatus,
        tenantNationality: dto.tenantNationality,
        tenantStreet: dto.tenantStreet,
        tenantNumber: dto.tenantNumber,
        tenantComplement: dto.tenantComplement,
        tenantNeighborhood: dto.tenantNeighborhood,
        tenantCity: dto.tenantCity,
        tenantState: dto.tenantState,
        tenantZipCode: dto.tenantZipCode,
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

  async generateDocument(companyId: string, userId: string, id: string) {
    const contract = await this.prisma.rentalContract.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { fixedAsset: true, company: true },
    });
    if (!contract) throw new NotFoundException('Contrato de locacao nao encontrado.');

    let template = await this.prisma.documentTemplate.findFirst({
      where: { type: DocumentType.CONTRATO_LOCACAO, isActive: true, companyId },
    });
    if (!template) {
      template = await this.prisma.documentTemplate.findFirst({
        where: { type: DocumentType.CONTRATO_LOCACAO, isActive: true, companyId: null },
      });
    }
    if (!template) {
      throw new NotFoundException('Nenhum template ativo de Contrato de Locacao encontrado.');
    }

    let existingDoc: { id: string; status: string; currentVersion: number } | null = null;
    if (contract.documentId) {
      existingDoc = await this.prisma.document.findUnique({
        where: { id: contract.documentId },
        select: { id: true, status: true, currentVersion: true },
      });
      if (existingDoc && existingDoc.status !== 'RASCUNHO') {
        throw new BadRequestException(
          `Este contrato ja possui um documento com status ${existingDoc.status}. Nao e possivel gerar novamente. Para reiniciar, exclua o documento em Arquivos Digitais primeiro.`,
        );
      }
    }

    const isFianca = contract.guaranteeType === 'FIANCA';
    const rentAmountNumber = Number(contract.rentAmount);

    const dados = {
      empresa: {
        legalName: contract.company.legalName,
        taxId: formatCpfCnpj(contract.company.taxId),
        street: contract.company.street,
        number: contract.company.number,
        complement: contract.company.complement,
        neighborhood: contract.company.neighborhood,
        city: contract.company.city,
        state: contract.company.state,
        zipCode: formatCep(contract.company.zipCode),
      },
      contrato: {
        tenantName: contract.tenantName,
        tenantNationality: contract.tenantNationality,
        tenantMaritalStatus: maritalStatusLabel(contract.tenantMaritalStatus),
        tenantProfession: contract.tenantProfession,
        tenantRg: contract.tenantRg,
        tenantTaxId: formatCpfCnpj(contract.tenantTaxId),
        tenantStreet: contract.tenantStreet,
        tenantNumber: contract.tenantNumber,
        tenantComplement: contract.tenantComplement,
        tenantNeighborhood: contract.tenantNeighborhood,
        tenantZipCode: formatCep(contract.tenantZipCode),
        tenantCity: contract.tenantCity,
        tenantState: contract.tenantState,
        prazoMeses: monthsBetween(contract.startDate, contract.endDate),
        startDate: formatDateBR(contract.startDate),
        endDate: formatDateBR(contract.endDate),
        rentAmount: formatCurrencyBRL(rentAmountNumber),
        rentAmountExtenso: valorPorExtenso(rentAmountNumber),
        dueDay: contract.dueDay,
        readjustmentPeriodMonths: contract.readjustmentPeriodMonths,
        readjustmentIndex: readjustmentIndexLabel(contract.readjustmentIndex, contract.readjustmentIndexOther),
        guaranteeType: guaranteeTypeLabel(contract.guaranteeType),
        isFianca,
        guaranteeDescription: contract.guaranteeDescription,
        penaltyDescription: contract.penaltyDescription,
        numeroVias: isFianca ? 3 : 2,
        dataAssinatura: formatDateExtenso(new Date()),
      },
      imovel: {
        street: contract.fixedAsset.street,
        number: contract.fixedAsset.number,
        complement: contract.fixedAsset.complement,
        neighborhood: contract.fixedAsset.neighborhood,
        city: contract.fixedAsset.city,
        state: contract.fixedAsset.state,
        zipCode: formatCep(contract.fixedAsset.zipCode),
        registryNumber: contract.fixedAsset.registryNumber,
        registryOffice: contract.fixedAsset.registryOffice,
      },
    };

    const compiled = Handlebars.compile(template.content);
    const html = compiled(dados);
    const contentHash = crypto.createHash('sha256').update(html).digest('hex');

    const ddmmyy = (d: Date) => {
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yy = String(d.getUTCFullYear()).slice(-2);
      return `${dd}${mm}${yy}`;
    };
    const inicio = ddmmyy(contract.startDate);
    const fim = contract.endDate ? ddmmyy(contract.endDate) : 'indeterminado';
    const documentTitle = `Locação_${contract.fixedAsset.internalCode}_${inicio}a${fim}.pdf`;

    let document;
    if (existingDoc) {
      const newVersion = existingDoc.currentVersion + 1;
      await this.prisma.documentVersion.create({
        data: {
          documentId: existingDoc.id,
          version: newVersion,
          content: html,
          contentHash,
          changeNote: `Contrato regerado a partir dos dados atuais - v${newVersion}`,
          createdById: userId,
        },
      });
      document = await this.prisma.document.update({
        where: { id: existingDoc.id },
        data: { title: documentTitle, content: html, contentHash, currentVersion: newVersion, updatedAt: new Date() },
      });
      await this.prisma.rentalContract.update({
        where: { id: contract.id },
        data: { updatedById: userId },
      });
    } else {
      document = await this.prisma.document.create({
        data: {
          companyId,
          type: DocumentType.CONTRATO_LOCACAO,
          status: DocumentStatus.RASCUNHO,
          visibility: DocumentVisibility.RESERVADO,
          title: documentTitle,
          date: new Date(),
          content: html,
          contentHash,
          createdById: userId,
        },
      });
      await this.prisma.rentalContract.update({
        where: { id: contract.id },
        data: { documentId: document.id, updatedById: userId },
      });
    }

    return document;
  }

  async prepareSigners(companyId: string, id: string) {
    const contract = await this.findOne(companyId, id);
    if (!contract.documentId) {
      throw new BadRequestException('Este contrato ainda nao possui um documento gerado.');
    }
    const existing = await this.prisma.documentSigner.findMany({
      where: { documentId: contract.documentId },
    });
    if (existing.length > 0) {
      return existing;
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const locador = await this.prisma.documentSigner.create({
      data: {
        documentId: contract.documentId,
        name: company?.legalName ?? '',
        cpf: (company?.taxId ?? '').replace(/\D/g, '') || null,
        role: 'LOCADOR',
        order: 1,
      },
    });
    const locatario = await this.prisma.documentSigner.create({
      data: {
        documentId: contract.documentId,
        name: contract.tenantName,
        cpf: (contract.tenantTaxId ?? '').replace(/\D/g, '') || null,
        role: 'LOCATARIO',
        order: 2,
      },
    });
    return [locador, locatario];
  }

  async prepareSignersByDocument(companyId: string, documentId: string) {
    const contract = await this.prisma.rentalContract.findFirst({
      where: { documentId, companyId, deletedAt: null },
    });
    if (!contract) throw new NotFoundException('Contrato nao encontrado para este documento.');
    return this.prepareSigners(companyId, contract.id);
  }
}