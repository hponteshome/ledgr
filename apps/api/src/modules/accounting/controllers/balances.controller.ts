// /apps/api/src/accounting/controllers/balances.controller.ts

import {
  Controller, Get, Post, Query, Req,
  UseGuards, BadRequestException
} from '@nestjs/common';
import { BalancesService } from '../services/balances.service';
import { JwtAuthGuard } from '@auth/guards/jwt.guard';
import { CompanyGuard } from '@multi-company/multi-company.guard';
import { PrismaService } from '@prisma/prisma.service';


@Controller('accounting')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class BalancesController {
  constructor(
    private readonly balancesService: BalancesService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /accounting/balances/available-dates
   * Retorna lista de períodos com saldos disponíveis no banco
   */
  @Get('balances/available-dates')
  async getAvailableDates(@Req() req: any) {
    const companyId = req.headers['x-company-id'];
    if (!companyId) throw new BadRequestException('Company ID não fornecido');

    // Busca datas únicas de referência com saldos
    const dates = await this.prisma.accountBalance.findMany({
      where: { companyId },
      select: { referenceDate: true },
      distinct: ['referenceDate'],
      orderBy: { referenceDate: 'asc' },
    });

    const months = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

    return dates.map(({ referenceDate }) => {
      const d = new Date(referenceDate);
      const dd   = String(d.getDate()).padStart(2, '0');
      const mm   = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getFullYear());
      return {
        display: `${dd}/${mm}/${yyyy}`,
        value:   `${yyyy}-${mm}-${dd}`,
        label:   `${months[d.getMonth()]}/${yyyy}`,
      };
    });
  }

  /**
   * GET /accounting/balances
   * Saldos por período (histórico)
   */
  @Get('balances')
  async getBalances(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('accountCode') accountCode?: string
  ) {
    const companyId = req.headers['x-company-id'];
    if (!companyId) throw new BadRequestException('Company ID não fornecido');
    if (!startDate || !endDate) throw new BadRequestException('Período não informado');

    return this.balancesService.getBalances(
      companyId,
      new Date(startDate),
      new Date(endDate),
      accountCode
    );
  }
}