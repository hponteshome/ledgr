// apps/api/src/modules/hr/pro-labore.controller.ts
import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { ProLaboreService } from './services/pro-labore.service';

@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('hr/pro-labore')
export class ProLaboreController {
  constructor(private readonly svc: ProLaboreService) {}

  @Get('configs')
  findAllConfigs(@Request() req: any) {
    return this.svc.findAllConfigs(req.companyId);
  }

  @Post('configs')
  createConfig(@Body() dto: any, @Request() req: any) {
    return this.svc.createConfig(req.companyId, dto);
  }

  @Put('configs/:id')
  updateConfig(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.svc.updateConfig(id, req.companyId, dto);
  }

  @Get('previa')
  calcularPrevia(@Query('valorBruto') valorBruto: string) {
    return this.svc.calcularPrevia(parseFloat(valorBruto));
  }

  @Post('calculos')
  gerarCalculo(@Body() dto: any, @Request() req: any) {
    return this.svc.gerarCalculo(req.companyId, req.user.id, dto);
  }

  @Get('calculos')
  findCalculos(@Request() req: any, @Query('competencia') competencia?: string) {
    return this.svc.findCalculos(req.companyId, competencia);
  }

  @Post('calculos/retroativos')
  gerarRetroativos(@Body() body: any, @Request() req: any) {
    return this.svc.gerarLancamentosRetroativos(req.companyId, req.user.id, body?.competenceFrom, body?.competenceTo);
  }
}

