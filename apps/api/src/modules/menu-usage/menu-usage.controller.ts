// apps/api/src/modules/menu-usage/menu-usage.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MenuUsageService } from './menu-usage.service';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('menu-usage')
export class MenuUsageController {
  constructor(private readonly svc: MenuUsageService) {}

  // POST /menu-usage/track - fire-and-forget a cada navegacao (Estagio 3:
  // auditoria de uso do menu). Global, nao e por empresa.
  @Post('track')
  @SkipCompanyCheck()
  track(@Body() body: { path: string; label?: string; moduleLabel?: string }) {
    return this.svc.track(body.path, body.label, body.moduleLabel);
  }

  // GET /menu-usage/report - cruza o catalogo de rotas com os contadores,
  // incluindo rotas nunca utilizadas. Visibilidade da tela que consome isso
  // ja e controlada pelo proprio sidebar_items/profile_sidebar_permissions
  // (mesmo padrao usado no resto do sistema para paginas administrativas).
  @Get('report')
  @SkipCompanyCheck()
  report() {
    return this.svc.report();
  }
}
