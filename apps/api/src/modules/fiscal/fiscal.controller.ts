import { Controller, Post, Get, UseGuards, UseInterceptors,
  UploadedFiles, Req, Body, Query, Param } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { NfseImportService } from './services/nfse-import.service';
import { NfeImportService  } from './services/nfe-import.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('fiscal')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
export class FiscalController {
  constructor(
    private nfse:   NfseImportService,
    private nfe:    NfeImportService,
    private prisma: PrismaService,
  ) {}

  // ── NFS-e SP ──────────────────────────────────────────────────
  @Post('nfse-sp/preview')
  @UseInterceptors(FilesInterceptor('files',50))
  nfsePreview(@UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
    return this.nfse.preview(files, req.companyId);
  }

  @Post('nfse-sp/import')
  @UseInterceptors(FilesInterceptor('files',50))
  nfseImport(@UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
    return this.nfse.importar(files, req.companyId, req.user.id);
  }

  // ── NF-e Produtos ─────────────────────────────────────────────
  @Post('nfe/preview')
  @UseInterceptors(FilesInterceptor('files',50))
  nfePreview(@UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
    return this.nfe.preview(files, req.companyId);
  }

  @Post('nfe/import')
  @UseInterceptors(FilesInterceptor('files',50))
  nfeImport(@UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
    return this.nfe.importar(files, req.companyId, req.user.id);
  }

  // ── Documentos Fiscais (hub) ──────────────────────────────────
  @Get('documentos')
  async listar(
    @Req() req: any,
    @Query('tipo')         tipo?:   string,
    @Query('competencia')  comp?:   string,
    @Query('status')       status?: string,
    @Query('search')       search?: string,
    @Query('page')         page?:   string,
    @Query('limit')        limit?:  string,
  ) {
    const take = parseInt(limit??'50');
    const skip = (parseInt(page??'1')-1)*take;
    const where: any = { companyId: req.companyId, deletedAt: null };
    if (tipo)   where.documentType   = { in: tipo.split(',') };
    if (comp)   where.competenceMonth = comp;
    if (status) where.integrationStatus = status;
    if (search) where.OR = [
      { issuerName:    { contains: search, mode:'insensitive' } },
      { documentNumber:{ contains: search, mode:'insensitive' } },
      { issuerCnpj:    { contains: search } },
    ];
    const [data, total] = await Promise.all([
      this.prisma.fiscalDocument.findMany({
        where, skip, take,
        orderBy: { issueDate: 'desc' },
      }),
      this.prisma.fiscalDocument.count({ where }),
    ]);
    return { data, total, page: parseInt(page??'1'), pages: Math.ceil(total/take) };
  }

  @Get('documentos/resumo')
  async resumo(@Req() req: any, @Query('competencia') comp?: string) {
    const where: any = { companyId: req.companyId, deletedAt: null };
    if (comp) where.competenceMonth = comp;
    const docs = await this.prisma.fiscalDocument.findMany({ where });
    const byType: Record<string, { count: number; total: number }> = {};
    let totalNfs = 0, totalIss = 0, totalPis = 0, totalCofins = 0;
    for (const d of docs) {
      const t = d.documentType;
      if (!byType[t]) byType[t] = { count:0, total:0 };
      byType[t].count++;
      byType[t].total += Number(d.netAmount);
      totalNfs    += Number(d.netAmount);
      totalIss    += Number(d.issAmount);
      totalPis    += Number(d.pisAmount);
      totalCofins += Number(d.cofinsAmount);
    }
    return { byType, totalNfs, totalIss, totalPis, totalCofins,
      pending: docs.filter(d=>d.integrationStatus==='PENDING').length,
      integrated: docs.filter(d=>d.integrationStatus==='INTEGRATED').length };
  }
}
