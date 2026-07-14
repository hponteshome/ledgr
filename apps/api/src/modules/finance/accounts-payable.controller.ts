// src/modules/finance/accounts-payable.controller.ts

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AccountsPayableService } from './accounts-payable.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '../../multi-company/multi-company.guard';
import { Company } from '../../multi-company/company.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SidebarResourceGuard } from '@/auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '@/auth/decorators/require-resource-access.decorator';
import { CreateApDto } from './dto/create-ap.dto';
import { UpdateApDto } from './dto/update-ap.dto';
import { FilterAPDto } from './dto/filter-ap.dto';
import { PayAPDto } from './dto/pay-ap.dto';
import { BatchPayAPDto } from './dto/batch-pay-ap.dto';

@Controller('finance/accounts-payable')
@UseGuards(JwtAuthGuard, CompanyGuard, SidebarResourceGuard)
export class AccountsPayableController {
  constructor(private readonly service: AccountsPayableService) {}

  @RequireResourceAccess('accounts-payable', 'VIEW')
  @Get()
  async findAll(@Company() companyId: string, @Query() filters: FilterAPDto) {
    return this.service.findAll(companyId, filters);
  }

  @RequireResourceAccess('accounts-payable', 'VIEW')
  @Get('aging')
  async aging(@Company() companyId: string) {
    return this.service.getPositionReport(companyId);
  }

  @RequireResourceAccess('accounts-payable', 'VIEW')
  @Get(':id')
  async findOne(@Company() companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @RequireResourceAccess('accounts-payable', 'EDIT')
  @Post()
  async create(@Company() companyId: string, @CurrentUser() userId: string, @Body() dto: CreateApDto) {
    return this.service.create(companyId, dto, userId);
  }

  @RequireResourceAccess('accounts-payable', 'EDIT')
  @Put(':id')
  async update(@Company() companyId: string, @CurrentUser() userId: string, @Param('id') id: string, @Body() dto: UpdateApDto) {
    return this.service.update(companyId, id, dto, userId);
  }

  @RequireResourceAccess('accounts-payable', 'EDIT')
  @Post(':id/pay')
  async pay(@Company() companyId: string, @CurrentUser() userId: string, @Param('id') id: string, @Body() dto: PayAPDto) {
    return this.service.pay(companyId, id, dto, userId);
  }

  @RequireResourceAccess('accounts-payable', 'EDIT')
  @Post('batch-pay')
  async batchPay(@Company() companyId: string, @CurrentUser() userId: string, @Body() dto: BatchPayAPDto) {
    return this.service.batchPay(companyId, dto, userId);
  }

  @RequireResourceAccess('accounts-payable', 'DELETE')
  @Delete(':id')
  async remove(@Company() companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
