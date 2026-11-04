// ── documents.controller.ts ──────────────────────────────────────
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Request, Req,
  UseGuards, UseInterceptors, UploadedFile,
  Res, HttpCode, HttpStatus, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { DocumentsService } from './documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  CreateDocumentDto, UpdateDocumentDto,
  AddSignerDto, SignDocumentDto,
} from './create-documents.dto';
import { DocumentScopeInterceptor } from './document-scope.interceptor';
import { isMasterAdmin } from '../../multi-company/company.interceptor';

@UseGuards(JwtAuthGuard)
@UseInterceptors(DocumentScopeInterceptor)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) { }

  // Seguranca 0A (02/10/2026): empresa efetiva nas rotas sem :id.
  // Master: comportamento inalterado. Demais: sempre request.companyId; divergente = 404.
  private empresaEfetiva(req: any, informada?: string): string | undefined {
    if (isMasterAdmin(req.user)) return informada;
    if (informada && informada !== req.companyId) {
      throw new NotFoundException('Empresa nao encontrada.');
    }
    return req.companyId;
  }

  private bloquearTemplateNaoMaster(req: any, isTemplate: any): void {
    if (!isMasterAdmin(req.user) && (isTemplate === true || isTemplate === 'true')) {
      throw new ForbiddenException('Templates globais so podem ser criados pelo administrador.');
    }
  }

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
      companyId: this.empresaEfetiva(req, companyId),
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

  // POST /documents - cria documento digitado (sem arquivo)
  @Post()
  create(@Request() req, @Body() dto: CreateDocumentDto) {
    this.bloquearTemplateNaoMaster(req, dto.isTemplate);
    dto.companyId = this.empresaEfetiva(req, dto.companyId);
    return this.documentsService.create(dto, req.user.id);
  }

  // POST /documents/upload - cria documento via upload .docx
  // Extrai texto com mammoth.js, gera hash SHA-256, persiste
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
  ) {
    this.bloquearTemplateNaoMaster(req, dto.isTemplate);
    dto.companyId = this.empresaEfetiva(req, dto.companyId);
    return this.documentsService.createFromUpload(file, dto, req.user.id);
  }

  // PATCH /documents/:id - salva edição (cria nova DocumentVersion automaticamente)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(id, dto, req.user.id);
  }

  // DELETE /documents/:id - soft delete
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }

  // ── Versões ──────────────────────────────────────────────────

  // GET /documents/:id/versions - histórico completo de versões
  @Get(':id/versions')
  getVersions(@Param('id') id: string) {
    return this.documentsService.getVersions(id);
  }

  // POST /documents/:id/versions/:version/restore - restaurar versão anterior
  @Post(':id/versions/:version/restore')
  restoreVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Request() req,
  ) {
    return this.documentsService.restoreVersion(id, +version, req.user.id);
  }

  // ── Exportação ───────────────────────────────────────────────

  // GET /documents/:id/pdf - gera e baixa PDF
  @Get(':id/pdf')
  async generatePdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.documentsService.generatePdf(id);
    const fileName = await this.documentsService.buildDownloadFilename(id);
    const asciiFileName = fileName
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '_');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    res.send(pdfBuffer);
  }

  // GET /documents/:id/preview - retorna HTML para visualização inline
  @Get(':id/preview')
  async previewHtml(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.documentsService.generateHtml(id);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(html);
  }

  // GET /documents/:id/docx - versao editavel (.docx), espelhando o PDF (29/09/2026)
  @Get(':id/docx')
  async exportDocx(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.documentsService.exportDocx(id);
    const fileName = (await this.documentsService.buildDownloadFilename(id)).replace(/\.pdf$/i, '.docx');
    const asciiFileName = fileName
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '_');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
    res.send(buffer);
  }

  // POST /documents/:id/import-revision - importa versao revisada (.docx) como nova versao (so em RASCUNHO)
  @Post(':id/import-revision')
  @UseInterceptors(FileInterceptor('file', { storage: require('multer').memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  importRevision(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Arquivo .docx nao enviado.');
    return this.documentsService.importRevision(id, file, req.user?.id);
  }

  // ── Signatários ──────────────────────────────────────────────

  // POST /documents/:id/signers - adiciona signatário esperado
  @Post(':id/signers')
  addSigner(
    @Param('id') id: string,
    @Body() dto: AddSignerDto,
  ) {
    return this.documentsService.addSigner(id, dto);
  }

  // DELETE /documents/:id/signers/:signerId - remove signatário
  @Delete(':id/signers/:signerId')
  removeSigner(
    @Param('id') id: string,
    @Param('signerId') signerId: string,
  ) {
    return this.documentsService.removeSigner(id, signerId);
  }

  // ── Assinatura Digital ───────────────────────────────────────

  // POST /documents/:id/sign - aplica assinatura (gov.br ou cert digital)
  @Post(':id/sign')
  @HttpCode(HttpStatus.OK)
  sign(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: SignDocumentDto,
  ) {
    return this.documentsService.sign(id, dto, req.user);
  }

  // GET /documents/:id/sign/govbr/init - inicia OAuth gov.br (retorna URL redirect)
  @Get(':id/sign/govbr/init')
  initGovBrSign(
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.documentsService.initGovBrOAuth(id, req.user.id);
  }

  // POST /documents/:id/sign/govbr/callback - recebe code do OAuth gov.br
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

  // GET /documents/:id/signatures - lista assinaturas do documento
  @Get(':id/signatures')
  getSignatures(@Param('id') id: string) {
    return this.documentsService.getSignatures(id);
  }

  // POST /documents/:id/signers/:signerId/sign-physical - marca signatario como
  // assinado fisicamente (sem certificado/gov.br), com auditoria
  @Post(':id/signers/:signerId/sign-physical')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: require('multer').diskStorage({
        destination: './uploads/signatures',
        filename: (_req: any, file: any, cb: any) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = file.originalname.split('.').pop();
          cb(null, `evidencia-${unique}.${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async signPhysical(
    @Param('id') id: string,
    @Param('signerId') signerId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Arquivo de evidencia nao enviado.');
    const evidenceUrl = '/uploads/signatures/' + file.filename;
    return this.documentsService.signPhysical(id, signerId, evidenceUrl, req.user?.id);
  }

  // POST /documents/:id/reopen - reabre documento (EM_REVISAO ou
  // AGUARDANDO_ASSINATURA -> RASCUNHO), apaga assinaturas/signatarios existentes
  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@Param('id') id: string, @Request() req: any) {
    return this.documentsService.reopenDocument(id, req.user?.id);
  }

  // ── Status e Visibilidade ────────────────────────────────────

  // PATCH /documents/:id/status - altera status manualmente (ex: arquivar)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Request() req: any,
  ) {
    return this.documentsService.updateStatus(id, body.status, req.user?.id);
  }

  // PATCH /documents/:id/visibility - altera classificação de visibilidade
  @Patch(':id/visibility')
  updateVisibility(
    @Param('id') id: string,
    @Body() body: { visibility: string },
  ) {
    return this.documentsService.updateVisibility(id, body.visibility);
  }

  // POST /documents/import-signed - importa PDF assinado para o Arquivo
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
    body.companyId = this.empresaEfetiva(req, body.companyId) as string;
    return this.documentsService.importSignedPdf(file, body, req.user.id);
  }

  // ── Imoveis: matriculas e escrituras (04/11/2026) ─────────────
  // GET /documents/imoveis/vinculos?companyId=&tipo=MATRICULA|ESCRITURA
  @Get('imoveis/vinculos')
  listarDocsImoveis(@Req() req: any, @Query('companyId') companyId: string, @Query('tipo') tipo?: string) {
    return this.documentsService.listarDocsImoveis(this.empresaEfetiva(req, companyId) as string, tipo);
  }

  // POST /documents/imoveis/importar - PDF + vinculo com o imovel e situacao registral
  @Post('imoveis/importar')
  @UseInterceptors(FileInterceptor('file', { storage: require('multer').memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } }))
  importarDocImovel(@Req() req: any, @UploadedFile() file: Express.Multer.File, @Body() body: any) {
    if (!file) throw new BadRequestException('Arquivo PDF nao enviado.');
    body.companyId = this.empresaEfetiva(req, body.companyId) as string;
    return this.documentsService.importarDocImovel(file, body, req.user.id);
  }

  // PATCH /documents/imoveis/vinculos/:id - situacao registral e observacao
  @Patch('imoveis/vinculos/:id')
  atualizarDocImovel(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.documentsService.atualizarDocImovel(this.empresaEfetiva(req, body?.companyId) as string, id, body, req.user.id);
  }

  // ── Arquivo Digital reorganizado (04/11/2026) ─────────────────
  // GET /documents/arquivo/lista?companyId=&types=A,B&q=texto
  @Get('arquivo/lista')
  listarArquivo(@Req() req: any, @Query('companyId') companyId: string, @Query('types') types?: string, @Query('q') q?: string) {
    return this.documentsService.listarArquivo(this.empresaEfetiva(req, companyId) as string, types, q);
  }

  // GET /documents/imoveis/locacoes - contratos de locacao arquivados, com o imovel
  @Get('imoveis/locacoes')
  listarLocacoesImoveis(@Req() req: any, @Query('companyId') companyId: string) {
    return this.documentsService.listarLocacoesImoveis(this.empresaEfetiva(req, companyId) as string);
  }

  // PATCH /documents/:id/subtipo - classifica Balancete/ECD/ECF/Obrigacao etc.
  @Patch(':id/subtipo')
  definirSubtipo(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.documentsService.definirSubtipo(this.empresaEfetiva(req, body?.companyId) as string, id, body?.subtipo ?? null, req.user.id);
  }
}
