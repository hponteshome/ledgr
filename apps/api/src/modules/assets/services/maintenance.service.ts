// D:\Projetos\Ledgr\apps\api\src\modules\assets\services\maintenance.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssetHistoryService } from './history.service';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: AssetHistoryService,
  ) {}

  async findAll(companyId: string, assetId?: string) {
    return this.prisma.assetMaintenance.findMany({
      where: { companyId, deletedAt: null, ...(assetId && { assetId }) },
      include: { asset: { select: { id: true, internalCode: true, description: true } } },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const record = await this.prisma.assetMaintenance.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { asset: true },
    });
    if (!record) throw new NotFoundException('Maintenance record not found');
    return record;
  }

  async create(companyId: string, dto: any, performedById?: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id: dto.assetId, companyId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const record = await this.prisma.assetMaintenance.create({
      data: { ...dto, companyId, scheduledDate: new Date(dto.scheduledDate) },
    });

    if (dto.type === 'CORRECTIVE' || dto.type === 'EMERGENCY') {
      await this.prisma.fixedAsset.update({
        where: { id: dto.assetId },
        data: { status: 'UNDER_MAINTENANCE' },
      });
    }

    await this.history.record(
      dto.assetId, companyId, 'MAINTENANCE_OPENED',
      `Work order opened: ${dto.title} (${dto.type})`,
      undefined, undefined, performedById,
    );

    return record;
  }

  async update(companyId: string, id: string, dto: any, performedById?: string) {
    const record = await this.findOne(companyId, id);

    const updated = await this.prisma.assetMaintenance.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.scheduledDate && { scheduledDate: new Date(dto.scheduledDate) }),
        ...(dto.completedAt   && { completedAt:   new Date(dto.completedAt) }),
        ...(dto.startedAt     && { startedAt:     new Date(dto.startedAt) }),
      },
    });

    if (dto.status === 'COMPLETED') {
      const asset = await this.prisma.fixedAsset.findFirst({ where: { id: record.assetId } });
      if (asset?.status === 'UNDER_MAINTENANCE') {
        await this.prisma.fixedAsset.update({
          where: { id: record.assetId }, data: { status: 'ACTIVE' },
        });
      }
      await this.history.record(
        record.assetId, companyId, 'MAINTENANCE_COMPLETED',
        `Work order completed: ${record.title}. Actual cost: ${dto.actualCost ?? 0}`,
        undefined, dto.actualCost, performedById,
      );
    }

    return updated;
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.assetMaintenance.update({
      where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
  }

  async findOverdue(companyId: string) {
    return this.prisma.assetMaintenance.findMany({
      where: {
        companyId,
        status: 'SCHEDULED',
        scheduledDate: { lt: new Date() },
        deletedAt: null,
      },
      include: { asset: { select: { id: true, internalCode: true, description: true } } },
      orderBy: { scheduledDate: 'asc' },
    });
  }
}
