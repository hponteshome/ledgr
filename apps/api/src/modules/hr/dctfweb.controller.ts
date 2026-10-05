import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
import { Controller, Get, Post, Param, Body, Req, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { DctfWebService } from './services/dctfweb.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
@Controller('hr/dctfweb')
@UseGuards(SidebarResourceGuard) // Seguranca 0A (04/10/2026): perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('folha')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
export class DctfWebController {
  constructor(private svc: DctfWebService) {}
  @Get('competencias')
  competencias(@Req() req: any) { return this.svc.listarCompetencias(req.companyId); }
  @Get(':competencia')
  consolidar(@Req() req: any, @Param('competencia') c: string) {
    return this.svc.consolidar(req.companyId, c);
  }
}
