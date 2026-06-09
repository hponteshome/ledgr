// apps/api/src/modules/sped/efd/controllers/efd.controller.ts
import JSZip = require('jszip');
import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
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
    @Res() res: any,
  ) {
    const year  = parseInt(ano || String(new Date().getFullYear()));
    const month = parseInt(mes || String(new Date().getMonth() + 1));
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd   = new Date(Date.UTC(year, month, 0));
    const opts: any  = { companyId, periodStart, periodEnd };
    const buf = await this.exporter.export(opts);
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
  ) {
    const year  = parseInt(ano || String(new Date().getFullYear()));
    const month = parseInt(mes || String(new Date().getMonth() + 1));
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd   = new Date(Date.UTC(year, month, 0));
    const opts: any  = { companyId, periodStart, periodEnd };
    const buf = await this.exporter.export(opts);
    const text  = buf.toString('latin1');
    const lines = text.split('\n').filter(Boolean);
    return {
      totalLinhas: lines.length,
      competencia: `${String(month).padStart(2,'0')}/${year}`,
      regime:      opts.regime     || 'LUCRO_REAL',
      incidencia:  opts.incidencia || 'NAO_CUMULATIVO',
      preview:     lines.slice(0, 50),
    };
  }

  @Get('export-lote')
  async exportLote(
    @Company() companyId: string,
    @Query('ano') ano: string,
    @Res() res: any,
  ) {
    const year = parseInt(ano || String(new Date().getFullYear()));
    const company = await this.exporter['prisma'].company.findUnique({
      where: { id: companyId }, select: { taxId: true },
    });
    const cnpjRaiz = (company?.taxId || '').replace(/\D/g,'').slice(0,8);
    const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const zip = new JSZip();
    const resultados: { mes: string; linhas: number; status: string; cnpjRaiz?: string }[] = [];
    for (let m = 1; m <= 12; m++) {
      const periodStart = new Date(Date.UTC(year, m - 1, 1));
      const periodEnd   = new Date(Date.UTC(year, m, 0));
      try {
        const opts: any = { companyId, periodStart, periodEnd };
        const buf = await this.exporter.export(opts);
        const filename = `EFD_${MESES[m-1]}${String(year).slice(-2)}_${cnpjRaiz}.txt`;
        zip.file(filename, buf);
        const linhas = buf.toString('latin1').split('\n').filter(Boolean).length;
        resultados.push({ mes: `${String(m).padStart(2,'0')}/${year}`, linhas, status: 'OK', cnpjRaiz });
      } catch (e: any) {
        resultados.push({ mes: `${String(m).padStart(2,'0')}/${year}`, linhas: 0, status: `ERRO: ${e.message}` });
      }
    }
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const zipName = `EFD_${year}_${cnpjRaiz}.zip`;
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'X-Efd-Resultados': JSON.stringify(resultados),
      'X-Company-Cnpj':   cnpjRaiz,
      'Access-Control-Expose-Headers': 'X-Efd-Resultados, X-Company-Cnpj',
    });
    res.send(zipBuf);
  }
}
