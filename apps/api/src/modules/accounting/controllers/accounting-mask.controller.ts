// apps/api/src/modules/accounting/controllers/accounting-mask.controller.ts

import {
  Controller, Get, Post, Patch, Body, Param,
  ParseUUIDPipe, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { Company } from '../../../multi-company/company.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AccountingMaskService, CreateMaskDto } from '../services/accounting-mask.service';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class CreateMaskBodyDto {
  @IsString()
  mask: string;

  @IsDateString()
  validFrom: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}

@Controller('accounting/mask')
@UseGuards(JwtAuthGuard)
export class AccountingMaskController {
  constructor(private readonly service: AccountingMaskService) {}

  // GET /accounting/mask — máscara vigente
  @Get()
  async getActive(@Company() companyId: string) {
    return this.service.getActiveMask(companyId);
  }

  // GET /accounting/mask/history — histórico
  @Get('history')
  async getHistory(@Company() companyId: string) {
    return this.service.listMasks(companyId);
  }

  // GET /accounting/mask/suggest/:parentId — sugerir próximo código
  @Get('suggest/:parentId')
  async suggest(
    @Company() companyId: string,
    @Param('parentId', ParseUUIDPipe) parentId: string,
  ) {
    return this.service.suggestChildCode(companyId, parentId);
  }

  // GET /accounting/mask/audit — auditoria do plano inteiro
  @Get('audit')
  async audit(@Company() companyId: string) {
    return this.service.auditPlan(companyId);
  }

  // POST /accounting/mask — criar nova máscara
  @Post()
  async create(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @Body() body: CreateMaskBodyDto,
  ) {
    return this.service.createMask(companyId, userId, {
      mask: body.mask,
      validFrom: new Date(body.validFrom),
      validTo: body.validTo ? new Date(body.validTo) : undefined,
    });
  }

  // PATCH /accounting/mask/:id/close — encerrar vigência
  @Patch(':id/close')
  async close(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('validTo') validTo: string,
  ) {
    return this.service.closeMask(companyId, id, new Date(validTo));
  }
}
