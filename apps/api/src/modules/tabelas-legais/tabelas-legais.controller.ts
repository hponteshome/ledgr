// apps/api/src/modules/tabelas-legais/tabelas-legais.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { SkipCompanyCheck } from '@/multi-company/company.interceptor';
import { TabelasLegaisService } from './tabelas-legais.service';

@UseGuards(JwtAuthGuard)
@SkipCompanyCheck()
@Controller('tabelas-legais')
export class TabelasLegaisController {
  constructor(private readonly svc: TabelasLegaisService) {}

  // ── Vigente (para calculos) ───────────────────────────────────────────────
  @Get('vigente')
  getVigente() { return this.svc.getVigente(); }

  // ── INSS ──────────────────────────────────────────────────────────────────
  @Get('inss')
  getInss(@Query('ano') ano?: string) {
    return this.svc.getInss(ano ? parseInt(ano) : undefined);
  }

  @Put('inss/:ano')
  upsertInss(@Param('ano') ano: string, @Body() dto: any) {
    return this.svc.upsertInssLote(parseInt(ano), dto);
  }

  // ── IRRF ──────────────────────────────────────────────────────────────────
  @Get('irrf')
  getIrrf(@Query('ano') ano?: string) {
    return this.svc.getIrrf(ano ? parseInt(ano) : undefined);
  }

  @Put('irrf/:ano')
  upsertIrrf(@Param('ano') ano: string, @Body() dto: any) {
    return this.svc.upsertIrrfLote(parseInt(ano), dto);
  }

  // ── Salario Minimo ─────────────────────────────────────────────────────────
  @Get('salario-minimo')
  getSalMin() { return this.svc.getSalarioMinimo(); }

  @Post('salario-minimo')
  upsertSalMin(@Body() dto: any) { return this.svc.upsertSalarioMinimo(dto); }

  @Delete('salario-minimo/:id')
  deleteSalMin(@Param('id') id: string) { return this.svc.deleteSalarioMinimo(id); }

  // ── Indicadores ────────────────────────────────────────────────────────────
  @Get('indicadores')
  getIndicadores(@Query('indicador') ind?: string, @Query('ano') ano?: string) {
    return this.svc.getIndicadores(ind, ano ? parseInt(ano) : undefined);
  }

  @Post('indicadores')
  upsertIndicador(@Body() dto: any) { return this.svc.upsertIndicador(dto); }

  @Post('indicadores/lote')
  upsertLote(@Body() dto: any) { return this.svc.upsertIndicadoresLote(dto.registros ?? dto); }

  @Delete('indicadores/:id')
  deleteIndicador(@Param('id') id: string) { return this.svc.deleteIndicador(id); }

  @Post('indicadores/calcular')
  calcularCorrecao(@Body() dto: any) { return this.svc.calcularCorrecao(dto); }
}