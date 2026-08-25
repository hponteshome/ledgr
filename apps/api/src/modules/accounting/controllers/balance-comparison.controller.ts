// /apps/api/src/modules/accounting/controllers/balance-comparison.controller.ts
// REESCRITO 25/08/2026: usa BalanceComparisonService (reaproveita a logica
// validada do Balancete) em vez de BalancesService.getBalanceComparison
// (agrupamento bruto por ano, sem filtro de deletedAt, sem garantia de
// fim-de-periodo). Aceita intervalo de mes/ano, gera um fim-de-mes por mes.
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { BalanceComparisonService } from '../services/balance-comparison.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class BalanceComparisonController {
  constructor(private readonly svc: BalanceComparisonService) {}

  @Get('balance-comparison/:companyId')
  async getComparison(
    @Param('companyId') companyId: string,
    @Query('startMonth') startMonth: string,
    @Query('endMonth') endMonth: string,
  ) {
    return this.svc.getComparison(companyId, startMonth, endMonth);
  }
}
