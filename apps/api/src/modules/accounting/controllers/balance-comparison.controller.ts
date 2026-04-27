// /apps/api/src/modules/accounting/controllers/balance-comparison.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { BalancesService } from '../services/balances.service';

@Controller('reports') // Define o prefixo da rota
export class BalanceComparisonController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get('balance-comparison/:companyId')
  async getComparison(@Param('companyId') companyId: string) {
    return this.balancesService.getBalanceComparison(companyId);
  }
}