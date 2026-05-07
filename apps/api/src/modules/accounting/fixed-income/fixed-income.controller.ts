// apps/api/src/modules/accounting/fixed-income/fixed-income.controller.ts

import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param,
  Query, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';

import { FixedIncomeService } from './fixed-income.service';
import {
  CreateFixedIncomeDto, UpdateFixedIncomeDto,
  MonthlyUpdateDto, BulkMonthlyUpdateDto,
  RedemptionDto, ProjectionParamsDto,
} from './dto/fixed-income.dto';

@UseGuards(JwtAuthGuard, CompanyGuard)

@Controller('accounting/fixed-income')
export class FixedIncomeController {
  constructor(private readonly svc: FixedIncomeService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  @Get('summary')
  getSummary(@Request() req: any) {
    return this.svc.getSummary(req.companyId);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.svc.findAll(req.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.svc.findOne(id, req.companyId);
  }

  @Post()
  create(@Body() dto: CreateFixedIncomeDto, @Request() req: any) {
    return this.svc.create(req.companyId, req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.svc.softDelete(id, req.companyId);
  }

  // ── Atualização mensal ────────────────────────────────────────────────────

  /**
   * POST /accounting/fixed-income/:id/monthly-update
   * Registra a taxa CDI real do mês e calcula rendimento de competência.
   * Gera lançamento contábil se generateJournalEntry=true.
   */
  @Post(':id/monthly-update')
  applyMonthlyUpdate(
    @Param('id') id: string,
    @Body() dto: MonthlyUpdateDto,
    @Request() req: any,
  ) {
    return this.svc.applyMonthlyUpdate(id, req.companyId, req.user.id, dto);
  }

  /**
   * POST /accounting/fixed-income/bulk-update
   * Atualização em lote: útil para atualizar todos os investimentos ativos de uma vez.
   * Body: { competence, indexerRate, investmentIds?: string[] }
   */

  /**
   * POST /accounting/fixed-income/generate-missing-journals
   * Gera lancamentos contabeis retroativos para eventos sem journalEntryId.
   */
  @Post('generate-missing-journals')
  generateMissingJournals(@Body() body: any, @Request() req: any) {
    return this.svc.generateMissingJournals(req.companyId, req.user.id, body?.competenceFrom, body?.competenceTo);
  }

  @Post('bulk-update')
  async bulkUpdate(@Body() body: any, @Request() req: any) {
    const { competence, indexerRate, businessDays, calendarDays, generateJournalEntry, investmentIds } = body;
    const all = await this.svc.findAll(req.companyId);
    const targets = investmentIds?.length
      ? all.filter((i: any) => investmentIds.includes(i.id))
      : all.filter((i: any) => i.status === 'ATIVO');

    const results = [];
    for (const inv of targets) {
      try {
        const r = await this.svc.applyMonthlyUpdate(inv.id, req.companyId, req.user.id, {
          competence, indexerRate, businessDays, calendarDays, generateJournalEntry,
        });
        results.push({ id: inv.id, success: true, result: r });
      } catch (e: any) {
        results.push({ id: inv.id, success: false, error: e.message });
      }
    }
    return results;
  }

  // ── Resgate ───────────────────────────────────────────────────────────────

  /**
   * POST /accounting/fixed-income/:id/redeem
   * Registra resgate antecipado ou no vencimento.
   * amount=0 ou isTotal=true → resgate total.
   */
  @Post(':id/redeem')
  applyRedemption(
    @Param('id') id: string,
    @Body() dto: RedemptionDto,
    @Request() req: any,
  ) {
    return this.svc.applyRedemption(id, req.companyId, req.user.id, dto);
  }

  // ── Exclusao de evento ────────────────────────────────────────────────────

  @Delete(':id/events/:eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Request() req: any,
  ) {
    return this.svc.deleteEvent(id, eventId, req.companyId);
  }

  @Put(':id/events/:eventId')
  updateEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.svc.updateEvent(id, eventId, req.companyId, dto);
  }

  @Put(':id')
  updateInvestment(
    @Param('id') id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.svc.updateInvestment(id, req.companyId, dto);
  }


  // ── Projeção ──────────────────────────────────────────────────────────────

  /**
   * GET /accounting/fixed-income/:id/projection
   * Retorna projeção mensal completa (dados reais + projeção futura).
   * Aceita query params: projectedMonthlyRate, projectionUntil
   */
  @Get(':id/projection')
  getProjection(
    @Param('id') id: string,
    @Query() query: any,
    @Request() req: any,
  ) {
    const params: ProjectionParamsDto = {
      projectedMonthlyRate: query.projectedMonthlyRate ? parseFloat(query.projectedMonthlyRate) : undefined,
      projectionUntil:      query.projectionUntil,
      partialRedemptions:   query.partialRedemptions ? JSON.parse(query.partialRedemptions) : undefined,
    };
    return this.svc.buildProjection(id, req.companyId, params);
  }

  /**
   * POST /accounting/fixed-income/simulate
   * Simulação sem persistência — não exige investimento cadastrado.
   * Útil para análise antes de aplicar.
   */
  @Post('simulate')
  simulate(@Body() body: any) {
    return this.svc.simulate(body);
  }
}
