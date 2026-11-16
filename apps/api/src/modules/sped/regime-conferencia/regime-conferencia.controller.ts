// apps/api/src/modules/sped/regime-conferencia/regime-conferencia.controller.ts
// REGIMES x DECLARACOES - CRIADO 16/11/2026. GET = consulta; POST criar-regimes = so Master.
import { SidebarResourceGuard } from '../../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../../auth/decorators/recurso-menu.decorator';
import { Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@auth/guards/jwt.guard';
import { CompanyGuard } from '@multi-company/multi-company.guard';
import { Company } from '@multi-company/company.decorator';
import { isMasterAdmin } from '../../../multi-company/company.interceptor';
import { RegimeConferenciaService } from './regime-conferencia.service';

@Controller('sped/regime-conferencia')
@UseGuards(SidebarResourceGuard) // mesmo padrao do EcfArquivoController (roda depois do JwtAuthGuard)
@RecursoMenu('ecf')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class RegimeConferenciaController {
  constructor(private readonly service: RegimeConferenciaService) {}

  @Get()
  async conferencia(@Company() companyId: string, @Req() req: any) {
    const r = await this.service.conferencia(companyId);
    return { ...r, master: isMasterAdmin(req.user) };
  }

  @Post('criar-regimes')
  criarRegimes(@Company() companyId: string, @Req() req: any) {
    if (!isMasterAdmin(req.user)) throw new ForbiddenException('Acao restrita ao administrador.');
    return this.service.criarRegimes(companyId);
  }
}
