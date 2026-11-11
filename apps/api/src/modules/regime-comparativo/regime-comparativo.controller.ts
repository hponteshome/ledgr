import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
// apps/api/src/modules/regime-comparativo/regime-comparativo.controller.ts
import { Controller, Get, Post, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { RegimeComparativoService } from './regime-comparativo.service';

@UseGuards(SidebarResourceGuard) // mesmo recurso de menu da Apuracao de Impostos
@RecursoMenu('apuracao')
@UseGuards(JwtAuthGuard)
@Controller('regime-comparativo')
export class RegimeComparativoController {
  constructor(private readonly svc: RegimeComparativoService) {}

  @Get('base/:ano')
  base(@Req() req: any, @Param('ano') ano: string) {
    return this.svc.base(req.companyId, Number(ano));
  }

  @Post('calcular')
  calcular(@Req() req: any, @Body() premissas: any) {
    return this.svc.calcular(req.companyId, premissas);
  }

  @Get('estudos')
  listar(@Req() req: any, @Query('ano') ano?: string) {
    return this.svc.listar(req.companyId, ano);
  }

  @Get('estudos/:id')
  obter(@Req() req: any, @Param('id') id: string) {
    return this.svc.obter(req.companyId, id);
  }

  @Post('estudos')
  salvar(@Req() req: any, @Body() body: any) {
    return this.svc.salvar(req.companyId, body, req.user);
  }

  @Post('estudos/:id/conclusao')
  concluir(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.concluir(req.companyId, id, body, req.user);
  }

  @Delete('estudos/:id')
  excluir(@Req() req: any, @Param('id') id: string) {
    return this.svc.excluir(req.companyId, id);
  }
}
