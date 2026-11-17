// apps/api/src/modules/hr/esocial-s13/esocial-s13.controller.ts
// LEDGR - eSocial S-1.3 (17/11/2026)
import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { SidebarResourceGuard } from '../../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../../auth/decorators/recurso-menu.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { EsocialS13Service } from './esocial-s13.service';

@UseGuards(SidebarResourceGuard) // Seguranca 0A: perfil na API = permissoes do menu
@RecursoMenu('folha')
@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('hr/esocial-s13')
export class EsocialS13Controller {
  constructor(private readonly svc: EsocialS13Service) {}

  @Post('gerar')
  gerar(@Body() dto: any, @Request() req: any) {
    return this.svc.gerarPacote(req.companyId, dto);
  }

  @Get('eventos')
  listar(@Query('tpAmb') tpAmb: string, @Request() req: any) {
    return this.svc.listar(req.companyId, Number(tpAmb) || 2);
  }

  @Get('eventos/:id/xml')
  xml(@Param('id') id: string, @Request() req: any) {
    return this.svc.xml(req.companyId, id);
  }

  @Get('pagamentos')
  pagamentos(@Request() req: any) {
    return this.svc.pagamentos(req.companyId);
  }
}
