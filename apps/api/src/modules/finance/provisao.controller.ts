// apps/api/src/modules/finance/provisao.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { ProvisaoService } from './provisao.service';
import { isMasterAdmin } from '../../multi-company/company.interceptor';

@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('finance/provisoes')
export class ProvisaoController {
  constructor(private readonly svc: ProvisaoService) {}

  @Get('configs')
  findAllConfigs(@Request() req: any) {
    return this.svc.findAllConfigs(req.companyId);
  }

  @Post('configs')
  createConfig(@Body() dto: any, @Request() req: any) {
    return this.svc.createConfig(req.companyId, dto, req.user?.id);
  }

  @Put('configs/:id')
  updateConfig(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.svc.updateConfig(id, req.companyId, dto, req.user?.id);
  }

  @Delete('configs/:id')
  deleteConfig(@Param('id') id: string, @Request() req: any) {
    return this.svc.deleteConfig(id, req.companyId); // Seguranca 0A
  }

  @Post('gerar')
  gerarLancamentos(@Body() body: any, @Request() req: any) {
    return this.svc.gerarLancamentos(req.companyId, req.user.id, body.competencia);
  }

  @Get('lancamentos')
  findLancamentos(@Request() req: any, @Query('competencia') competencia?: string) {
    return this.svc.findLancamentos(req.companyId, competencia);
  }

  @Put('lancamentos/:id/conferir-nf')
  conferirNF(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.svc.conferirNF(id, dto, req.companyId); // Seguranca 0A
  }

  @Put('configs/:id/rateio/:competencia')
  updateRateio(@Param('id') id: string, @Param('competencia') competencia: string, @Body() body: any, @Request() req: any) {
    return this.svc.updateRateioCompetencia(id, competencia, body.rateios ?? [], req.companyId, isMasterAdmin(req.user) ? undefined : req.user?.id); // Seguranca 0A
  }
}
