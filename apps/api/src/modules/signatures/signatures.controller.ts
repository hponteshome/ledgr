import * as crypto from 'crypto';
// apps/api/src/modules/signatures/signatures.controller.ts
import {
  Controller, Post, Get, Delete, Param, Body,
  UseInterceptors, Req, Query, Redirect, RawBodyRequest,
  ForbiddenException, NotFoundException, StreamableFile,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentsService } from '../../core/documents/documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';
import { SignatureService } from './signature.service';
import { CertificatesService } from './certificates.service';
import { GovBrService } from './govbr.service';
import { ClicksignService } from './clicksign.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SignatureValidatorService } from './signature-validator.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { EscopoEmpresaGuard, EscopoEmpresa } from '../../multi-company/escopo-empresa.guard';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { UseGuards } from '@nestjs/common';

@Controller('signatures')
export class SignaturesController {
  constructor(
    private signatureService: SignatureService,
    private certificatesService: CertificatesService,
    private govBrService: GovBrService,
    private clicksignService: ClicksignService,
    private validatorService: SignatureValidatorService,
    private prisma: PrismaService,
    private moduleRef: ModuleRef,
  ) {}

  // PDF que vai para a ClickSign (11/10/2026): o PDF importado do documento ou, se nao houver,
  // o mesmo PDF da exportacao (GET /documents/:id/pdf). Antes ia o TEXTO do documento, nao um PDF.
  private async pdfDoDocumento(doc: any): Promise<{ pdf: Buffer; nome: string }> {
    const base = ClicksignService.nomeSeguro(doc.title || doc.id);
    const rel = String(doc.fileUrl || '');
    if (/\.pdf$/i.test(rel) && rel.startsWith('/uploads/')) {
      const raiz = path.resolve(process.cwd(), 'uploads');
      const alvo = path.resolve(raiz, rel.slice('/uploads/'.length));
      if (alvo.startsWith(raiz + path.sep) && fs.existsSync(alvo)) {
        const buf = fs.readFileSync(alvo);
        if (ClicksignService.ehPdf(buf)) return { pdf: buf, nome: `${base}.pdf` };
      }
    }
    const docs = this.moduleRef.get(DocumentsService, { strict: false });
    const gerado = Buffer.from(await docs.generatePdf(doc.id));
    return { pdf: gerado, nome: `${base}.pdf` };
  }

  // ── Certificados ───────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('certificates')
  async listCertificates(@Req() req: any) {
    return this.certificatesService.findAll(req.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('certificates/:id')
  async revokeCertificate(@Req() req: any, @Param('id') id: string) {
    return this.certificatesService.revoke(req.companyId, id);
  }

  // ── Signatários ────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa DO REGISTRO
  @EscopoEmpresa('documento:documentId')
  @Get('documents/:documentId/signers')
  async getSigners(@Param('documentId') documentId: string) {
    return this.signatureService.getSigners(documentId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('documents/:documentId/signers')
  async addSigners(
    @Req() req: any,
    @Param('documentId') documentId: string,
    @Body() body: { signers: Array<{ name: string; cpf?: string; email?: string; role?: string; order: number }> },
  ) {
    return this.signatureService.addSigners(documentId, req.companyId, body.signers);
  }

  // ── ClickSign — criar solicitação ─────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('documents/:documentId/clicksign/request')
  async createClicksignRequest(
    @Req() req: any,
    @Param('documentId') documentId: string,
    @Body() body: {
      signers: Array<{
        id: string; name: string; email: string; cpf?: string;
        phone?: string; order: number;
        auth: 'email' | 'sms' | 'whatsapp' | 'pix' | 'icp';
      }>;
      deadline?: string;
    },
  ) {
    // Buscar PDF do documento
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, companyId: req.companyId },
    });
    if (!doc) throw new Error('Documento não encontrado');

    // Gerar PDF simples com conteúdo do documento
    const { pdf: pdfBuffer, nome: filename } = await this.pdfDoDocumento(doc);

    return this.clicksignService.createSignatureRequest({
      documentId,
      companyId: req.companyId,
      pdfBuffer,
      filename,
      signers: body.signers,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      userId: req.user?.id,
    });
  }

  // ── ClickSign — webhook ───────────────────────────────────────────────────
  @Post('clicksign/webhook')
  @SkipCompanyCheck()
  async clicksignWebhook(@Req() req: any, @Body() body: any) {
    // API 3.0: cabecalho Content-Hmac: sha256=<hex>. O cabecalho antigo segue aceito.
    const signature = String(req.headers['content-hmac'] || req.headers['x-clicksign-signature'] || '').replace(/^sha256=/i, '').trim().toLowerCase();
    const secret = process.env.CLICKSIGN_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[ClickSign Webhook] CLICKSIGN_WEBHOOK_SECRET nao configurado - rejeitando por seguranca');
      throw new ForbiddenException('Webhook nao configurado corretamente.');
    }
    if (!req.rawBody) throw new ForbiddenException('Webhook sem corpo bruto.');
    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    if (!signature || String(signature).length !== expected.length || !crypto.timingSafeEqual(Buffer.from(String(signature)), Buffer.from(expected))) {
      console.warn('[ClickSign Webhook] Assinatura invalida - requisicao rejeitada');
      throw new ForbiddenException('Assinatura invalida.');
    }
    await this.clicksignService.processWebhook(body);
    return { ok: true };
  }

  // ── ClickSign — baixar PDF assinado ──────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('documents/:documentId/clicksign/download')
  async downloadSignedPdf(
    @Req() req: any,
    @Param('documentId') documentId: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, companyId: req.companyId },
    });
    if (!doc) throw new NotFoundException('Documento nao encontrado');
    const { pdf, nome } = await this.clicksignService.baixarPdfAssinado(documentId);
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `attachment; filename="${nome}"` });
  }

  // ── ClickSign — status ────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('documents/:documentId/clicksign/status')
  async getClicksignStatus(
    @Req() req: any,
    @Param('documentId') documentId: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, companyId: req.companyId },
    });
    if (!doc?.digitalSignature) return { status: 'not_sent' };
    return this.clicksignService.sincronizar(documentId, req.user?.id);
  }

  // ── Gov.br ────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('documents/:documentId/sign/govbr/init')
  async initiateGovBr(
    @Req() req: any,
    @Param('documentId') documentId: string,
    @Body() body: { signerId: string },
  ) {
    const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown';
    const { url } = this.govBrService.generateAuthUrl(documentId, body.signerId, ipAddress);
    return { authUrl: url };
  }

  @Get('govbr/callback')
  @Redirect()
  @SkipCompanyCheck()
  async govBrCallback(
    @Req() req: any,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
  ) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    if (error) return { url: `${frontendUrl}/app/documents/signatures?error=${error}` };
    try {
      const ipAddress = req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown';
      const result = await this.govBrService.processCallback(code, state, ipAddress);
      return { url: `${frontendUrl}/app/documents/signatures?signed=true&docId=${result.documentId}` };
    } catch (e: any) {
      console.error('[GovBr callback error]', e.message);
      return { url: `${frontendUrl}/app/documents/signatures?error=callback_failed` };
    }
  }

  // ── Status geral ──────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa DO REGISTRO
  @EscopoEmpresa('documento:documentId')
  @Get('documents/:documentId/status')
  async getStatus(@Param('documentId') documentId: string) {
    return this.signatureService.getSignatureStatus(documentId);
  }
  // ── Validar PDF assinado ──────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('validate')
  @UseInterceptors(FileInterceptor('pdf'))
  async validateSignature(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentId') documentId: string,
  ) {
    if (!file) throw new Error('Arquivo PDF não enviado');
    return this.validatorService.validateSignedPdf(file.buffer, documentId || undefined);
  }
}
