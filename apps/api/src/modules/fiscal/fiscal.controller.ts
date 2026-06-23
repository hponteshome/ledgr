// apps/api/src/modules/fiscal/fiscal.controller.ts
import { Controller, BadRequestException, Post, Get, UseGuards, UseInterceptors,
  UploadedFile, UploadedFiles, Req, Body, Query, Param } from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { NfseImportService } from './services/nfse-import.service';
import { NfeImportService  } from './services/nfe-import.service';
import { NfseNacionalService } from './services/nfse-nacional.service';
import { NfseSpConsultaService } from './services/nfse-sp-consulta.service';
import { NfseSpCsvService } from './services/nfse-sp-csv.service';
import { NfseSpEmissaoService } from './services/nfse-sp-emissao.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('fiscal')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
export class FiscalController {
  constructor(
    private nfse:    NfseImportService,
    private nfe:     NfeImportService,
    private nfseNac: NfseNacionalService,
    private spConsulta: NfseSpConsultaService,
    private spEmissao: NfseSpEmissaoService,
    private spCsv: NfseSpCsvService,
    private prisma:  PrismaService,
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

  // ── NFS-e Nacional (Emissor RFB) ─────────────────────────────
  @Post('nfse-nacional/emitir')
  emitirNfseNacional(@Req() req: any, @Body() dto: any) {
    return this.nfseNac.emitir(req.companyId, dto, req.user.id);
  }

  @Get('nfse-nacional')
  listarNfseNacional(@Req() req: any, @Query('competencia') c?: string, @Query('status') s?: string) {
    return this.nfseNac.listar(req.companyId, c, s);
  }

  @Post('nfse-nacional/:id/reenviar')
  reenviarNfseNacional(@Req() req: any, @Param('id') id: string) {
    return this.nfseNac.reenviar(req.companyId, id);
  }

  @Post('nfse-nacional/:id/cancelar')
  cancelarNfseNacional(@Req() req: any, @Param('id') id: string, @Body('motivo') motivo: string) {
    return this.nfseNac.cancelar(req.companyId, id, motivo || 'Cancelada pelo emissor');
  }

  // ── Consulta NFS-e SP como Tomador (webservice prefeitura SP) ────────────
  @Post('nfse-sp/buscar-tomador')
  buscarTomadorSP(@Req() req: any, @Body() body: any) {
    const { certId, dtInicio, dtFim, paginas, homologacao } = body ?? {};
    if (!certId) throw new (require('@nestjs/common').BadRequestException)('certId obrigatorio');
    return this.spConsulta.consultarTomador({
      companyId:   req.companyId,
      certId,
      dtInicio,
      dtFim,
      paginas:     Number(paginas ?? 5),
      homologacao: homologacao === true || homologacao === 'true',
      importar:    true,
      userId:      req.user.id,
    });
  }

  @Post('nfse-sp/buscar-emitidas')
  buscarEmitidasSP(@Req() req: any, @Body() body: any) {
    const { certId, dtInicio, dtFim, paginas, homologacao } = body ?? {};
    if (!certId) throw new (require('@nestjs/common').BadRequestException)('certId obrigatorio');
    return this.spConsulta.consultarEmitidas({
      companyId:   req.companyId,
      certId,
      dtInicio,
      dtFim,
      paginas:     Number(paginas ?? 5),
      homologacao: homologacao === true || homologacao === 'true',
      importar:    true,
      userId:      req.user.id,
    });
  }

  @Post('nfse-sp/import-from-xml')
  importFromXml(@Req() req: any, @Body() body: any) {
    const xmlNotas: string[] = body?.xmlNotas ?? [];
    if (!xmlNotas.length) throw new (require('@nestjs/common').BadRequestException)('xmlNotas vazio');
    return this.nfse.importFromXmlStrings(xmlNotas, req.companyId, req.user.id);
  }

  // ── Emissao NFS-e SP (EnvioLoteRPS v1 e v2) ──────────────────────────────
  @Post('nfse-sp/emitir')
  emitirNfseSP(@Req() req: any, @Body() dto: any) {
    return this.spEmissao.emitir(req.companyId, dto, req.user.id);
  }

  // ── Cancelamento NFS-e SP ─────────────────────────────────────────────────
  @Post('nfse-sp/cancelar')
  cancelarNfseSP(@Req() req: any, @Body() body: any) {
    return this.spEmissao.cancelar(req.companyId, body);
  }

  // ── NFS-e SP CSV (exportação PMSP) ────────────────────────────────────────
  @Post('nfse-sp-csv/preview')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20*1024*1024 } }))
  nfseSpCsvPreview(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo CSV nao enviado.');
    return this.spCsv.preview(file.buffer, req.companyId);
  }

  @Post('nfse-sp-csv/import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20*1024*1024 } }))
  nfseSpCsvImport(@UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo CSV nao enviado.');
    return this.spCsv.importar(file.buffer, req.companyId, req.user.id, true, body?.fileName || file.originalname);
  }

  @Get('nfse-sp-csv/lotes')
  nfseSpCsvLotes(@Req() req: any) {
    return this.spCsv.listarLotes(req.companyId);
  }

  @Post('nfse-sp-csv/excluir-lote')
  nfseSpCsvExcluirLote(@Body() body: { batchId: string }, @Req() req: any) {
    return this.spCsv.excluirLote(req.companyId, body.batchId);
  }
}
