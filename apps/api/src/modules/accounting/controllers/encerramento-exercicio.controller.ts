import { SidebarResourceGuard } from '../../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../../auth/decorators/recurso-menu.decorator';
// apps/api/src/modules/accounting/controllers/encerramento-exercicio.controller.ts

import { Controller, Get, Post, Query, Body, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { EncerramentoExercicioService } from '../services/encerramento-exercicio.service';

@UseGuards(SidebarResourceGuard) // Seguranca 0A (04/10/2026): perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('relatorios-contabeis')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/encerramento')
export class EncerramentoExercicioController {
  constructor(private readonly svc: EncerramentoExercicioService) {}

  @Get('exercicios')
  exercicios(@Req() req: any) {
    return this.svc.listarExercicios(req.companyId);
  }

  @Get('fechamentos')
  fechamentos(@Req() req: any, @Query('year') year: string) {
    return this.svc.listarFechamentosDoAno(req.companyId, parseInt(year, 10));
  }

  @Get('preview')
  preview(@Req() req: any, @Query('year') year: string, @Query('closingDate') closingDate?: string) {
    return this.svc.preview(req.companyId, parseInt(year, 10), closingDate);
  }

  @Post('confirmar')
  confirmar(@Req() req: any, @Body() body: { year: number; closingDate?: string }) {
    return this.svc.confirmar(req.companyId, req.user.id, body.year, body.closingDate);
  }

  @Post('reverter')
  reverter(@Req() req: any, @Body() body: { year: number; closingDate?: string }) {
    return this.svc.reverter(req.companyId, body.year, body.closingDate);
  }
}
