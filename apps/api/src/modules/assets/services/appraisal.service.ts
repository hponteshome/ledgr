// D:\Projetos\Ledgr\apps\api\src\modules\assets\services\appraisal.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssetHistoryService } from './history.service';

@Injectable()
export class AppraisalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: AssetHistoryService,
  ) {}

  async findAll(companyId: string, assetId?: string) {
    return this.prisma.assetAppraisal.findMany({
      where: { companyId, ...(assetId && { assetId }) },
      include: { asset: { select: { id: true, internalCode: true, description: true } } },
      orderBy: { appraisalDate: 'desc' },
    });
  }

  async create(companyId: string, dto: any, performedById?: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id: dto.assetId, companyId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const previousValue = Number(asset.bookValue);

    const record = await this.prisma.assetAppraisal.create({
      data: {
        ...dto,
        companyId,
        previousValue,
        appraisalDate: new Date(dto.appraisalDate),
      },
    });

    await this.prisma.fixedAsset.update({
      where: { id: dto.assetId },
      data: {
        marketValue:       dto.appraisedValue,
        lastAppraisalDate: new Date(dto.appraisalDate),
        ...(dto.estimatedRemainingMonths && {
          remainingLifeMonths: dto.estimatedRemainingMonths,
        }),
      },
    });

    await this.history.record(
      dto.assetId, companyId, 'APPRAISAL_REGISTERED',
      `Appraisal registered: ${dto.type} — Firm: ${dto.appraisalFirm}. Appraised value: ${dto.appraisedValue}`,
      previousValue, dto.appraisedValue, performedById,
    );

    return record;
  }
}
