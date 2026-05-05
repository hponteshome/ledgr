// D:\Projetos\Ledgr\apps\api\src\modules\assets\services\assets.service.ts
import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateAssetDto, UpdateAssetDto, FilterAssetDto, WriteOffAssetDto,
} from '../dto/create-asset.dto';
import { AssetHistoryService } from './history.service';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: AssetHistoryService,
  ) {}

  // ── List ─────────────────────────────────────────────────
  async findAll(companyId: string, filters: FilterAssetDto) {
    const { group, status, location, search, page = 1, limit = 20 } = filters;
    const take = Math.min(Number(limit), 1000);
    const skip = (page - 1) * take;
    const where: any = {
      companyId,
      deletedAt: null,
      ...(group    && { group }),
      ...(status   && { status }),
      ...(location && { location: { contains: location, mode: 'insensitive' } }),
      ...(search   && {
        OR: [
          { description:  { contains: search, mode: 'insensitive' } },
          { internalCode: { contains: search, mode: 'insensitive' } },
          { brand:        { contains: search, mode: 'insensitive' } },
          { city:         { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.fixedAsset.findMany({
        where,
        skip,
        take,
        orderBy: { internalCode: 'asc' },
        include: {
          maintenances: {
            where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] }, deletedAt: null },
            select: { id: true, status: true, scheduledDate: true },
          },
          _count: { select: { improvements: true, retrofitProjects: true } },
          assetAccount: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.fixedAsset.count({ where }),
    ]);

    const kpis = await this.prisma.fixedAsset.aggregate({
      where: { companyId, deletedAt: null, status: { not: 'WRITTEN_OFF' } },
      _sum:   { acquisitionCost: true, bookValue: true, accumulatedDeprec: true },
      _count: { id: true },
    });

    return {
      data,
      meta: { total, page, limit: take, totalPages: Math.ceil(total / take) },
      kpis: {
        totalAssets:          kpis._count.id,
        totalAcquisitionCost: Number(kpis._sum.acquisitionCost ?? 0),
        totalBookValue:       Number(kpis._sum.bookValue       ?? 0),
        totalAccumDeprec:     Number(kpis._sum.accumulatedDeprec ?? 0),
      },
    };
  }

  // ── Detail ───────────────────────────────────────────────
  async findOne(companyId: string, id: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        maintenances:     { where: { deletedAt: null }, orderBy: { scheduledDate: 'desc' } },
        improvements:     { orderBy: { startDate: 'desc' } },
        retrofitProjects: { include: { phases: { orderBy: { sequence: 'asc' } } }, orderBy: { startDate: 'desc' } },
        depreciationLogs: { orderBy: { period: 'desc' }, take: 36 },
        appraisals:       { orderBy: { appraisalDate: 'desc' } },
        history:          { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });

    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  // ── Create ───────────────────────────────────────────────
  async create(companyId: string, dto: CreateAssetDto, performedById?: string) {
    const exists = await this.prisma.fixedAsset.findFirst({
      where: { companyId, internalCode: dto.internalCode, deletedAt: null },
    });
    if (exists) throw new ConflictException(`Internal code "${dto.internalCode}" is already in use`);

    if (dto.group === 'REAL_ESTATE' && !dto.nonDepreciable && dto.landValuePercent === undefined) {
      throw new BadRequestException(
        'Land value percentage (landValuePercent) is required for depreciable real estate assets',
      );
    }

    const acquisitionCost = dto.acquisitionCost;
    const landValueAmount = dto.group === 'REAL_ESTATE' && dto.landValuePercent
      ? (acquisitionCost * dto.landValuePercent) / 100
      : 0;
    const annualRatePercent = dto.annualRatePercent
      ?? Number(((1 / (dto.usefulLifeMonths / 12)) * 100).toFixed(2));

    // Sanitizar campos Decimal opcionais — string vazia vira null
    const assessedValue = dto.assessedValue ?? null;
    const totalArea     = dto.totalArea     ?? null;
    const builtArea     = dto.builtArea     ?? null;
    const asset = await this.prisma.fixedAsset.create({
      data: {
        companyId,
        internalCode:        dto.internalCode,
        description:         dto.description,
        notes:               dto.notes ?? null,
        group:               dto.group as any,
        subgroup:            dto.subgroup   ?? null,
        brand:               dto.brand      ?? null,
        model:               dto.model      ?? null,
        serialNumber:        dto.serialNumber ?? null,
        location:            dto.location   ?? null,
        acquisitionCost,
        acquisitionDate:     new Date(dto.acquisitionDate),
        residualValue:       dto.residualValue ?? 0,
        bookValue:           acquisitionCost,
        depreciationMethod:  (dto.depreciationMethod ?? 'STRAIGHT_LINE') as any,
        usefulLifeMonths:    dto.usefulLifeMonths,
        remainingLifeMonths: dto.usefulLifeMonths,
        annualRatePercent,
        depreciationStart:   new Date(dto.depreciationStart),
        nonDepreciable:      dto.nonDepreciable ?? false,
        landValuePercent:    dto.landValuePercent,
        landValueAmount:     landValueAmount || null,
        iptuRegistration:    dto.iptuRegistration    ?? null,
        registryNumber:      dto.registryNumber      ?? null,
        registryOffice:      dto.registryOffice      ?? null,
        realEstateNotes:     dto.realEstateNotes     ?? null,
        totalArea:           totalArea,
        builtArea:           builtArea,
        assessedValue:       assessedValue,
        street:              dto.street,
        zipCode:             dto.zipCode,
        state:               dto.state,
        city:                dto.city,
        assetAccountId:      dto.assetAccountId,
        depreciationAccId:   dto.depreciationAccId,
        accumDeprecAccId:    dto.accumDeprecAccId,
        status:              'PENDING_ACTIVATION' as any,
      },
    });

    await this.history.record(
      asset.id, companyId, 'ACQUISITION',
      `Asset registered: ${asset.description} — Cost: ${acquisitionCost}`,
      undefined, acquisitionCost, performedById,
    );

    return asset;
  }

  // ── Update ───────────────────────────────────────────────
  async update(companyId: string, id: string, dto: UpdateAssetDto) {
    await this.findOne(companyId, id);

    return this.prisma.fixedAsset.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.acquisitionDate   && { acquisitionDate:   new Date(dto.acquisitionDate) }),
        ...(dto.depreciationStart && { depreciationStart: new Date(dto.depreciationStart) }),
      },
    });
  }

  // ── Activate ─────────────────────────────────────────────
  async activate(companyId: string, id: string, performedById?: string) {
    const asset = await this.findOne(companyId, id);
    if (asset.status === 'ACTIVE') throw new BadRequestException('Asset is already active');

    await this.prisma.fixedAsset.update({ where: { id }, data: { status: 'ACTIVE' } });

    await this.history.record(
      id, companyId, 'ACTIVATION',
      'Asset activated for depreciation',
      undefined, Number(asset.bookValue), performedById,
    );

    return { ok: true };
  }

  // ── Deactivate / Reactivate ─────────────────────────────
  async deactivate(companyId: string, id: string, performedById?: string) {
    const asset = await this.findOne(companyId, id);
    if (asset.status !== 'ACTIVE') throw new BadRequestException('Asset is not active');
    await this.prisma.fixedAsset.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.history.record(id, companyId, 'TRANSFER',
      'Ativo desativado temporariamente', Number(asset.bookValue), Number(asset.bookValue), performedById);
    return { ok: true };
  }

  async reactivate(companyId: string, id: string, performedById?: string) {
    const asset = await this.findOne(companyId, id);
    if (asset.status !== 'INACTIVE') throw new BadRequestException('Asset is not inactive');
    await this.prisma.fixedAsset.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.history.record(id, companyId, 'ACTIVATION',
      'Ativo reativado', Number(asset.bookValue), Number(asset.bookValue), performedById);
    return { ok: true };
  }

  // ── Write-Off ────────────────────────────────────────────
  async writeOff(companyId: string, id: string, dto: WriteOffAssetDto, performedById?: string) {
    const asset = await this.findOne(companyId, id);

    const gainLoss = dto.disposalValue !== undefined
      ? dto.disposalValue - Number(asset.bookValue)
      : -Number(asset.bookValue);

    await this.prisma.fixedAsset.update({
      where: { id },
      data: {
        status:    dto.reason === 'DISPOSAL' ? 'DISPOSED' : 'WRITTEN_OFF',
        deletedAt: new Date(dto.writeOffDate),
      },
    });

    await this.history.record(
      id, companyId, dto.reason === 'DISPOSAL' ? 'DISPOSAL' : 'WRITE_OFF',
      `Reason: ${dto.reason}. Book value at write-off: ${Number(asset.bookValue).toFixed(2)}.` +
      (dto.disposalValue ? ` Disposal value: ${dto.disposalValue}. Gain/loss: ${gainLoss.toFixed(2)}.` : '') +
      (dto.notes ? ` ${dto.notes}` : ''),
      Number(asset.bookValue), dto.disposalValue ?? 0, performedById,
    );

    return { gainLoss, bookValueAtWriteOff: Number(asset.bookValue) };
  }

  // ── Soft Delete ──────────────────────────────────────────
  async softDelete(companyId: string, id: string, performedById?: string) {
    const asset = await this.findOne(companyId, id);
    await this.prisma.fixedAsset.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.history.record(
      id, companyId, 'DISPOSAL',
      `Ativo excluído: ${asset.description}`,
      Number(asset.bookValue), 0, performedById,
    );
    return { ok: true };
  }

  // ── Depreciation Projection ───────────────────────────────
  async getDepreciationProjection(companyId: string, id: string) {
    const asset = await this.findOne(companyId, id);
    if (asset.nonDepreciable) return { projection: [], asset };

    const projection: any[] = [];
    let balance = Number(asset.bookValue);
    const residual        = Number(asset.residualValue);
    const landAmount      = Number(asset.landValueAmount ?? 0);
    const depreciableBase = Number(asset.acquisitionCost) - landAmount - residual;
    const months          = asset.remainingLifeMonths;
    const elapsed         = asset.usefulLifeMonths - asset.remainingLifeMonths;

    for (let i = 1; i <= months && balance > residual; i++) {
      let charge = 0;
      if (asset.depreciationMethod === 'STRAIGHT_LINE') {
        charge = depreciableBase / asset.usefulLifeMonths;
      } else if (asset.depreciationMethod === 'SUM_OF_DIGITS') {
        const n        = asset.usefulLifeMonths;
        const sumDigits    = (n * (n + 1)) / 2;
        const currentMonth = elapsed + i;
        charge = depreciableBase * ((n - currentMonth + 1) / sumDigits);
      }
      charge  = Math.min(charge, balance - residual);
      balance -= charge;

      const date = new Date(asset.depreciationStart);
      date.setMonth(date.getMonth() + elapsed + i);

      projection.push({
        period:        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        monthlyCharge: Number(charge.toFixed(2)),
        bookValue:     Number(balance.toFixed(2)),
        accumDeprec:   Number((Number(asset.accumulatedDeprec) + (depreciableBase - balance + residual)).toFixed(2)),
      });
    }

    return { projection, asset };
  }
}
