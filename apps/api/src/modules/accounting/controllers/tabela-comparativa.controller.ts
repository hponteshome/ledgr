import { SidebarResourceGuard } from '../../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../../auth/decorators/recurso-menu.decorator';
// apps/api/src/modules/accounting/controllers/tabela-comparativa.controller.ts
import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { TabelaComparativaService } from '../services/tabela-comparativa.service';

@UseGuards(SidebarResourceGuard) // Seguranca 0A (04/10/2026): perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('relatorios-contabeis')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/tabela-comparativa')
export class TabelaComparativaController {
  constructor(private readonly svc: TabelaComparativaService) {}

  @Get()
  getComparativo(
    @Req() req: any,
    @Query('anoInicio') anoInicio: string,
    @Query('anoFim') anoFim: string,
  ) {
    return this.svc.getComparativo(
      req.companyId,
      parseInt(anoInicio, 10) || 2017,
      parseInt(anoFim, 10) || new Date().getFullYear(),
    );
  }
}
