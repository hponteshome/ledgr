// apps/api/src/modules/corporate/pdf/corporate-pdf.controller.ts
import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CorporatePdfService } from './corporate-pdf.service';
import { PrismaService } from '../../../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('corporate/pdf')
export class CorporatePdfController {
  constructor(
    private pdfService: CorporatePdfService,
    private prisma: PrismaService,
  ) {}

  @Get('share-register')
  async shareRegister(@Request() req, @Res() res: Response) {
    const company = await this.prisma.company.findUnique({ where: { id: req.companyId } });
    const { buffer } = await this.pdfService.generateShareRegisterPdf(req.companyId, company);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=livro-registro-acionistas.pdf');
    res.send(buffer);
  }

  @Get('transfer-register')
  async transferRegister(@Request() req, @Res() res: Response, @Query('year') year?: string) {
    const company = await this.prisma.company.findUnique({ where: { id: req.companyId } });
    const { buffer } = await this.pdfService.generateTransferRegisterPdf(
      req.companyId, company, year ? Number(year) : undefined
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=livro-transferencia.pdf');
    res.send(buffer);
  }
}