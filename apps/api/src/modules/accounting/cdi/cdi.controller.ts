// apps/api/src/modules/accounting/cdi/cdi.controller.ts
import { Controller, Get, Post, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CdiService } from './cdi.service';
import { MasterOnlyGuard, AcessoAutenticado } from '../../../auth/guards/master-only.guard';

@UseGuards(JwtAuthGuard, MasterOnlyGuard) // Seguranca 0A: dados globais - escrita so Master
@Controller('accounting/cdi')
export class CdiController {
  constructor(private readonly svc: CdiService) {}

  @Get()
  @AcessoAutenticado() // Seguranca 0A: leitura liberada
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.findAll(from, to);
  }

  @Get('latest')
  @AcessoAutenticado() // Seguranca 0A: leitura liberada
  getLatest() {
    return this.svc.getLatestDate();
  }

  @Get('monthly')
  @AcessoAutenticado() // Seguranca 0A: leitura liberada
  getMonthly(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.getMonthlyRates(from, to);
  }

  @Get('competence/:comp')
  @AcessoAutenticado() // Seguranca 0A: leitura liberada
  getByCompetence(@Param('comp') comp: string) {
    return this.svc.findByCompetence(comp);
  }

  @Post('import')
  importRates(@Body() body: { rows: any[] }) {
    return this.svc.upsertMany(body.rows);
  }

  @Delete(':date')
  remove(@Param('date') date: string) {
    return this.svc.deleteByDate(date);
  }
}