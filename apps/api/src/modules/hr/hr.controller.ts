// apps/api/src/modules/hr/hr.controller.ts
import { Controller, Get, Post, Param, Body, Res, Query, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { EsocialS2200Service } from './services/esocial-s2200.service';
import { EsocialEventsService } from './services/esocial-events.service';
import { EsocialTransmissionService } from './services/esocial-transmission.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('hr')
export class HrController {
  constructor(
    private readonly svc2200: EsocialS2200Service,
    private readonly events: EsocialEventsService,
    private readonly transmission: EsocialTransmissionService,
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
  @Get('esocial/s2299/:employeeId')
  async s2299auto(@Req() req: any, @Param('employeeId') id: string, @Query('tpAmb') tpAmb: string, @Res() res: Response) {
    const amb = (tpAmb === '1') ? '1' : '2';
    const xml = await this.events.generateS2299FromTermination(req.companyId, id, amb as '1'|'2');
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="S-2299-${id}.xml"`);
    return res.send(xml);
  }

  @Post('esocial/s2299/:employeeId')
  async s2299(@Req() req: any, @Param('employeeId') id: string, @Body() body: any, @Res() res: Response) {
    const xml = await this.events.generateS2299(req.companyId, id, body);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="S-2299-${id}.xml"`);
    return res.send(xml);
  }

  // ── S-1200 Remuneracao ───────────────────────────────────────────────────────
  @Post('esocial/s2230/:employeeId')
  async s2230xml(@Req() req: any, @Param('employeeId') id: string, @Body() body: any, @Res() res: Response) {
    const xml = await this.events.generateS2230(req.companyId, id, body);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="S-2230-${id}.xml"`);
    return res.send(xml);
  }

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

  @Post('esocial/transmitir/s1200/:employeeId')
  async transmitirS1200(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Body() body: any,
  ) {
    const tpAmb = body.tpAmb === '1' ? '1' : '2';
    return this.transmission.transmitirS1200(req.companyId, employeeId, {
      perApur: body.perApur,
      vrBcCpMensal: parseFloat(String(body.vrBcCp ?? body.vrBcCpMensal ?? 0).replace(',','.')),
      tpAmb,
    });
  }

  @Post('esocial/transmitir/s2230/:employeeId')
  async transmitirS2230(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Body() body: any,
  ) {
    const tpAmb = body.tpAmb === '1' ? '1' : '2';
    return this.transmission.transmitirS2230(req.companyId, employeeId, { ...body, tpAmb });
  }

  @Post('esocial/transmitir/s2240/:employeeId')
  async txS2240(@Req() req: any, @Param('employeeId') id: string, @Body() body: any) {
    return this.transmission.transmitirS2240(req.companyId, id, body);
  }
  @Post('esocial/s2240/:employeeId')
  async xmlS2240(@Req() req: any, @Param('employeeId') id: string, @Body() body: any, @Res() res: Response) {
    const xml = await this.events.generateS2240(req.companyId, id, body);
    res.setHeader('Content-Type','application/xml');
    res.setHeader('Content-Disposition',`attachment; filename="S-2240-${id}.xml"`);
    return res.send(xml);
  }

  @Post('esocial/transmitir/s2210/:employeeId')
  async txS2210(@Req() req: any, @Param('employeeId') id: string, @Body() body: any) {
    return this.transmission.transmitirS2210(req.companyId, id, body);
  }
  @Post('esocial/s2210/:employeeId')
  async xmlS2210(@Req() req: any, @Param('employeeId') id: string, @Body() body: any, @Res() res: Response) {
    const xml = await this.events.generateS2210(req.companyId, id, body);
    res.setHeader('Content-Type','application/xml');
    res.setHeader('Content-Disposition',`attachment; filename="S-2210-${id}.xml"`);
    return res.send(xml);
  }

  @Post('esocial/transmitir/s1210/:employeeId')
  async txS1210(@Req() req: any, @Param('employeeId') id: string, @Body() body: any) {
    return this.transmission.transmitirS1210(req.companyId, id, body);
  }
  @Post('esocial/s1210/:employeeId')
  async xmlS1210(@Req() req: any, @Param('employeeId') id: string, @Body() body: any, @Res() res: Response) {
    const xml = await this.events.generateS1210(req.companyId, id, body);
    res.setHeader('Content-Type','application/xml');
    res.setHeader('Content-Disposition',`attachment; filename="S-1210-${id}.xml"`);
    return res.send(xml);
  }

  // S-2190
  @Post('esocial/s2190/:eid') async xmlS2190(@Req() r:any,@Param('eid') id:string,@Body() b:any,@Res() res:Response){const x=await this.events.generateS2190(r.companyId,id,b);res.setHeader('Content-Type','application/xml');res.setHeader('Content-Disposition',`attachment; filename="S-2190-${id}.xml"`);return res.send(x);}
  @Post('esocial/transmitir/s2190/:eid') async txS2190(@Req() r:any,@Param('eid') id:string,@Body() b:any){return this.transmission.transmitirS2190(r.companyId,id,b);}
  // S-1202
  @Post('esocial/s1202/:eid') async xmlS1202(@Req() r:any,@Param('eid') id:string,@Body() b:any,@Res() res:Response){const x=await this.events.generateS1202(r.companyId,id,b);res.setHeader('Content-Type','application/xml');res.setHeader('Content-Disposition',`attachment; filename="S-1202-${id}.xml"`);return res.send(x);}
  @Post('esocial/transmitir/s1202/:eid') async txS1202(@Req() r:any,@Param('eid') id:string,@Body() b:any){return this.transmission.transmitirS1202(r.companyId,id,b);}
  // S-2220
  @Post('esocial/s2220/:eid') async xmlS2220(@Req() r:any,@Param('eid') id:string,@Body() b:any,@Res() res:Response){const x=await this.events.generateS2220(r.companyId,id,b);res.setHeader('Content-Type','application/xml');res.setHeader('Content-Disposition',`attachment; filename="S-2220-${id}.xml"`);return res.send(x);}
  @Post('esocial/transmitir/s2220/:eid') async txS2220(@Req() r:any,@Param('eid') id:string,@Body() b:any){return this.transmission.transmitirS2220(r.companyId,id,b);}
  // S-1070 (empresa)
  @Post('esocial/s1070') async xmlS1070(@Req() r:any,@Body() b:any,@Res() res:Response){const x=await this.events.generateS1070(r.companyId,b);res.setHeader('Content-Type','application/xml');res.setHeader('Content-Disposition','attachment; filename="S-1070.xml"');return res.send(x);}
  @Post('esocial/transmitir/s1070') async txS1070(@Req() r:any,@Body() b:any){return this.transmission.transmitirS1070(r.companyId,b);}
  // S-2298
  @Post('esocial/s2298/:eid') async xmlS2298(@Req() r:any,@Param('eid') id:string,@Body() b:any,@Res() res:Response){const x=await this.events.generateS2298(r.companyId,id,b);res.setHeader('Content-Type','application/xml');res.setHeader('Content-Disposition',`attachment; filename="S-2298-${id}.xml"`);return res.send(x);}
  @Post('esocial/transmitir/s2298/:eid') async txS2298(@Req() r:any,@Param('eid') id:string,@Body() b:any){return this.transmission.transmitirS2298(r.companyId,id,b);}

  @Post('esocial/transmitir/s1299')
  async transmitirS1299(
    @Req() req: any,
    @Body('perApur') perApur: string,
    @Body('tpAmb') tpAmb: string,
  ) {
    return this.transmission.transmitirS1299(req.companyId, perApur, (tpAmb === '1' ? '1' : '2'));
  }

  @Post('esocial/transmitir/s2299/:employeeId')
  async transmitirS2299(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Body('tpAmb') tpAmb: string,
  ) {
    return this.transmission.transmitirS2299(req.companyId, employeeId, (tpAmb === '1' ? '1' : '2'));
  }

  @Get('esocial/transmissoes')
  listarTransmissoes(@Req() req: any) {
    return this.transmission.listarEventos(req.companyId);
  }
}