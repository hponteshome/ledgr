// src/modules/accounting/accounting.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { empresaEfetiva } from '../../../multi-company/company.interceptor';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { AccountingService } from '../services/accounting.service';

@Controller('accounting')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  async findAll(@Req() req: any, @Query('companyId') companyId?: string) {
    return this.accountingService.findAllAccounts(empresaEfetiva(req, companyId) as any); // Seguranca 0A
  }
}