// D:\Projetos\Ledgr\apps\api\src\modules\assets\services\depreciation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { AssetHistoryService } from './history.service';
import { Prisma } from '@prisma/client';

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

  async processCompany(companyId: string, periodStr?: string): Promise<number> {
    const now = periodStr ? new Date(periodStr) : new Date();
    const period = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

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
        const alreadyProcessed = await this.prisma.assetDepreciationLog.findUnique({
          where: {
            assetId_method_period: {
              assetId: asset.id,
              method: asset.depreciationMethod,
              period,
            },
          },
        });

        if (alreadyProcessed) continue;

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
              monthlyCharge:     new Prisma.Decimal(monthlyCharge),
              accumDeprecBefore: new Prisma.Decimal(accumDeprecBefore),
              accumDeprecAfter:  new Prisma.Decimal(accumDeprecAfter),
              bookValueAfter:    new Prisma.Decimal(bookValueAfter),
            },
          }),
          this.prisma.fixedAsset.update({
            where: { id: asset.id },
            data: {
              accumulatedDeprec:   new Prisma.Decimal(accumDeprecAfter),
              bookValue:           new Prisma.Decimal(bookValueAfter),
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

  // ── Backfill via SQL raw — confiável e performático ─────────────────────────
  async backfillAsset(companyId: string, assetId: string, dateFrom?: string, dateTo?: string): Promise<number> {
    // 1 — Deletar logs existentes
    await this.prisma.assetDepreciationLog.deleteMany({ where: { assetId, companyId } });

    // 2 — Inserir logs via SQL com generate_series
    const fromClause = dateFrom
      ? `DATE_TRUNC('month', '${dateFrom}'::date)`
      : `DATE_TRUNC('month', (SELECT depreciation_start FROM fixed_assets WHERE id = '${assetId}'))`;

    const toClause = dateTo
      ? `DATE_TRUNC('month', '${dateTo}'::date)`
      : `DATE_TRUNC('month', CURRENT_DATE)`;

    const result = await this.prisma.$executeRawUnsafe(`
      WITH params AS (
        SELECT
          id,
          company_id,
          depreciation_method,
          acquisition_cost,
          COALESCE(land_value_amount, 0) AS land_amount,
          residual_value,
          useful_life_months,
          ROUND((acquisition_cost - COALESCE(land_value_amount,0) - residual_value) / useful_life_months, 2) AS monthly_charge
        FROM fixed_assets
        WHERE id = '${assetId}' AND company_id = '${companyId}'
      ),
      months AS (
        SELECT
          gs::date AS period,
          (ROW_NUMBER() OVER () - 1) AS idx
        FROM generate_series(${fromClause}, ${toClause}, '1 month'::interval) AS gs
      )
      INSERT INTO asset_depreciation_logs
        (id, company_id, asset_id, period, method, monthly_charge, accum_deprec_before, accum_deprec_after, book_value_after)
      SELECT
        gen_random_uuid(),
        p.company_id,
        p.id,
        m.period,
        p.depreciation_method,
        p.monthly_charge,
        ROUND(p.monthly_charge * m.idx, 2),
        ROUND(p.monthly_charge * (m.idx + 1), 2),
        ROUND(p.acquisition_cost - ROUND(p.monthly_charge * (m.idx + 1), 2), 2)
      FROM months m, params p
      ON CONFLICT (asset_id, method, period) DO UPDATE SET
        monthly_charge      = EXCLUDED.monthly_charge,
        accum_deprec_before = EXCLUDED.accum_deprec_before,
        accum_deprec_after  = EXCLUDED.accum_deprec_after,
        book_value_after    = EXCLUDED.book_value_after
    `);

    // 3 — Atualizar o ativo com os valores finais
    await this.prisma.$executeRawUnsafe(`
      WITH params AS (
        SELECT
          ROUND((acquisition_cost - COALESCE(land_value_amount,0) - residual_value) / useful_life_months, 2) AS monthly_charge,
          useful_life_months
        FROM fixed_assets WHERE id = '${assetId}'
      ),
      log_count AS (
        SELECT COUNT(*) AS cnt FROM asset_depreciation_logs WHERE asset_id = '${assetId}' AND company_id = '${companyId}'
      )
      UPDATE fixed_assets SET
        accumulated_depreciation = (SELECT ROUND(monthly_charge * cnt, 2) FROM params, log_count),
        book_value               = acquisition_cost - (SELECT ROUND(monthly_charge * cnt, 2) FROM params, log_count),
        remaining_life_months    = (SELECT useful_life_months - cnt::int FROM params, log_count),
        status                   = CASE WHEN (SELECT useful_life_months - cnt::int FROM params, log_count) <= 0 THEN 'INACTIVE'::asset_status ELSE 'ACTIVE'::asset_status END
      WHERE id = '${assetId}' AND company_id = '${companyId}'
    `);

    return result;
  }

  async backfillAll(companyId: string): Promise<{ assets: number; periods: number }> {
    const assets = await this.prisma.fixedAsset.findMany({
      where: { companyId, status: 'ACTIVE', nonDepreciable: false, deletedAt: null },
      select: { id: true },
      });
      let periods = 0;
      for (const asset of assets) {
        const count = await this.backfillAsset(companyId, asset.id);
        periods += count;
      }
      return { assets: assets.length, periods };
  }

  // ── Lançamentos contábeis consolidados por mês ─────────────────────────────
  async generateDepreciationJournalEntries(
    companyId: string,
    yearMonth: string,  // formato YYYY-MM
    userId: string,
  ): Promise<{ created: boolean; journalEntryId?: string; totalAssets: number; totalAmount: number }> {

    // 1. Busca todos os logs do mês informado
    const periodDate = new Date(`${yearMonth}-01T00:00:00.000Z`);
    const logs = await this.prisma.assetDepreciationLog.findMany({
      where: { companyId, period: periodDate },
      include: { asset: { select: { id: true, description: true, depreciationAccId: true, accumDeprecAccId: true } } },
    });

    const logsWithAccounts = logs.filter(l => l.asset.depreciationAccId && l.asset.accumDeprecAccId);
    if (logsWithAccounts.length === 0) return { created: false, totalAssets: 0, totalAmount: 0 };

    const totalAmount = logsWithAccounts.reduce((s, l) => s + Number(l.monthlyCharge), 0);

    // 2. Data do lançamento = último dia do mês
    const lastDay = new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth() + 1, 0));

    // 3. Verifica se já existe lançamento para este mês (evita duplicata)
    const existing = await this.prisma.journalEntry.findFirst({
      where: { companyId, reference: `DEPR-${yearMonth}`, deletedAt: null },
    });
    if (existing) return { created: false, journalEntryId: existing.id, totalAssets: logsWithAccounts.length, totalAmount };

    // 4. Cria o lançamento em $transaction
        const result = await this.prisma.$transaction(async (tx) => {
          const entry = await (tx.journalEntry.create as any)({
            data: {
              companyId,
              date:        lastDay,
              description: "Depreciacao do Ativo Imobilizado — " + yearMonth.slice(5, 7) + "/" + yearMonth.slice(0, 4),
              reference:   "DEPR-" + yearMonth,
              sourceModule: "ASSET",
              createdById: userId,
              items: {
                create: logsWithAccounts.flatMap(l => [
                  { accountId: l.asset.depreciationAccId, value: Number(l.monthlyCharge), type: "DEBIT" },
                  { accountId: l.asset.accumDeprecAccId, value: Number(l.monthlyCharge), type: "CREDIT" },
                ]),
              },
            },
          });
          return entry;
        });

    return { created: true, journalEntryId: result.id, totalAssets: logsWithAccounts.length, totalAmount };
  }

  async reprocessPeriod(companyId: string, period: string) {
    return this.processCompany(companyId, period);
  }

  async getAssetHistory(companyId: string, assetId: string) {
    return this.prisma.assetDepreciationLog.findMany({
      where: { assetId, companyId },
      orderBy: { period: 'asc' },
    });
  }
}
