// apps/api/src/modules/accounting/controllers/historico-padrao.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { HistoricoPadraoService, CreateHistoricoPadraoDto, UpdateHistoricoPadraoDto } from '../services/historico-padrao.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/historico-padrao')
export class HistoricoPadraoController {
  constructor(private readonly svc: HistoricoPadraoService) {}

  @Get()
  findAll(@Req() req: any, @Query('includeInactive') includeInactive?: string) {
    return this.svc.findAll(req.companyId, includeInactive === 'true');
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateHistoricoPadraoDto) {
    return this.svc.create(req.companyId, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateHistoricoPadraoDto) {
    return this.svc.update(req.companyId, id, dto);
  }

  @Patch(':id/ativo')
  toggleActive(@Req() req: any, @Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.svc.toggleActive(req.companyId, id, isActive);
  }
}
