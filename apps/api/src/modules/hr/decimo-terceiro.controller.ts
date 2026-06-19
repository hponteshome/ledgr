import { Controller, Get, Post, Patch, Param, Body, Req, Res, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { DecimoTerceiroService } from './services/decimo-terceiro.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { Response } from 'express';
@Controller('hr/decimo-terceiro')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
export class DecimoTerceiroController {
  constructor(private svc: DecimoTerceiroService) {}
  @Post('calcular')
  calcular(@Req() req: any, @Body('ano') ano: number) {
    return this.svc.calcularParaEmpresa(req.companyId, ano || new Date().getFullYear(), req.user.id);
  }
  @Get()
  listar(@Req() req: any, @Query('ano') ano: string) {
    return this.svc.listar(req.companyId, parseInt(ano) || new Date().getFullYear());
  }
  @Patch(':id/pagar-primeira')
  pagar1(@Req() req: any, @Param('id') id: string, @Body('dataPgto') dt: string) {
    return this.svc.pagarPrimeira(req.companyId, id, dt);
  }
  @Patch(':id/pagar-segunda')
  pagar2(@Req() req: any, @Param('id') id: string, @Body('dataPgto') dt: string) {
    return this.svc.pagarSegunda(req.companyId, id, dt);
  }
  @Get(':id/recibo/:parcela/html')
  async reciboHtml(@Req() req: any, @Param('id') id: string, @Param('parcela') p: string, @Res() res: Response) {
    const html = await this.svc.gerarReciboHtml(req.companyId, id, parseInt(p) as 1|2);
    res.setHeader('Content-Type','text/html; charset=utf-8'); return res.send(html);
  }
  @Get(':id/recibo/:parcela/pdf')
  async reciboPdf(@Req() req: any, @Param('id') id: string, @Param('parcela') p: string, @Res() res: Response) {
    const html = await this.svc.gerarReciboHtml(req.companyId, id, parseInt(p) as 1|2);
    const pdf  = await this.svc.gerarPdf(html);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="13salario-${p}parcela-${id}.pdf"`);
    return res.send(pdf);
  }
}
