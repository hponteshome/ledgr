// apps/api/src/modules/accounting/controllers/journal-entry.controller.ts

import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { SkipCompanyCheck } from '@/multi-company/company.interceptor';
import { SidebarResourceGuard } from '@/auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '@/auth/decorators/require-resource-access.decorator';
import {
  JournalEntryService,
  CreateJournalEntryDto,
  BulkDeleteFilters,
} from '../services/journal-entry.service';

@Controller('accounting/journal')
@UseGuards(JwtAuthGuard, CompanyGuard, SidebarResourceGuard)
export class JournalEntryController {
  constructor(private readonly service: JournalEntryService) {}

  @RequireResourceAccess('journal', 'VIEW')
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
    @Query('orderBy')     orderBy?:     string,
    @Query('orderDir')    orderDir?:    string,
  ) {
    return this.service.findAll(req.headers['x-company-id'], {
      dateFrom, dateTo, search, sources, accountCode,
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 100,
      orderBy, orderDir,
    });
  }

  @RequireResourceAccess('journal', 'VIEW')
  @Get('totals')
  getTotals(@Req() req: any, @Query('dateFrom') dateFrom: string, @Query('dateTo') dateTo: string) {
    return this.service.getTotals(req.headers['x-company-id'], dateFrom, dateTo);
  }

  @RequireResourceAccess('journal', 'VIEW')
  @Get('source-modules')
  async getSourceModules(@Req() req: any) {
    const companyId = req.headers['x-company-id'];
    return this.service.getDistinctSourceModules(companyId);
  }

  @RequireResourceAccess('journal', 'VIEW')
  @Get('lookup-account')
  lookupAccount(@Req() req: any, @Query('code') code: string) {
    return this.service.lookupAccount(req.headers['x-company-id'], code);
  }

  @RequireResourceAccess('journal', 'VIEW')
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.headers['x-company-id']);
  }

  @RequireResourceAccess('journal', 'EDIT')
  @Post()
  create(@Body() dto: CreateJournalEntryDto, @Req() req: any) {
    return this.service.create(req.headers['x-company-id'], req.user.id, dto);
  }

  @RequireResourceAccess('journal', 'DELETE')
  @Post('bulk-delete')
  bulkDelete(@Body() filters: BulkDeleteFilters, @Req() req: any) {
    return this.service.bulkDelete(req.headers['x-company-id'], filters);
  }

  @RequireResourceAccess('journal', 'EDIT')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateJournalEntryDto, @Req() req: any) {
    return this.service.update(id, req.headers['x-company-id'], req.user.id, dto);
  }

  @RequireResourceAccess('journal', 'EDIT')
  @Post(':id/reverse')
  reverse(@Param('id') id: string, @Req() req: any) {
    return this.service.reverse(id, req.headers['x-company-id'], req.user.id);
  }

  @RequireResourceAccess('journal', 'DELETE')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.headers['x-company-id']);
  }
}
