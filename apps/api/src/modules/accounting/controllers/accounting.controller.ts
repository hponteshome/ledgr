// src/modules/accounting/accounting.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { AccountingService } from '../services/accounting.service';

@Controller('accounting')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  async findAll(@Query('companyId') companyId?: string) {
    return this.accountingService.findAllAccounts(companyId);
  }
}