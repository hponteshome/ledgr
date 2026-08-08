// apps/api/src/modules/accounting/controllers/encerramento-exercicio.controller.ts

import { Controller, Get, Post, Query, Body, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { EncerramentoExercicioService } from '../services/encerramento-exercicio.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/encerramento')
export class EncerramentoExercicioController {
  constructor(private readonly svc: EncerramentoExercicioService) {}

  @Get('preview')
  preview(@Req() req: any, @Query('year') year: string) {
    return this.svc.preview(req.companyId, parseInt(year, 10));
  }

  @Post('confirmar')
  confirmar(@Req() req: any, @Body() body: { year: number }) {
    return this.svc.confirmar(req.companyId, req.user.id, body.year);
  }

  @Post('reverter')
  reverter(@Req() req: any, @Body() body: { year: number }) {
    return this.svc.reverter(req.companyId, body.year);
  }
}
