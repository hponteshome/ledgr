// apps/api/src/modules/hr/informe.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req, UseGuards, Res } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { InformeService } from './informe.service';
import { InformePdfService } from './informe-pdf.service';
import { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('hr/informes')
export class InformeController {
  constructor(
    private readonly svc: InformeService,
    private readonly pdf: InformePdfService,
  ) {}

  @Get()
  findAll(@Req() req: any, @Query('ano') ano?: string) {
    return this.svc.findAll(req.companyId, ano ? parseInt(ano) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.svc.findOne(id, req.companyId);
  }

  @Post()
  upsert(@Req() req: any, @Body() dto: any) {
    return this.svc.upsert(req.companyId, req.user.id, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() dto: any) {
    return this.svc.upsert(req.companyId, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.svc.remove(id, req.companyId);
  }

  @Get(':id/pdf')
  async pdf_download(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const informe = await this.svc.findOne(id, req.companyId);
    const buffer = await this.pdf.generate(informe);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="informe-rendimentos-${informe.anoCalendario}-${informe.person.cpf}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}