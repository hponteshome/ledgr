// /apps/api/src/modules/accounting/controllers/balance-comparison.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BalancesService } from '../services/balances.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class BalanceComparisonController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get('balance-comparison/:companyId')
  async getComparison(@Param('companyId') companyId: string) {
    return this.balancesService.getBalanceComparison(companyId);
  }
}