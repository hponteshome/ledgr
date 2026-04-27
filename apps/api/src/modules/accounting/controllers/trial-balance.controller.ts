// /apps/api/src/modules/accounting/controllers/trial-balance.controller.ts
//
// ARQUIVO COMPLETO — substitui o trial-balance.controller.ts atual.
// Adiciona: GET /accounting/trial-balance/verification
//

import {
  Controller, Get, Query, Req,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { TrialBalanceService } from '../services/trial-balance.service';

@Controller('accounting')
@UseGuards(JwtAuthGuard)
export class TrialBalanceController {
  constructor(private readonly trialBalanceService: TrialBalanceService) {}

  /**
   * GET /accounting/trial-balance
   * Balancete Mensal — fotografia do saldo em uma data específica.
   *
   * @param date  Data base no formato YYYY-MM-DD
   */
  @Get('trial-balance')
  async getTrialBalance(
    @Req() req: any,
    @Query('date') date: string,
  ) {
    const companyId = req.headers['x-company-id'];
    if (!companyId) throw new BadRequestException('Company ID não fornecido');
    if (!date)      throw new BadRequestException('Parâmetro "date" não informado (YYYY-MM-DD)');

    return this.trialBalanceService.getTrialBalance(companyId, new Date(date));
  }

  /**
   * GET /accounting/trial-balance/summary
   * Resumo do balancete mensal agrupado por tipo de conta.
   *
   * @param date  Data base no formato YYYY-MM-DD
   */
  @Get('trial-balance/summary')
  async getTrialBalanceSummary(
    @Req() req: any,
    @Query('date') date: string,
  ) {
    const companyId = req.headers['x-company-id'];
    if (!companyId) throw new BadRequestException('Company ID não fornecido');
    if (!date)      throw new BadRequestException('Parâmetro "date" não informado (YYYY-MM-DD)');

    return this.trialBalanceService.getTrialBalanceSummary(companyId, new Date(date));
  }

  /**
   * GET /accounting/trial-balance/verification
   * Balancete de Verificação — movimento no período com 4 colunas:
   *   Saldo Anterior | Débitos | Créditos | Saldo Final
   *
   * @param startDate  Início do período (YYYY-MM-DD)
   * @param endDate    Fim do período   (YYYY-MM-DD)
   */
  @Get('trial-balance/verification')
  async getVerificationBalance(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate')   endDate: string,
  ) {
    const companyId = req.headers['x-company-id'];
    if (!companyId)  throw new BadRequestException('Company ID não fornecido');
    if (!startDate)  throw new BadRequestException('Parâmetro "startDate" não informado (YYYY-MM-DD)');
    if (!endDate)    throw new BadRequestException('Parâmetro "endDate" não informado (YYYY-MM-DD)');

    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start.getTime())) throw new BadRequestException('startDate inválida');
    if (isNaN(end.getTime()))   throw new BadRequestException('endDate inválida');
    if (start > end)            throw new BadRequestException('startDate deve ser anterior a endDate');

    return this.trialBalanceService.getVerificationBalance(companyId, start, end);
  }
}