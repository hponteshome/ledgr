// apps/api/src/modules/integridade/integridade.controller.ts
// CRIADO 27/10/2026 - Central de Integridade
import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { IntegridadeService } from './integridade.service';

@UseGuards(JwtAuthGuard)
@Controller('integridade')
export class IntegridadeController {
  constructor(private readonly svc: IntegridadeService) {}

  @Post('executar')
  executar(@Req() req: any) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? undefined;
    return this.svc.executar(companyId, userId, 'MANUAL');
  }

  @Get('ultima')
  ultima(@Req() req: any) {
    return this.svc.ultima(req.headers['x-company-id'] ?? '');
  }

  @Get('historico')
  historico(@Req() req: any) {
    return this.svc.historico(req.headers['x-company-id'] ?? '');
  }
}
