// apps/api/src/modules/hr/rescisao.controller.ts
import { Controller, Get, Post, Put, Body, Param, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { TrctPdfService } from './services/trct-pdf.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { RescisaoService } from './services/rescisao.service';

@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('hr/employees/:employeeId/rescisao')
export class RescisaoController {
  constructor(private readonly svc: RescisaoService, private readonly pdf: TrctPdfService) {}

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
  @Get(':employeeId/trct/html')
  async trctHtml(@Param('employeeId') employeeId: string, @Request() req: any, @Res() res: Response) {
    const html = await this.pdf.generateTRCTHtml(req.companyId, employeeId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Get(':employeeId/trct/pdf')
  async trctPdf(@Param('employeeId') employeeId: string, @Request() req: any, @Res() res: Response) {
    const buf = await this.pdf.generateTRCTPdf(req.companyId, employeeId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="TRCT-${employeeId}.pdf"`);
    return res.send(buf);
  }

  @Get(':employeeId/seguro-desemprego/html')
  async sdHtml(@Param('employeeId') employeeId: string, @Request() req: any, @Res() res: Response) {
    const html = await this.pdf.generateSDHtml(req.companyId, employeeId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Get(':employeeId/seguro-desemprego/pdf')
  async sdPdf(@Param('employeeId') employeeId: string, @Request() req: any, @Res() res: Response) {
    const buf = await this.pdf.generateSDPdf(req.companyId, employeeId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SD-${employeeId}.pdf"`);
    return res.send(buf);
  }
}