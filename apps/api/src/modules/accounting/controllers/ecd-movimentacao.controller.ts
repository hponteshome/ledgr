// apps/api/src/modules/accounting/controllers/ecd-movimentacao.controller.ts
// SOMENTE LEITURA - unico endpoint e GET, ver ecd-movimentacao.service.ts
import { Controller, Get, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { EcdMovimentacaoService } from '../services/ecd-movimentacao.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('sped/ecd-movimentacao')
export class EcdMovimentacaoController {
  constructor(private readonly svc: EcdMovimentacaoService) {}

  @Get()
  getMovimentacao(@Req() req: any) {
    return this.svc.getMovimentacao(req.companyId);
  }
}
