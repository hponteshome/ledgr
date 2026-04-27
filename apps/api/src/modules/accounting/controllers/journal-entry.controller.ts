// apps/api/src/modules/accounting/controllers/journal-entry.controller.ts

import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { SkipCompanyCheck } from '@/multi-company/company.interceptor';
import {
  JournalEntryService,
  CreateJournalEntryDto,
  BulkDeleteFilters,
} from '../services/journal-entry.service';

@Controller('accounting/journal')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class JournalEntryController {
  constructor(private readonly service: JournalEntryService) {}

  // ── GET /accounting/journal ─────────────────────────────────────────────────
  @Get()
  findAll(
    @Req() req: any,
    @Query('dateFrom')    dateFrom?:    string,
    @Query('dateTo')      dateTo?:      string,
    @Query('search')      search?:      string,
    @Query('sources')     sources?:     string,
    @Query('accountCode') accountCode?: string,
    @Query('page')        page?:        string,
    @Query('limit')       limit?:       string,
  ) {
    return this.service.findAll(req.headers['x-company-id'], {
      dateFrom,
      dateTo,
      search,
      sources,
      accountCode,
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 100,
    });
  }

  // ── GET /accounting/journal/totals ──────────────────────────────────────────
  @Get('totals')
  getTotals(
    @Req() req: any,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo')   dateTo:   string,
  ) {
    return this.service.getTotals(
      req.headers['x-company-id'],
      dateFrom,
      dateTo,
    );
  }

  // ── GET /accounting/journal/lookup-account ──────────────────────────────────
  @Get('lookup-account')
  lookupAccount(
    @Req() req: any,
    @Query('code') code: string,
  ) {
    return this.service.lookupAccount(req.headers['x-company-id'], code);
  }

  // ── GET /accounting/journal/:id ─────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.headers['x-company-id']);
  }

  // ── POST /accounting/journal ────────────────────────────────────────────────
  @Post()
  create(@Body() dto: CreateJournalEntryDto, @Req() req: any) {
    return this.service.create(
      req.headers['x-company-id'],
      req.user.id,
      dto,
    );
  }

  // ── POST /accounting/journal/bulk-delete ─────────────────────────────────────
  // dryRun=true retorna preview sem excluir
  @Post('bulk-delete')
  bulkDelete(@Body() filters: BulkDeleteFilters, @Req() req: any) {
    return this.service.bulkDelete(req.headers['x-company-id'], filters);
  }

  // ── PUT /accounting/journal/:id ─────────────────────────────────────────────
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CreateJournalEntryDto,
    @Req() req: any,
  ) {
    return this.service.update(
      id,
      req.headers['x-company-id'],
      req.user.id,
      dto,
    );
  }

  // ── POST /accounting/journal/:id/reverse ────────────────────────────────────
  @Post(':id/reverse')
  reverse(@Param('id') id: string, @Req() req: any) {
    return this.service.reverse(
      id,
      req.headers['x-company-id'],
      req.user.id,
    );
  }

  // ── DELETE /accounting/journal/:id ──────────────────────────────────────────
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.headers['x-company-id']);
  }
}