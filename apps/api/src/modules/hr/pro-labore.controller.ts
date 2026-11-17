import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
// apps/api/src/modules/hr/pro-labore.controller.ts
// 17/11/2026: rotas antigas (configs, previa, calculos, retroativos e guias GPS/DARF) removidas.
// O pro-labore parte do QSA; calculo, recibo e guias virao do novo fluxo eSocial S-1.3 + DCTFWeb.
import { Controller, Get, Put, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { ProLaboreService } from './services/pro-labore.service';

@UseGuards(SidebarResourceGuard) // Seguranca 0A (04/10/2026): perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('folha')
@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('hr/pro-labore')
export class ProLaboreController {
  constructor(private readonly svc: ProLaboreService) {}

  @Get('diretoria')
  diretoria(@Request() req: any) {
    return this.svc.diretoria(req.companyId);
  }

  @Put('diretoria/:shareholderId')
  salvarDiretoria(@Param('shareholderId') shareholderId: string, @Body() dto: any, @Request() req: any) {
    return this.svc.salvarDiretoria(req.companyId, shareholderId, dto);
  }
}
