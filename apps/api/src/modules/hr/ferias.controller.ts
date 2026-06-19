import { Controller, Get, Post, Patch, Param, Body, Req, Res, Query, UseGuards } from '@nestjs/common';
import { FeriasService } from './services/ferias.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { UseInterceptors } from '@nestjs/common';
import { Response } from 'express';

@Controller('hr/ferias')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
export class FeriasController {
  constructor(private svc: FeriasService) {}

  // Inicializa periodos aquisitivos do funcionario
  @Get('funcionarios')
  funcionariosAtivos(@Req() req: any) {
    return this.svc.listarFuncionariosAtivos(req.companyId);
  }


  @Post('periodos/:employeeId/inicializar')
  inicializar(@Req() req: any, @Param('employeeId') eid: string) {
    return this.svc.inicializarPeriodos(req.companyId, eid, req.user.id);
  }

  // Lista periodos de um funcionario
  @Get('periodos/:employeeId')
  periodos(@Req() req: any, @Param('employeeId') eid: string) {
    return this.svc.listarPeriodos(req.companyId, eid);
  }

  // Preview do calculo
  @Post('calcular')
  calcular(@Body() body: any) {
    return this.svc.calcularFerias({
      salarioBase:    Number(body.salarioBase),
      diasFerias:     Number(body.diasFerias),
      diasAbono:      Number(body.diasAbono ?? 0),
      numDependentes: Number(body.numDependentes ?? 0),
    });
  }

  // Agenda ferias
  @Post('agendar/:employeeId')
  agendar(@Req() req: any, @Param('employeeId') eid: string, @Body() body: any) {
    return this.svc.agendar(req.companyId, eid, body, req.user.id);
  }

  // Lista programacoes da empresa
  @Get('programacoes')
  programacoes(@Req() req: any, @Query('employeeId') eid?: string, @Query('status') status?: string) {
    return this.svc.listarProgramacoes(req.companyId, { employeeId: eid, status });
  }

  // Atualiza status da programacao
  @Patch('programacoes/:id/status')
  status(@Req() req: any, @Param('id') id: string, @Body('status') status: string) {
    return this.svc.atualizarStatus(req.companyId, id, status);
  }

  // Aviso de ferias HTML
  @Get('programacoes/:id/aviso/html')
  async avisoHtml(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const html = await this.svc.gerarAvisoHtml(req.companyId, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  // Aviso de ferias PDF
  @Get('programacoes/:id/aviso/pdf')
  async avisoPdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const html = await this.svc.gerarAvisoHtml(req.companyId, id);
    const pdf  = await this.svc.gerarPdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="aviso-ferias-${id}.pdf"`);
    return res.send(pdf);
  }

  // Recibo de ferias HTML
  @Get('programacoes/:id/recibo/html')
  async reciboHtml(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const html = await this.svc.gerarReciboHtml(req.companyId, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  // Recibo de ferias PDF
  @Get('programacoes/:id/recibo/pdf')
  async reciboPdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const html = await this.svc.gerarReciboHtml(req.companyId, id);
    const pdf  = await this.svc.gerarPdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recibo-ferias-${id}.pdf"`);
    return res.send(pdf);
  }
}
