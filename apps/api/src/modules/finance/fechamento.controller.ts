// apps/api/src/modules/finance/fechamento.controller.ts
import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { SidebarResourceGuard } from '@/auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '@/auth/decorators/require-resource-access.decorator';
import { FechamentoService } from './fechamento.service';

@UseGuards(JwtAuthGuard, CompanyGuard, SidebarResourceGuard)
@Controller('finance/fechamento')
export class FechamentoController {
  constructor(private readonly svc: FechamentoService) {}

  @RequireResourceAccess('fechamento-mensal', 'VIEW')
  @Get()
  findAll(@Request() req: any) {
    return this.svc.findAll(req.companyId);
  }

  @RequireResourceAccess('fechamento-mensal', 'VIEW')
  @Get(':competencia')
  getOrCreate(@Param('competencia') competencia: string, @Request() req: any) {
    return this.svc.getOrCreate(req.companyId, competencia);
  }

  @RequireResourceAccess('fechamento-mensal', 'EDIT')
  @Post(':competencia/calcular')
  calcular(@Param('competencia') competencia: string, @Request() req: any) {
    return this.svc.calcular(req.companyId, competencia);
  }

  @RequireResourceAccess('fechamento-mensal', 'EDIT')
  @Put('itens/:id/conferir')
  conferirItem(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.svc.conferirItem(id, req.user.id, dto);
  }

  @RequireResourceAccess('fechamento-mensal', 'EDIT')
  @Put('itens/:id/ignorar')
  ignorarItem(@Param('id') id: string) {
    return this.svc.ignorarItem(id);
  }

  @RequireResourceAccess('fechamento-mensal', 'EDIT')
  @Post(':competencia/fechar')
  fecharMes(@Param('competencia') competencia: string, @Body() body: any, @Request() req: any) {
    return this.svc.fecharMes(req.companyId, competencia, req.user.id, {
      motivoMesCorrente: body?.motivoMesCorrente,
      confirmarPrevio: body?.confirmarPrevio,
    });
  }

  @RequireResourceAccess('fechamento-mensal', 'EDIT')
  @Post(':competencia/reabrir')
  reabrirMes(@Param('competencia') competencia: string, @Body() body: any, @Request() req: any) {
    return this.svc.reabrirMes(req.companyId, competencia, req.user.id, body.motivo);
  }

  @RequireResourceAccess('fechamento-mensal', 'VIEW')
  @Get(':competencia/status')
  checkStatus(@Param('competencia') competencia: string, @Request() req: any) {
    return this.svc.isFechado(req.companyId, competencia).then(f => ({ fechado: f, competencia }));
  }
}
