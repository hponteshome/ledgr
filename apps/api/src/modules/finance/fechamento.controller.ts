// apps/api/src/modules/finance/fechamento.controller.ts
import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { FechamentoService } from './fechamento.service';

@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('finance/fechamento')
export class FechamentoController {
  constructor(private readonly svc: FechamentoService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.svc.findAll(req.companyId);
  }

  @Get(':competencia')
  getOrCreate(@Param('competencia') competencia: string, @Request() req: any) {
    return this.svc.getOrCreate(req.companyId, competencia);
  }

  @Post(':competencia/calcular')
  calcular(@Param('competencia') competencia: string, @Request() req: any) {
    return this.svc.calcular(req.companyId, competencia);
  }

  @Put('itens/:id/conferir')
  conferirItem(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.svc.conferirItem(id, req.user.id, dto);
  }

  @Put('itens/:id/ignorar')
  ignorarItem(@Param('id') id: string) {
    return this.svc.ignorarItem(id);
  }

  @Post(':competencia/fechar')
  fecharMes(@Param('competencia') competencia: string, @Request() req: any) {
    return this.svc.fecharMes(req.companyId, competencia, req.user.id);
  }

  @Post(':competencia/reabrir')
  reabrirMes(@Param('competencia') competencia: string, @Body() body: any, @Request() req: any) {
    return this.svc.reabrirMes(req.companyId, competencia, req.user.id, body.motivo);
  }

  @Get(':competencia/status')
  checkStatus(@Param('competencia') competencia: string, @Request() req: any) {
    return this.svc.isFechado(req.companyId, competencia).then(f => ({ fechado: f, competencia }));
  }
}
