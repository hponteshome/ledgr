import { SidebarResourceGuard } from '../../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../../auth/decorators/recurso-menu.decorator';
// apps/api/src/modules/accounting/controllers/equity-method.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { EquityMethodService, CreateEquityMethodDto, UpdateEquityMethodDto } from '../services/equity-method.service';
import { UseInterceptors } from '@nestjs/common';
import { EscopoPorId } from '../../../multi-company/escopo-por-id.interceptor';

@UseGuards(SidebarResourceGuard) // Seguranca 0A (04/10/2026): perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('renda-fixa')
@UseGuards(JwtAuthGuard)
@UseInterceptors(EscopoPorId('equityMethodInvestment', 'investorCompanyId')) // Seguranca 0A: escopo de empresa nas rotas :id
@Controller('accounting/equity-method')
export class EquityMethodController {
  constructor(private readonly svc: EquityMethodService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.headers['x-company-id']);
  }

  @Post()
  create(@Req() req: any, @CurrentUser('object') user: any, @Body() dto: CreateEquityMethodDto) {
    return this.svc.create(req.headers['x-company-id'], user, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateEquityMethodDto) {
    return this.svc.update(req.headers['x-company-id'], id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.headers['x-company-id'], id);
  }

  // Rota estatica antes das rotas ':id/...' (Regra 7)
  @Get('percentual-sugerido')
  percentualSugerido(@Req() req: any, @Query('investeeCompanyId') investeeCompanyId: string) {
    return this.svc.percentualSugerido(req.headers['x-company-id'], investeeCompanyId);
  }

  @Get(':id/calcular')
  calcular(@Req() req: any, @Param('id') id: string, @Query('referenceDate') referenceDate: string) {
    return this.svc.calcular(req.headers['x-company-id'], id, referenceDate);
  }

  @Post(':id/lancar')
  lancar(@Req() req: any, @Param('id') id: string, @Body('referenceDate') referenceDate: string) {
    return this.svc.lancar(req.headers['x-company-id'], req.user.id, id, referenceDate);
  }

  @Get(':id/historico')
  historico(@Req() req: any, @Param('id') id: string) {
    return this.svc.historico(req.headers['x-company-id'], id);
  }

  @Post(':id/reverter')
  reverter(@Req() req: any, @Param('id') id: string, @Body('referenceDate') referenceDate: string) {
    return this.svc.reverter(req.headers['x-company-id'], id, referenceDate);
  }

  @Post(':id/atualizar-percentual')
  atualizarPercentual(@Req() req: any, @Param('id') id: string, @Body('percentOwned') percentOwned: number) {
    return this.svc.updatePercentOwned(req.headers['x-company-id'], id, percentOwned);
  }
}
