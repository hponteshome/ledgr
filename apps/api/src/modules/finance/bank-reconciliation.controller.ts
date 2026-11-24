// apps/api/src/modules/finance/bank-reconciliation.controller.ts
// EXTBB-10A (23/11/2026) - Extratos e Conciliacao (recurso de menu: conciliacao-bancaria)
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
import { Controller, Get, Patch, Post, Body, Param, Req, UseGuards, UseInterceptors, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { BankReconciliationService, SetBankLinesDto } from './bank-reconciliation.service';

@UseGuards(SidebarResourceGuard) // Seguranca 0A: perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('conciliacao-bancaria')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('bank-import/statements')
export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  @Get(':id/lines')
  lines(@Param('id') id: string, @Req() req: any) {
    return this.service.getLines(req.companyId, id);
  }

  @Patch(':id/lines')
  @HttpCode(HttpStatus.OK)
  setLines(@Param('id') id: string, @Req() req: any, @Body() dto: SetBankLinesDto) {
    return this.service.setLines(req.companyId, id, dto, req.user.id);
  }

  // EXTINV-01: aplicacoes candidatas (com a divisao calculada) para um resgate do extrato
  @Get(':id/lines/:lineId/invest-options')
  investOptions(@Param('id') id: string, @Param('lineId') lineId: string, @Req() req: any) {
    return this.service.investOptions(req.companyId, id, lineId);
  }

  @Get(':id/preview')
  preview(@Param('id') id: string, @Req() req: any) {
    return this.service.preview(req.companyId, id);
  }

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  post(@Param('id') id: string, @Req() req: any) {
    return this.service.post(req.companyId, id, req.user.id);
  }
}
