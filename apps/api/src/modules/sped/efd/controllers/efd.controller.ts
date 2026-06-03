// apps/api/src/modules/sped/efd/controllers/efd.controller.ts
import { Controller, Get, Post, Param, Query, Res, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { Company } from '@/multi-company/company.decorator';
import { EfdExporterService } from '../services/efd-exporter.service';

@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('sped/efd-contribuicoes')
export class EfdController {
  constructor(private readonly exporter: EfdExporterService) {}

  @Get('export')
  async exportEfd(
    @Company() companyId: string,
    @Query('ano') ano: string,
    @Query('mes') mes: string,
    @Query('regime') regime: string,
    @Query('incidencia') incidencia: string,
    @Res() res: any,
  ) {
    const year  = parseInt(ano  || String(new Date().getFullYear()));
    const month = parseInt(mes  || String(new Date().getMonth() + 1));
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd   = new Date(Date.UTC(year, month, 0));

    const buf = await this.exporter.export({
      companyId, periodStart, periodEnd,
      regime:     regime     || 'LUCRO_REAL',
      incidencia: incidencia || 'NAO_CUMULATIVO',
    });

    const filename = `EFD_CONTRIB_${String(month).padStart(2,'0')}${year}.txt`;
    const company = await this.exporter['prisma'].company.findUnique({
      where: { id: companyId }, select: { taxId: true },
    });
    const cnpjRaiz = (company?.taxId || '').replace(/\D/g,'').slice(0,8);
    res.set({
      'Content-Type':        'text/plain; charset=latin1',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Company-Cnpj':      cnpjRaiz,
      'Access-Control-Expose-Headers': 'X-Company-Cnpj',
    });
    res.send(buf);
  }

  @Get('preview')
  async previewEfd(
    @Company() companyId: string,
    @Query('ano') ano: string,
    @Query('mes') mes: string,
    @Query('regime') regime: string,
    @Query('incidencia') incidencia: string,
  ) {
    const year  = parseInt(ano  || String(new Date().getFullYear()));
    const month = parseInt(mes  || String(new Date().getMonth() + 1));
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd   = new Date(Date.UTC(year, month, 0));

    const buf = await this.exporter.export({
      companyId, periodStart, periodEnd,
      regime:     regime     || 'LUCRO_REAL',
      incidencia: incidencia || 'NAO_CUMULATIVO',
    });

    const text  = buf.toString('latin1');
    const lines = text.split('\n').filter(Boolean);
    return {
      totalLinhas: lines.length,
      competencia: `${String(month).padStart(2,'0')}/${year}`,
      regime:      regime || 'LUCRO_REAL',
      incidencia:  incidencia || 'NAO_CUMULATIVO',
      preview:     lines.slice(0, 50),  // primeiras 50 linhas
    };
  }
}
