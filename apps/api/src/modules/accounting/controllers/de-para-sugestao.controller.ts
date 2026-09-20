// apps/api/src/modules/accounting/controllers/de-para-sugestao.controller.ts
import { Body, Controller, Get, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { DeParaSugestaoService } from '../services/de-para-sugestao.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/de-para')
export class DeParaSugestaoController {
  constructor(private readonly svc: DeParaSugestaoService) {}

  @Get('sugerir')
  sugerir(@Req() req: any, @Query('dataFechamento') dataFechamento?: string) {
    return this.svc.sugerirMapeamento(req.companyId, dataFechamento);
  }

  // NOVO (16/09/2026): lista os exercicios (lotes ECD) disponiveis pra
  // De/Para, com contagem de pendentes/confirmadas por ano - alimenta os
  // "pills" coloridos na tela (verde = tudo confirmado, vermelho = tem
  // pendencia).
  @Get('exercicios')
  exercicios(@Req() req: any) {
    return this.svc.listarExercicios(req.companyId);
  }

  @Post('confirmar')
  confirmar(
    @Req() req: any,
    @Body() body: { mapeamentos: { sourceId: string; targetId: string; matchType: 'SUGGESTED_CONFIRMED' | 'MANUAL' }[] },
  ) {
    return this.svc.confirmarMapeamento(req.companyId, body.mapeamentos, req.user?.id);
  }
}
