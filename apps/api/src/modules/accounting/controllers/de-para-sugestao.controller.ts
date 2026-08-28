// apps/api/src/modules/accounting/controllers/de-para-sugestao.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { DeParaSugestaoService } from '../services/de-para-sugestao.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/de-para')
export class DeParaSugestaoController {
  constructor(private readonly svc: DeParaSugestaoService) {}

  @Get('sugerir')
  sugerir(@Req() req: any) {
    return this.svc.sugerirMapeamento(req.companyId);
  }

  @Post('confirmar')
  confirmar(
    @Req() req: any,
    @Body() body: { mapeamentos: { sourceId: string; targetId: string; matchType: 'SUGGESTED_CONFIRMED' | 'MANUAL' }[] },
  ) {
    return this.svc.confirmarMapeamento(req.companyId, body.mapeamentos, req.user?.id);
  }
}
