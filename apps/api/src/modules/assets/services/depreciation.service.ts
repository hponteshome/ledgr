// D:\Projetos\Ledgr\apps\api\src\modules\assets\services\depreciation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { AssetHistoryService } from './history.service';
import { Prisma } from '@prisma/client'; // Importado para lidar com tipos Decimal

@Injectable()
export class DepreciationService {
  private readonly logger = new Logger(DepreciationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly history: AssetHistoryService,
  ) {}

  @Cron('0 2 1 * *')
  async runMonthlyDepreciation() {
    this.logger.log('Starting monthly depreciation job...');
    const companies = await this.prisma.company.findMany({ where: { deletedAt: null } });

    let total = 0;
    for (const company of companies) {
      const count = await this.processCompany(company.id);
      total += count;
    }
    this.logger.log(`Monthly depreciation completed. ${total} assets processed.`);
  }

  async processCompany(companyId: string): Promise<number> {
    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1);

    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        nonDepreciable: false,
        remainingLifeMonths: { gt: 0 },
        deletedAt: null,
      },
    });

    for (const asset of assets) {
      try {
        // CORREÇÃO 1: Ajustado para usar a nova chave única do model [assetId, method]
        const alreadyProcessed = await this.prisma.assetDepreciationLog.findUnique({
          where: { 
            assetId_method: { 
              assetId: asset.id, 
              method: asset.depreciationMethod 
            } 
          },
        });
        
        // Mantida a sua lógica de trava por período
        if (alreadyProcessed && alreadyProcessed.period.getTime() === period.getTime()) continue;

        const monthlyCharge = this.calculateCharge(asset);
        const accumDeprecBefore = Number(asset.accumulatedDeprec);
        const accumDeprecAfter  = accumDeprecBefore + monthlyCharge;
        const bookValueAfter    = Number(asset.bookValue) - monthlyCharge;

        await this.prisma.$transaction([
          this.prisma.assetDepreciationLog.create({
            data: {
              assetId: asset.id,
              companyId,
              period,
              method: asset.depreciationMethod,
              // CORREÇÃO 2: Garantindo que valores numéricos sejam aceitos pelo campo Decimal do Prisma
              monthlyCharge: new Prisma.Decimal(monthlyCharge),
              accumDeprecBefore: new Prisma.Decimal(accumDeprecBefore),
              accumDeprecAfter: new Prisma.Decimal(accumDeprecAfter),
              bookValueAfter: new Prisma.Decimal(bookValueAfter),
            },
          }),
          this.prisma.fixedAsset.update({
            where: { id: asset.id },
            data: {
              // CORREÇÃO 3: Update também exige Decimal ou string para colunas @db.Decimal
              accumulatedDeprec: new Prisma.Decimal(accumDeprecAfter),
              bookValue: new Prisma.Decimal(bookValueAfter),
              remainingLifeMonths: asset.remainingLifeMonths - 1,
              ...(asset.remainingLifeMonths <= 1 && { status: 'INACTIVE' }),
            },
          }),
        ]);
      } catch (err) {
        this.logger.error(`Failed to depreciate asset ${asset.id}: ${err.message}`);
      }
    }

    return assets.length;
  }

  calculateCharge(asset: any): number {
    const landAmount      = Number(asset.landValueAmount ?? 0);
    const residual        = Number(asset.residualValue);
    const depreciableBase = Number(asset.acquisitionCost) - landAmount - residual;
    const allowedBalance  = Number(asset.bookValue) - residual - landAmount;

    let charge = 0;
    switch (asset.depreciationMethod) {
      case 'STRAIGHT_LINE':
        charge = depreciableBase / asset.usefulLifeMonths;
        break;
      case 'SUM_OF_DIGITS': {
        const n = asset.usefulLifeMonths;
        const sumDigits    = (n * (n + 1)) / 2;
        const currentMonth = n - asset.remainingLifeMonths + 1;
        charge = depreciableBase * ((n - currentMonth + 1) / sumDigits);
        break;
      }
      case 'ACCELERATED_2X':
        charge = (2 * Number(asset.bookValue)) / asset.usefulLifeMonths;
        break;
      default:
        charge = depreciableBase / asset.usefulLifeMonths;
    }

    return Number(Math.min(charge, allowedBalance).toFixed(2));
  }

  async reprocessPeriod(companyId: string, period: string) {
    await this.prisma.assetDepreciationLog.deleteMany({
      where: { companyId, period: new Date(period) },
    });
    return this.processCompany(companyId);
  }

  async getAssetHistory(companyId: string, assetId: string) {
    return this.prisma.assetDepreciationLog.findMany({
      where: { assetId, companyId },
      orderBy: { period: 'asc' },
    });
  }
}