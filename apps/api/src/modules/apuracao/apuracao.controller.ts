// apps/api/src/modules/apuracao/apuracao.controller.ts
import { Controller, Get, Post, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { ApuracaoService } from './apuracao.service';

@UseGuards(JwtAuthGuard)
@Controller('apuracao')
export class ApuracaoController {
  constructor(private readonly svc: ApuracaoService) {}

  @Get('competencia/:comp')
  getByCompetencia(@Req() req: any, @Param('comp') comp: string) {
    return this.svc.getByCompetencia(req.companyId, comp);
  }

  @Get()
  listar(@Req() req: any, @Query('ano') ano?: string) {
    return this.svc.listar(req.companyId, ano);
  }

  @Get('resultado/:comp')
  getResultado(@Req() req: any, @Param('comp') comp: string) {
    return this.svc.getResultadoContabil(req.companyId, comp);
  }

  @Get('receitas/:comp')
  getReceitas(@Req() req: any, @Param('comp') comp: string) {
    return this.svc.getReceitasBrutas(req.companyId, comp);
  }

  @Post('pis-cofins/:comp')
  calcPisCofins(@Req() req: any, @Param('comp') comp: string, @Body() dto: any) {
    return this.svc.calcularPisCofins(req.companyId, comp, dto, req.user.id);
  }

  @Post('irpj-csll/:comp')
  calcIrpjCsll(@Req() req: any, @Param('comp') comp: string, @Body() dto: any) {
    return this.svc.calcularIrpjCsll(req.companyId, comp, dto, req.user.id);
  }

  @Get('lalur/:comp')
  getLalur(@Req() req: any, @Param('comp') comp: string) {
    return this.svc.getLalur(req.companyId, comp);
  }

  @Post('lalur/:comp')
  addLalur(@Req() req: any, @Param('comp') comp: string, @Body() dto: any) {
    return this.svc.addLalurItem(req.companyId, comp, dto, req.user.id);
  }

  @Delete('lalur/:comp/:id')
  deleteLalur(@Req() req: any, @Param('comp') comp: string, @Param('id') id: string) {
    return this.svc.deleteLalurItem(req.companyId, id);
  }
}
