// apps/api/src/modules/hr/rescisao.controller.ts
import { Controller, Get, Post, Put, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { RescisaoService } from './services/rescisao.service';

@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('hr/employees/:employeeId/rescisao')
export class RescisaoController {
  constructor(private readonly svc: RescisaoService) {}

  @Post('calcular')
  calcular(@Param('employeeId') employeeId: string, @Body() dto: any, @Request() req: any) {
    return this.svc.calcular(req.companyId, employeeId, dto);
  }

  @Post()
  confirmar(@Param('employeeId') employeeId: string, @Body() dto: any, @Request() req: any) {
    return this.svc.confirmar(req.companyId, employeeId, req.user.id, dto);
  }

  @Get()
  buscar(@Param('employeeId') employeeId: string, @Request() req: any) {
    return this.svc.buscar(req.companyId, employeeId);
  }

  @Put(':id/status')
  atualizarStatus(@Param('employeeId') employeeId: string, @Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.svc.atualizarStatus(req.companyId, id, body.status);
  }
}
