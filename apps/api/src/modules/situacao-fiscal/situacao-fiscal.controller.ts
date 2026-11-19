// apps/api/src/modules/situacao-fiscal/situacao-fiscal.controller.ts
// DASH-03 (13/11/2026): painel de situacao fiscal (Dashboard), resolucao de alertas e atualizacao de obrigacoes.
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { isMasterAdmin } from '../../multi-company/company.interceptor';
import { SituacaoFiscalService } from './situacao-fiscal.service';
import { RecibosService } from './recibos.service';

@UseGuards(JwtAuthGuard)
@Controller('situacao-fiscal')
export class SituacaoFiscalController {
  constructor(private svc: SituacaoFiscalService, private recibos: RecibosService) {}

  @Get()
  painel(@Req() req: any) {
    return this.svc.painel(req.headers['x-company-id'] ?? '');
  }

  @Post('alertas/:id/resolver')
  resolver(@Req() req: any, @Param('id') id: string, @Body('nota') nota: string) {
    return this.svc.resolverAlerta(req.headers['x-company-id'] ?? '', req.user?.id ?? req.user?.sub ?? '', id, nota, isMasterAdmin(req.user));
  }

  // ALERTA-AUTO-01: le os recibos arquivados (todos=true rele inclusive os ja lidos) e avalia as regras de baixa dos alertas
  @Post('recibos/processar')
  async processarRecibos(@Req() req: any, @Body('todos') todos?: boolean) {
    const cid = req.headers['x-company-id'] ?? '';
    const recibos = await this.recibos.processar(cid, todos === true);
    const alertasResolvidos = await this.recibos.avaliarAlertas(cid);
    return { ...recibos, alertasResolvidos };
  }

  @Patch('obrigacoes/:id')
  atualizar(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.atualizarObrigacao(req.headers['x-company-id'] ?? '', req.user?.id ?? req.user?.sub ?? '', id, dto ?? {});
  }
}
