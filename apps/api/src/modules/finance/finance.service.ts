// ============================================================
// LEDGR — src/modules/finance/finance.service.ts
// ============================================================
import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { IntegrationService } from './integration.service';
import { CreateFiscalDocumentDto } from './dto/create-fiscal-document.dto';
import { UpdateFiscalDocumentDto } from './dto/update-fiscal-document.dto';
import { FilterFiscalDocumentDto } from './dto/filter-fiscal-document.dto';
import { IntegrationStatus, Prisma } from '@prisma/client';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
  ) {}

  // ── Create ──────────────────────────────────────────────────
  async createFiscalDocument(companyId: string, dto: CreateFiscalDocumentDto, userId: string) {
    // 1. Duplicate check — chave de acesso NF-e
    if (dto.accessKey) {
      const existing = await this.prisma.fiscalDocument.findFirst({
        where: { accessKey: dto.accessKey, companyId, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException('Documento com esta chave de acesso já foi lançado.');
      }
    }

    // 2. Duplicate check — fornecedor + número + competência
    if (dto.documentNumber) {
      const dup = await this.prisma.fiscalDocument.findFirst({
        where: {
          companyId,
          issuerCnpj: dto.issuerCnpj,
          documentNumber: dto.documentNumber,
          competenceMonth: dto.competenceMonth,
          deletedAt: null,
        },
      });
      if (dup) {
        throw new ConflictException(
          'Documento com mesmo número, fornecedor e competência já cadastrado.',
        );
      }
    }

    // 3. Cria o documento e dispara integração em $transaction
    return this.integration.createWithIntegration(companyId, dto, userId);
  }

  // ── FindAll ─────────────────────────────────────────────────
  async findAll(companyId: string, filters: FilterFiscalDocumentDto) {
    const where: Prisma.FiscalDocumentWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (filters.documentType) where.documentType = filters.documentType;
    if (filters.competenceMonth) where.competenceMonth = filters.competenceMonth;
    if (filters.integrationStatus) where.integrationStatus = filters.integrationStatus;

    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {};
      if (filters.dueDateFrom) where.dueDate.gte = new Date(filters.dueDateFrom);
      if (filters.dueDateTo)   where.dueDate.lte = new Date(filters.dueDateTo);
    }

    if (filters.search) {
      where.OR = [
        { issuerName:     { contains: filters.search, mode: 'insensitive' } },
        { documentNumber: { contains: filters.search, mode: 'insensitive' } },
        { issuerCnpj:     { contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.fiscalDocument.findMany({
        where,
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.fiscalDocument.count({ where }),
    ]);

    // Métricas de resumo para os cards do dashboard
    const summary = await this.buildSummary(companyId, filters.competenceMonth);

    return { data, total, summary };
  }

  // ── FindOne ─────────────────────────────────────────────────
  async findOne(id: string, companyId: string) {
    const doc = await this.prisma.fiscalDocument.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Documento fiscal não encontrado.');
    return doc;
  }

  // ── Update ──────────────────────────────────────────────────
  async update(id: string, companyId: string, dto: UpdateFiscalDocumentDto) {
    await this.findOne(id, companyId);
    return this.prisma.fiscalDocument.update({
      where: { id },
      data: {
        ...dto,
        grossAmount:    dto.grossAmount    ? new Prisma.Decimal(dto.grossAmount)    : undefined,
        discountAmount: dto.discountAmount ? new Prisma.Decimal(dto.discountAmount) : undefined,
        netAmount:      dto.netAmount      ? new Prisma.Decimal(dto.netAmount)      : undefined,
        irAmount:       dto.irAmount       ? new Prisma.Decimal(dto.irAmount)       : undefined,
        pisAmount:      dto.pisAmount      ? new Prisma.Decimal(dto.pisAmount)      : undefined,
        cofinsAmount:   dto.cofinsAmount   ? new Prisma.Decimal(dto.cofinsAmount)   : undefined,
        csllAmount:     dto.csllAmount     ? new Prisma.Decimal(dto.csllAmount)     : undefined,
        issAmount:      dto.issAmount      ? new Prisma.Decimal(dto.issAmount)      : undefined,
        inssAmount:     dto.inssAmount     ? new Prisma.Decimal(dto.inssAmount)     : undefined,
        issueDate:      dto.issueDate  ? new Date(dto.issueDate)  : undefined,
        dueDate:        dto.dueDate    ? new Date(dto.dueDate)    : undefined,
      },
    });
  }

  // ── Reintegrate ─────────────────────────────────────────────
  async reintegrate(id: string, companyId: string, userId: string) {
    const doc = await this.findOne(id, companyId);
    if (doc.integrationStatus === 'INTEGRATED') {
      throw new BadRequestException('Documento já está integrado.');
    }
    return this.integration.runIntegration(doc, companyId, userId);
  }

  // ── Soft Delete ─────────────────────────────────────────────
  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.fiscalDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ── Summary ─────────────────────────────────────────────────
  private async buildSummary(companyId: string, competenceMonth?: string) {
    const now = new Date();
    const where = (extra: Prisma.FiscalDocumentWhereInput) => ({
      companyId,
      deletedAt: null,
      ...(competenceMonth ? { competenceMonth } : {}),
      ...extra,
    });

    const [total, totalAmountAgg, overdueAgg, overdueCount, integrated] = await Promise.all([
      this.prisma.fiscalDocument.count({ where: where({}) }),
      this.prisma.fiscalDocument.aggregate({
        where: where({ integrationStatus: 'INTEGRATED' }),
        _sum: { netAmount: true },
      }),
      this.prisma.fiscalDocument.aggregate({
        where: where({ dueDate: { lt: now } }),
        _sum: { netAmount: true },
      }),
      this.prisma.fiscalDocument.count({
        where: where({ dueDate: { lt: now } }),
      }),
      this.prisma.fiscalDocument.count({
        where: where({ integrationStatus: 'INTEGRATED' }),
      }),
    ]);

    return {
      totalDocuments: total,
      totalAmount:    totalAmountAgg._sum.netAmount ?? 0,
      overdueAmount:  overdueAgg._sum.netAmount ?? 0,
      overdueCount,
      integrationRate: total > 0 ? Math.round((integrated / total) * 100) : 100,
    };
  }
}
