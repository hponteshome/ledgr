// src/modules/finance/accounts-payable.controller.ts

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AccountsPayableService } from './accounts-payable.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '../../multi-company/multi-company.guard';
import { Company } from '../../multi-company/company.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CreateApDto } from './dto/create-ap.dto';
import { UpdateApDto } from './dto/update-ap.dto';
import { FilterAPDto } from './dto/filter-ap.dto';  // 🔴 CORRIGIDO
import { PayAPDto } from './dto/pay-ap.dto';
import { BatchPayAPDto } from './dto/batch-pay-ap.dto';  // 🔴 NOVO

@Controller('accounts-payable')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class AccountsPayableController {
  constructor(private readonly service: AccountsPayableService) {}

  @Get()
  async findAll(
    @Company() companyId: string,
    @Query() filters: FilterAPDto,
  ) {
    return this.service.findAll(companyId, filters);
  }

  @Get(':id')
  async findOne(
    @Company() companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  async create(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateApDto,
  ) {
    // 🔴 CORRIGIDO: ordem: companyId, dto, userId
    return this.service.create(companyId, dto, userId);
  }

  @Put(':id')
  async update(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApDto,
  ) {
    // 🔴 CORRIGIDO: ordem: companyId, id, dto, userId
    return this.service.update(companyId, id, dto, userId);
  }

  @Post(':id/pay')
  async pay(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: PayAPDto,
  ) {
    // 🔴 CORRIGIDO: ordem: companyId, id, dto, userId
    return this.service.pay(companyId, id, dto, userId);
  }

  @Post('batch-pay')
  async batchPay(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @Body() dto: BatchPayAPDto,
  ) {
    // 🔴 CORRIGIDO: ordem: companyId, dto, userId
    return this.service.batchPay(companyId, dto, userId);
  }

  @Delete(':id')
  async remove(
    @Company() companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(companyId, id);
  }
}