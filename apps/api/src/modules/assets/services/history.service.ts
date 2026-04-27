// D:\Projetos\Ledgr\apps\api\src\modules\assets\services\history.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AssetHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    assetId: string,
    companyId: string,
    eventType: string,
    description: string,
    previousValue?: number,
    newValue?: number,
    performedById?: string,
    metadata?: Record<string, any>,
  ) {
    return this.prisma.assetHistory.create({
      data: {
        assetId,
        companyId,
        eventType: eventType as any,
        description,
        previousValue,
        newValue,
        performedById,
        metadata,
      },
    });
  }

async findByAsset(companyId: string, assetId: string) {
  return this.prisma.assetHistory.findMany({
    where: { 
      assetId: assetId,
      companyId: companyId 
    },
    orderBy: { createdAt: 'desc' },
  });
  }
}
