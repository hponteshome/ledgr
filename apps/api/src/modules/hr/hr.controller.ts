// apps/api/src/modules/hr/hr.controller.ts
import { Controller, Get, Post, Param, Body, Res, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { EsocialS2200Service } from './services/esocial-s2200.service';
import { EsocialEventsService } from './services/esocial-events.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('hr')
export class HrController {
  constructor(
    private readonly svc2200: EsocialS2200Service,
    private readonly events: EsocialEventsService,
  ) {}

  // ── S-2200 Admissao ──────────────────────────────────────────────────────────
  @Get('esocial/s2200/:employeeId')
  async s2200(@Req() req: any, @Param('employeeId') id: string, @Res() res: Response) {
    const xml = await this.svc2200.generateS2200(req.companyId, id);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="S-2200-${id}.xml"`);
    return res.send(xml);
  }

  @Get('esocial/s2200')
  s2200All(@Req() req: any) {
    return this.svc2200.generateAllS2200(req.companyId);
  }

  // ── S-2205 Alteracao Contratual ──────────────────────────────────────────────
  @Post('esocial/s2205/:employeeId')
  async s2205(@Req() req: any, @Param('employeeId') id: string, @Body() body: any, @Res() res: Response) {
    const xml = await this.events.generateS2205(req.companyId, id, body);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="S-2205-${id}.xml"`);
    return res.send(xml);
  }

  // ── S-2299 Desligamento ──────────────────────────────────────────────────────
  @Post('esocial/s2299/:employeeId')
  async s2299(@Req() req: any, @Param('employeeId') id: string, @Body() body: any, @Res() res: Response) {
    const xml = await this.events.generateS2299(req.companyId, id, body);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="S-2299-${id}.xml"`);
    return res.send(xml);
  }

  // ── S-1200 Remuneracao ───────────────────────────────────────────────────────
  @Post('esocial/s1200/:employeeId')
  async s1200(@Req() req: any, @Param('employeeId') id: string, @Body() body: any, @Res() res: Response) {
    const xml = await this.events.generateS1200(req.companyId, id, body);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="S-1200-${id}.xml"`);
    return res.send(xml);
  }

  // ── Listagem de eventos ──────────────────────────────────────────────────────
  @Get('esocial/eventos')
  listEvents(@Req() req: any) {
    return this.events.listEvents(req.companyId);
  }
}
