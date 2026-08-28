// apps/api/src/modules/accounting/controllers/abertura.controller.ts
import { Body, Controller, Get, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { AberturaService } from '../services/abertura.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/abertura')
export class AberturaController {
  constructor(private readonly svc: AberturaService) {}

  @Get('calcular')
  calcular(@Req() req: any, @Query('dataFechamento') dataFechamento: string) {
    return this.svc.calcularAbertura(req.companyId, dataFechamento);
  }

  @Post('registrar')
  registrar(@Req() req: any, @Body() dto: { dataFechamento: string; dataAbertura: string; referencia: string }) {
    return this.svc.registrarAbertura(req.companyId, dto.dataFechamento, dto.dataAbertura, dto.referencia, req.user?.id);
  }
}
