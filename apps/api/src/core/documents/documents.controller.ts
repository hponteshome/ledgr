// ── documents.controller.ts ──────────────────────────────────────
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Request, Req,
  UseGuards, UseInterceptors, UploadedFile,
  Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { DocumentsService } from './documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  CreateDocumentDto, UpdateDocumentDto,
  AddSignerDto, SignDocumentDto,
} from './create-documents.dto';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) { }

  // ── Listagem e busca ─────────────────────────────────────────

  // GET /documents?companyId=xxx&type=ESTATUTO_SOCIAL&status=RASCUNHO&visibility=RESERVADO&isTemplate=false
  @Get()
  findAll(
    @Request() req,
    @Query('companyId') companyId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('visibility') visibility?: string,
    @Query('isTemplate') isTemplate?: string,
  ) {
    return this.documentsService.findAll({
      companyId,
      type,
      status,
      visibility,
      isTemplate: isTemplate === 'true' ? true : isTemplate === 'false' ? false : undefined,
    });
  }

  // GET /documents/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  // ── CRUD ─────────────────────────────────────────────────────

  // POST /documents — cria documento digitado (sem arquivo)
  @Post()
  create(@Request() req, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto, req.user.id);
  }

  // POST /documents/upload — cria documento via upload .docx
  // Extrai texto com mammoth.js, gera hash SHA-256, persiste
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentsService.createFromUpload(file, dto, req.user.id);
  }

  // PATCH /documents/:id — salva edição (cria nova DocumentVersion automaticamente)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(id, dto, req.user.id);
  }

  // DELETE /documents/:id — soft delete
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }

  // ── Versões ──────────────────────────────────────────────────

  // GET /documents/:id/versions — histórico completo de versões
  @Get(':id/versions')
  getVersions(@Param('id') id: string) {
    return this.documentsService.getVersions(id);
  }

  // POST /documents/:id/versions/:version/restore — restaurar versão anterior
  @Post(':id/versions/:version/restore')
  restoreVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Request() req,
  ) {
    return this.documentsService.restoreVersion(id, +version, req.user.id);
  }

  // ── Exportação ───────────────────────────────────────────────

  // GET /documents/:id/pdf — gera e baixa PDF
  @Get(':id/pdf')
  async generatePdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.documentsService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="documento-${id}.pdf"`,
    });
    res.send(pdfBuffer);
  }

  // GET /documents/:id/preview — retorna HTML para visualização inline
  @Get(':id/preview')
  async previewHtml(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.documentsService.generateHtml(id);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(html);
  }

  // GET /documents/:id/docx — exporta como .docx
  // TODO: implementar DocumentsService.exportDocx()
  // @Get(':id/docx')
  // async exportDocx(@Param('id') id: string, @Res() res: Response) {
  //   const buffer = await this.documentsService.exportDocx(id);
  //   res.set({
  //     'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  //     'Content-Disposition': `attachment; filename="documento-${id}.docx"`,
  //   });
  //   res.send(buffer);
  // }

  // ── Signatários ──────────────────────────────────────────────

  // POST /documents/:id/signers — adiciona signatário esperado
  @Post(':id/signers')
  addSigner(
    @Param('id') id: string,
    @Body() dto: AddSignerDto,
  ) {
    return this.documentsService.addSigner(id, dto);
  }

  // DELETE /documents/:id/signers/:signerId — remove signatário
  @Delete(':id/signers/:signerId')
  removeSigner(
    @Param('id') id: string,
    @Param('signerId') signerId: string,
  ) {
    return this.documentsService.removeSigner(id, signerId);
  }

  // ── Assinatura Digital ───────────────────────────────────────

  // POST /documents/:id/sign — aplica assinatura (gov.br ou cert digital)
  @Post(':id/sign')
  @HttpCode(HttpStatus.OK)
  sign(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: SignDocumentDto,
  ) {
    return this.documentsService.sign(id, dto, req.user);
  }

  // GET /documents/:id/sign/govbr/init — inicia OAuth gov.br (retorna URL redirect)
  @Get(':id/sign/govbr/init')
  initGovBrSign(
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.documentsService.initGovBrOAuth(id, req.user.id);
  }

  // POST /documents/:id/sign/govbr/callback — recebe code do OAuth gov.br
  // TODO: implementar DocumentsService.handleGovBrCallback()
  @Post(':id/sign/govbr/callback')
  @HttpCode(HttpStatus.OK)
  govBrCallback(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { code: string; state: string },
  ) {
    return this.documentsService.handleGovBrCallback(id, body.code, body.state, req.user);
  }

  // GET /documents/:id/signatures — lista assinaturas do documento
  @Get(':id/signatures')
  getSignatures(@Param('id') id: string) {
    return this.documentsService.getSignatures(id);
  }

  // ── Status e Visibilidade ────────────────────────────────────

  // PATCH /documents/:id/status — altera status manualmente (ex: arquivar)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.documentsService.updateStatus(id, body.status);
  }

  // PATCH /documents/:id/visibility — altera classificação de visibilidade
  @Patch(':id/visibility')
  updateVisibility(
    @Param('id') id: string,
    @Body() body: { visibility: string },
  ) {
    return this.documentsService.updateVisibility(id, body.visibility);
  }

  // POST /documents/import-signed — importa PDF assinado para o Arquivo
  @Post('import-signed')
  @UseInterceptors(FileInterceptor('file', { storage: require('multer').memoryStorage() }))
  async importSigned(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      companyId: string;
      type: string;
      title: string;
      date: string;
      description?: string;
      validate?: string;
    },
  ) {
    if (!file) throw new Error('Arquivo PDF não enviado');
    return this.documentsService.importSignedPdf(file, body, req.user.id);
  }
}
