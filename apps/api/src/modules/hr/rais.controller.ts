import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
import { Controller, Get, Post, Patch, Param, Body, Req, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { RaisService } from './services/rais.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
@Controller('hr/rais')
@UseGuards(SidebarResourceGuard) // Seguranca 0A (04/10/2026): perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('esocial')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
export class RaisController {
  constructor(private svc: RaisService) {}
  @Post('gerar')
  gerar(@Req() req: any, @Body('anoBase') ano: number) {
    return this.svc.gerarDeclaracao(req.companyId, ano || new Date().getFullYear()-1, req.user.id);
  }
  @Get()
  listar(@Req() req: any) { return this.svc.listar(req.companyId); }
  @Patch(':id/registrar-envio')
  envio(@Req() req: any, @Param('id') id: string, @Body('protocolo') p: string) {
    return this.svc.registrarEnvio(req.companyId, id, p);
  }
}
