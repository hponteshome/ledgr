// ============================================================
// LEDGR — src/modules/finance/finance.controller.ts
// ============================================================
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../multi-company/company.interceptor';
import { FinanceService } from './finance.service';
import { AgendaService } from './agenda.service';
import { CreateFiscalDocumentDto } from './dto/create-fiscal-document.dto';
import { UpdateFiscalDocumentDto } from './dto/update-fiscal-document.dto';
import { FilterFiscalDocumentDto } from './dto/filter-fiscal-document.dto';
import { CreateAgendaEventDto } from './dto/create.agenda.dto';
import { UpdateAgendaEventDto } from './dto/update.agenda.dto';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly agendaService: AgendaService,
  ) {}

  // ── Fiscal Documents ────────────────────────────────────────

  @Get('fiscal-documents')
  findAll(@Req() req: any, @Query() filters: FilterFiscalDocumentDto) {
    return this.financeService.findAll(req.companyId, filters);
  }

  @Post('fiscal-documents')
  create(@Req() req: any, @Body() dto: CreateFiscalDocumentDto) {
    return this.financeService.createFiscalDocument(
      req.companyId,
      dto,
      req.user.id,
    );
  }

  @Get('fiscal-documents/:id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.financeService.findOne(id, req.companyId);
  }

  @Patch('fiscal-documents/:id')
  update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateFiscalDocumentDto,
  ) {
    return this.financeService.update(id, req.companyId, dto);
  }

  @Post('fiscal-documents/:id/integrate')
  @HttpCode(HttpStatus.OK)
  reintegrate(@Param('id') id: string, @Req() req: any) {
    return this.financeService.reintegrate(id, req.companyId, req.user.id);
  }

  @Delete('fiscal-documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.financeService.remove(id, req.companyId);
  }

  // ── Agenda ──────────────────────────────────────────────────

  @Get('agenda')
  getAgenda(@Req() req: any, @Query('month') month: string) {
    const m = month ?? new Date().toISOString().slice(0, 7); // default: mês atual
    return this.agendaService.findByMonth(req.companyId, m);
  }

  @Get('agenda/upcoming')
  getUpcoming(@Req() req: any, @Query('days') days?: string) {
    return this.agendaService.getUpcoming(req.companyId, days ? parseInt(days) : 30);
  }

  @Post('agenda')
  createEvent(@Req() req: any, @Body() dto: CreateAgendaEventDto) {
    return this.agendaService.create(req.companyId, dto, req.user.id);
  }

  @Patch('agenda/:id')
  updateEvent(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateAgendaEventDto,
  ) {
    return this.agendaService.update(id, req.companyId, dto);
  }

  @Delete('agenda/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEvent(@Param('id') id: string, @Req() req: any) {
    return this.agendaService.remove(id, req.companyId);
  }
}
