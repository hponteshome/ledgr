// apps/api/src/modules/indicadores-sync/indicadores-sync.controller.ts
// CRIADO 23/11/2026 (IND-AUTO-01) / AJUSTADO (IND-AUTO-02): mesmo padrao dos dados globais
// (Tabelas Legais e CDI): login, sem empresa; status para qualquer usuario logado (aviso do Dashboard),
// execucao manual so o Master.
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { MasterOnlyGuard, AcessoAutenticado } from '../../auth/guards/master-only.guard';
import { IndicadoresSyncService } from './indicadores-sync.service';

@UseGuards(JwtAuthGuard, MasterOnlyGuard)
@SkipCompanyCheck()
@Controller('indicadores-sync')
export class IndicadoresSyncController {
  constructor(private readonly svc: IndicadoresSyncService) {}

  @Get('status')
  @AcessoAutenticado()
  status() { return this.svc.status(); }

  @Post('executar')
  executar() { return this.svc.executar('MANUAL'); }
}
