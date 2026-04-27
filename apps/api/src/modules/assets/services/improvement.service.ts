// D:\Projetos\Ledgr\apps\api\src\modules\assets\services\improvement.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssetHistoryService } from './history.service';

@Injectable()
export class ImprovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: AssetHistoryService,
  ) {}

  async findAll(companyId: string, assetId?: string) {
    return this.prisma.assetImprovement.findMany({
      where: { companyId, ...(assetId && { assetId }) },
      include: { asset: { select: { id: true, internalCode: true, description: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async create(companyId: string, dto: any, performedById?: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id: dto.assetId, companyId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const record = await this.prisma.assetImprovement.create({
      data: {
        ...dto,
        companyId,
        startDate: new Date(dto.startDate),
        completionDate: dto.completionDate ? new Date(dto.completionDate) : null,
        usefulLifeExtension: dto.usefulLifeExtension ?? 0,
      },
    });

    await this.history.record(
      dto.assetId, companyId, 'IMPROVEMENT_REGISTERED',
      `Improvement registered: ${dto.description} — Cost: ${dto.totalCost}`,
      Number(asset.bookValue), undefined, performedById,
    );

    return record;
  }

  async capitalize(companyId: string, id: string, performedById?: string) {
    const improvement = await this.prisma.assetImprovement.findFirst({
      where: { id, companyId },
      include: { asset: true },
    });
    if (!improvement) throw new NotFoundException('Improvement not found');
    if (improvement.capitalized) throw new BadRequestException('Improvement already capitalized');

    const asset = improvement.asset;
    const newBookValue       = Number(asset.bookValue) + Number(improvement.totalCost);
    const newAcquisitionCost = Number(asset.acquisitionCost) + Number(improvement.totalCost);
    const newRemainingLife   = asset.remainingLifeMonths + (improvement.usefulLifeExtension ?? 0);

    await this.prisma.$transaction([
      this.prisma.assetImprovement.update({
        where: { id },
        data: { capitalized: true, capitalizationDate: new Date() },
      }),
      this.prisma.fixedAsset.update({
        where: { id: asset.id },
        data: {
          bookValue:           newBookValue,
          acquisitionCost:     newAcquisitionCost,
          remainingLifeMonths: newRemainingLife,
          ...(improvement.newUsefulLifeMonths && {
            usefulLifeMonths: improvement.newUsefulLifeMonths,
          }),
        },
      }),
    ]);

    await this.history.record(
      asset.id, companyId, 'IMPROVEMENT_CAPITALIZED',
      `Improvement capitalized: ${improvement.description}. Life extension: ${improvement.usefulLifeExtension} months`,
      Number(asset.bookValue), newBookValue, performedById,
    );

    return { newBookValue, newRemainingLife };
  }
}
