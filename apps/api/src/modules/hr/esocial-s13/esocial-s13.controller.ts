// apps/api/src/modules/hr/esocial-s13/esocial-s13.controller.ts
// LEDGR - eSocial S-1.3 (17/11/2026)
import { Controller, Get, Post, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
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

  @Get('eventos')
  listar(@Query('tpAmb') tpAmb: string, @Request() req: any) {
    return this.svc.listar(req.companyId, Number(tpAmb) || 2);
  }

  @Get('eventos/:id/xml')
  xml(@Param('id') id: string, @Request() req: any) {
    return this.svc.xml(req.companyId, id);
  }

  @Post('enviar')
  enviar(@Body() dto: any, @Request() req: any) {
    return this.svc.enviar(req.companyId, dto);
  }

  @Post('consultar')
  consultar(@Body() dto: any, @Request() req: any) {
    return this.svc.consultar(req.companyId, dto);
  }

  @Get('lotes')
  lotes(@Query('tpAmb') tpAmb: string, @Request() req: any) {
    return this.svc.listarLotes(req.companyId, Number(tpAmb) || 2);
  }

  // processamento mensal (18/11/2026)
  @Post('reabrir')
  reabrir(@Body() dto: any, @Request() req: any) {
    return this.svc.reabrir(req.companyId, dto);
  }

  @Get('competencias')
  competencias(@Query('tpAmb') tpAmb: string, @Request() req: any) {
    return this.svc.competencias(req.companyId, Number(tpAmb) || 1);
  }

  @Post('previa')
  previa(@Body() dto: any, @Request() req: any) {
    return this.svc.gerarPacote(req.companyId, dto, true);
  }

  @Post('aprovar')
  aprovar(@Body() dto: any, @Request() req: any) {
    return this.svc.aprovar(req.companyId, req.user?.id || null, dto);
  }

  @Get('pagamentos/adiantamentos')
  adiantamentos(@Query('personId') personId: string, @Request() req: any) {
    return this.svc.adiantamentosDisponiveis(req.companyId, personId);
  }

  @Get('pagamentos/sugestao')
  sugestao(@Query('personId') personId: string, @Query('competencia') competencia: string, @Request() req: any) {
    return this.svc.sugestaoLiquido(req.companyId, personId, competencia);
  }

  @Post('pagamentos')
  registrarPagamento(@Body() dto: any, @Request() req: any) {
    return this.svc.registrarPagamento(req.companyId, dto);
  }

  @Delete('pagamentos/:id')
  excluirPagamento(@Param('id') id: string, @Request() req: any) {
    return this.svc.excluirPagamento(req.companyId, id);
  }

  @Get('pagamentos')
  pagamentos(@Request() req: any) {
    return this.svc.pagamentos(req.companyId);
  }
}
