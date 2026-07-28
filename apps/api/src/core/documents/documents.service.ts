// src/core/documents/documents.service.ts
import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import * as mammoth from 'mammoth';
import * as puppeteer from 'puppeteer';
import {
  CreateDocumentDto, UpdateDocumentDto,
  AddSignerDto, SignDocumentDto,
} from './create-documents.dto';
import { DocumentType, DocumentStatus, DocumentVisibility } from '@prisma/client';

// ── Filtros aceitos pelo findAll ───────────────────────────────
export interface DocumentFilters {
  companyId?: string;
  type?: string;
  status?: string;
  visibility?: string;
  isTemplate?: boolean;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────────────

  private sha256(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }

  private validateUuid(value: string, field: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new BadRequestException(
        `${field} inválido: "${value}". Esperado UUID v4.`,
      );
    }
  }

  private async getDocumentOrFail(id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
      include: {
        signatures: true,
        signers: true,
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!doc) throw new NotFoundException(`Documento ${id} não encontrado`);
    return doc;
  }

  // ── CRUD ───────────────────────────────────────────────────

  /**
   * Lista documentos com suporte a filtros combinados.
   *
   * Cenários:
   *   - companyId → documentos da empresa ativa (RESERVADO/RESTRITO/CONTROLADO)
   *   - isTemplate=true → templates globais (sem empresa)
   *   - companyId + type → documentos de um tipo específico da empresa
   *   - visibility → filtra pelo nível de acesso
   */
  async findAll(filters: DocumentFilters) {
    const where: any = { deletedAt: null };

    // Empresa ativa
    if (filters.companyId) {
      this.validateUuid(filters.companyId, 'companyId');
      where.companyId = filters.companyId;
    }

    // Templates globais (companyId = null)
    if (filters.isTemplate !== undefined) {
      where.isTemplate = filters.isTemplate;
      if (filters.isTemplate) where.companyId = null;
    }

    // Tipo
    if (filters.type) {
      where.type = filters.type as DocumentType;
    }

    // Status
    if (filters.status) {
      where.status = filters.status as DocumentStatus;
    }

    // Visibilidade
    if (filters.visibility) {
      where.visibility = filters.visibility as DocumentVisibility;
    }

    return this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        visibility: true,
        isTemplate: true,
        currentVersion: true,
        contentHash: true,
        bookNumber: true,
        date: true,
        fileUrl: true,
        requiresJucesp: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        signatures: {
          select: {
            method: true, status: true, signerName: true, signedAt: true,
          },
        },
        signers: {
          select: { id: true, name: true, status: true },
        },
        // Última versão — para exibir changeNote na listagem
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { version: true, changeNote: true, createdAt: true },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.getDocumentOrFail(id);
  }

  async create(dto: CreateDocumentDto, userId: string) {
    // ── Guards ─────────────────────────────────────────────
    this.validateUuid(userId, 'userId');
    if (dto.companyId) this.validateUuid(dto.companyId, 'companyId');

    // Template global não pode ter empresa
    if (dto.isTemplate && dto.companyId) {
      throw new BadRequestException(
        'Templates globais não devem ter companyId. Remova companyId ou defina isTemplate: false.',
      );
    }

    // Documento reservado precisa de empresa
    if (!dto.isTemplate && !dto.companyId) {
      throw new BadRequestException(
        'Documentos não-template precisam de companyId.',
      );
    }

    const hash = dto.content ? this.sha256(dto.content) : null;

    const doc = await this.prisma.document.create({
      data: {
        companyId:      dto.companyId ?? null,
        type:           dto.type,
        title:          dto.title,
        description:    dto.description ?? '',
        content:        dto.content ?? '',
        contentHash:    hash,
        currentVersion: 1,
        status:         dto.status ?? DocumentStatus.RASCUNHO,
        visibility:     dto.visibility ?? DocumentVisibility.RESERVADO,
        isTemplate:     dto.isTemplate ?? false,
        requiresJucesp: dto.requiresJucesp ?? false,
        bookNumber:     dto.bookNumber,
        notes:          dto.notes,
        date:           dto.date ? new Date(dto.date) : new Date(),
        createdById:    userId,
      },
    });

    // Versão inicial automática
    if (dto.content) {
      await this.prisma.documentVersion.create({
        data: {
          documentId:  doc.id,
          version:     1,
          content:     dto.content,
          contentHash: hash,
          changeNote:  'Versão inicial',
          createdById: userId,
        },
      });
    }

    this.logger.log(
      `Documento criado: ${doc.id} | tipo: ${doc.type} | visibilidade: ${doc.visibility} | empresa: ${doc.companyId ?? 'global'}`,
    );

    return doc;
  }

  async createFromUpload(
    file: Express.Multer.File,
    dto: CreateDocumentDto,
    userId: string,
  ) {
    this.validateUuid(userId, 'userId');
    if (dto.companyId) this.validateUuid(dto.companyId, 'companyId');

    const result = await mammoth.extractRawText({ buffer: file.buffer });
    const content = result.value;
    const hash = this.sha256(content);

    const doc = await this.prisma.document.create({
      data: {
        companyId:        dto.companyId ?? null,
        type:             dto.type,
        title:            dto.title,
        description:      dto.description ?? '',
        content,
        contentHash:      hash,
        currentVersion:   1,
        fileUrl:          file.path,
        fileSize:         file.size,
        originalFileName: file.originalname,
        status:           dto.status ?? DocumentStatus.RASCUNHO,
        visibility:       dto.visibility ?? DocumentVisibility.RESERVADO,
        isTemplate:       dto.isTemplate ?? false,
        requiresJucesp:   dto.requiresJucesp ?? false,
        bookNumber:       dto.bookNumber,
        notes:            dto.notes,
        date:             dto.date ? new Date(dto.date) : new Date(),
        createdById:      userId,
      },
    });

    await this.prisma.documentVersion.create({
      data: {
        documentId:  doc.id,
        version:     1,
        content,
        contentHash: hash,
        changeNote:  `Upload de ${file.originalname}`,
        createdById: userId,
      },
    });

    return doc;
  }

  async update(id: string, dto: UpdateDocumentDto, userId: string) {
    this.validateUuid(userId, 'userId');
    const doc = await this.getDocumentOrFail(id);
    const newVersion = doc.currentVersion + 1;
    const hash = dto.content ? this.sha256(dto.content) : doc.contentHash;

    if (dto.content && dto.content !== doc.content) {
      await this.prisma.documentVersion.create({
        data: {
          documentId:  id,
          version:     newVersion,
          content:     dto.content,
          contentHash: hash,
          changeNote:  dto.changeNote ?? `Edição — v${newVersion}`,
          createdById: userId,
        },
      });
    }

    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined       && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined      && { status: dto.status }),
        ...(dto.visibility !== undefined  && { visibility: dto.visibility }),
        ...(dto.isTemplate !== undefined  && { isTemplate: dto.isTemplate }),
        ...(dto.notes !== undefined       && { notes: dto.notes }),
        ...(dto.bookNumber !== undefined  && { bookNumber: dto.bookNumber }),
        ...(dto.content && {
          content: dto.content,
          contentHash: hash,
          currentVersion: newVersion,
        }),
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async updateStatus(id: string, status: string, userId?: string) {
    const before = await this.prisma.document.findUnique({
      where: { id },
      select: { status: true },
    });
    const updated = await this.prisma.document.update({
      where: { id },
      data: { status: status as DocumentStatus, updatedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId ?? null,
        action: 'DOCUMENT_STATUS_CHANGED',
        targetId: id,
        before: { status: before?.status ?? null },
        after: { status: updated.status },
      },
    });
    return updated;
  }

  async updateVisibility(id: string, visibility: string) {
    return this.prisma.document.update({
      where: { id },
      data: { visibility: visibility as DocumentVisibility, updatedAt: new Date() },
    });
  }

  // ── Versões ────────────────────────────────────────────────

  async getVersions(id: string) {
    return this.prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { version: 'desc' },
      include: {
        createdBy: { select: { fullName: true, email: true } },
      },
    });
  }

  async restoreVersion(id: string, version: number, userId: string) {
    const targetVersion = await this.prisma.documentVersion.findUnique({
      where: { documentId_version: { documentId: id, version } },
    });
    if (!targetVersion) {
      throw new NotFoundException(`Versão ${version} não encontrada`);
    }
    return this.update(
      id,
      { content: targetVersion.content, changeNote: `Restaurado da v${version}` },
      userId,
    );
  }

  // ── Exportação ─────────────────────────────────────────────

  private toTitleCase(value: string | null | undefined): string {
    if (!value) return '';
    return value.toLowerCase().replace(/(^|\s)([a-zà-ú])/g, (_m, sep, c) => sep + c.toUpperCase());
  }

  private async buildLetterheadInfo(doc: any): Promise<{ logoImg: string; enderecoLine1: string; enderecoLine2: string; cnpjFmt: string; legalName: string } | null> {
    if (doc.type !== 'CONTRATO_LOCACAO' || !doc.companyId) return null;
    const company = await this.prisma.company.findUnique({ where: { id: doc.companyId } });
    if (!company) return null;
    let logoImg = '';
    if (company.logoUrl) {
      try {
        const fs = require('fs');
        const path = require('path');
        const relPath = company.logoUrl.replace(/^\/+/, '');
        const fullPath = path.join(process.cwd(), relPath);
        const buf = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).slice(1).toLowerCase();
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        const base64 = buf.toString('base64');
        logoImg = `<img src="data:${mime};base64,${base64}" style="height:36px;max-width:160px;object-fit:contain;" />`;
      } catch {
        logoImg = '';
      }
    }
    const cepDigits = (company.zipCode ?? '').replace(/\D/g, '');
    const cepFmt = cepDigits.length === 8 ? `${cepDigits.slice(0,5)}-${cepDigits.slice(5)}` : company.zipCode;
    const enderecoLine1 = [
      [this.toTitleCase(company.street), company.number].filter(Boolean).join(', '),
      this.toTitleCase(company.neighborhood),
    ].filter(Boolean).join(' — ');
    const enderecoLine2 = [
      [this.toTitleCase(company.city), company.state].filter(Boolean).join(' - '),
      cepFmt ?? '',
    ].filter(Boolean).join(', ');
    const cnpjDigits = (company.taxId ?? '').replace(/\D/g, '');
    const cnpjFmt = cnpjDigits.length === 14
      ? `${cnpjDigits.slice(0,2)}.${cnpjDigits.slice(2,5)}.${cnpjDigits.slice(5,8)}/${cnpjDigits.slice(8,12)}-${cnpjDigits.slice(12)}`
      : company.taxId;
    return { logoImg, enderecoLine1, enderecoLine2, cnpjFmt: cnpjFmt ?? '', legalName: company.legalName ?? '' };
  }

  async generatePdf(id: string): Promise<Buffer> {
    const doc = await this.getDocumentOrFail(id);
    const letterhead = await this.buildLetterheadInfo(doc);

    let headerTemplate: string | undefined;
    let footerTemplate: string | undefined;
    let letterheadMargin: { top: string; bottom: string; left: string; right: string } | undefined;

    if (letterhead) {
      const pdfFileName = await this.buildDownloadFilename(id);
      headerTemplate = `
        <div style="font-size:9px; width:100%; margin:0; box-sizing:border-box; padding:10mm 20mm 10mm 30mm; display:flex; align-items:center; justify-content:space-between; font-family:Arial,sans-serif; color:#333; border-bottom:1px solid #ddd;">
          <div>${letterhead.logoImg}</div>
          <div style="text-align:right; line-height:1.4;">
            <div style="font-weight:bold; font-size:1em;">${letterhead.legalName}</div>
            <div style="font-size:0.8em;">${letterhead.enderecoLine1}<br>${letterhead.enderecoLine2}</div>
            <div style="font-size:0.8em;">CNPJ: ${letterhead.cnpjFmt}</div>
          </div>
        </div>
      `;
      footerTemplate = `
        <div style="font-size:8px; width:100%; margin:0; box-sizing:border-box; padding:4px 20mm 0 30mm; display:flex; justify-content:space-between; font-family:Arial,sans-serif; color:#888; border-top:1px solid #ddd;">
          <span>${pdfFileName}</span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>
      `;
      letterheadMargin = { top: '35mm', bottom: '22mm', left: '30mm', right: '20mm' };
    }

    const visibilityWatermark: Record<string, string> = {
      PUBLICO:     '',
      RESERVADO:   'RESERVADO',
      RESTRITO:    'RESTRITO',
      CONTROLADO:  'CONTROLADO — CONFIDENCIAL',
    };

    const watermarkText = doc.status === 'RASCUNHO'
      ? 'RASCUNHO'
      : (visibilityWatermark[doc.visibility] ?? '');

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 25mm 20mm 25mm 30mm; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8; color: #000; }
          h1 { text-align: center; font-size: 14pt; text-transform: uppercase; letter-spacing: 2px; }
          h2 { text-align: center; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 24pt; }
          p { text-align: justify; margin: 6pt 0; }
          .signature-block { margin-top: 48pt; border-top: 1px solid #000; padding-top: 16pt; }
          .watermark {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%,-50%) rotate(-35deg);
            font-size: 72pt; color: rgba(0,0,0,0.04);
            font-weight: bold; z-index: -1; white-space: nowrap;
          }
          .classification-bar {
            position: fixed; bottom: 0; left: 0; right: 0;
            background: #1A3A5C; color: white;
            font-size: 8pt; text-align: center; padding: 3pt;
            letter-spacing: 2px;
          }
          .vertical-tarja {
            position: fixed; left: 2cm; top: 50%;
            transform: translateY(-50%) rotate(-90deg);
            transform-origin: center;
            font-size: 8pt; font-weight: bold; letter-spacing: 3px; color: #666; white-space: nowrap;
          }
        </style>
      </head>
      <body>
        ${watermarkText ? `<div class="watermark">${watermarkText}</div>` : ''}
        ${(doc.visibility !== 'PUBLICO' && doc.type === 'CONTRATO_LOCACAO') ? `<div class="vertical-tarja">CLASSIFICAÇÃO: ${doc.visibility}</div>` : ''}
        ${doc.content.split('\n\n').map((p: string) => `<p>${p.trim()}</p>`).join('\n')}
        ${doc.signatures?.length > 0 ? `
          <div class="signature-block">
            <p><strong>ASSINATURAS DIGITAIS</strong></p>
            ${(doc.signatures as any[]).map(s => `
              <p>✓ ${s.signerName} — ${s.method === 'GOVBR' ? 'gov.br' : 'Certificado ICP-Brasil'} — ${new Date(s.signedAt).toLocaleDateString('pt-BR')}</p>
            `).join('')}
          </div>
        ` : ''}
        ${(doc.visibility !== 'PUBLICO' && doc.type !== 'CONTRATO_LOCACAO')
          ? `<div class="classification-bar">LEDGR — CLASSIFICAÇÃO: ${doc.visibility}</div>`
          : ''}
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: !!headerTemplate,
      headerTemplate: headerTemplate ?? '<span></span>',
      footerTemplate: footerTemplate ?? '<span></span>',
      margin: letterheadMargin,
    });
    const pdfBuffer = Buffer.from(pdfBytes);
    await browser.close();

    return pdfBuffer;
  }

  async buildDownloadFilename(id: string): Promise<string> {
    const doc = await this.getDocumentOrFail(id);
    if (doc.type === 'CONTRATO_LOCACAO') {
      const contract = await this.prisma.rentalContract.findFirst({
        where: { documentId: id, deletedAt: null },
        include: { fixedAsset: { select: { internalCode: true } } },
      });
      if (contract && contract.fixedAsset?.internalCode) {
        const ddmmyy = (d: Date) => {
          const dd = String(d.getUTCDate()).padStart(2, '0');
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
          const yy = String(d.getUTCFullYear()).slice(-2);
          return `${dd}${mm}${yy}`;
        };
        const inicio = ddmmyy(contract.startDate);
        const fim = contract.endDate ? ddmmyy(contract.endDate) : 'indeterminado';
        return `Locação_${contract.fixedAsset.internalCode}_${inicio}a${fim}.pdf`;
      }
    }
    return `documento-${id}.pdf`;
  }

  async generateHtml(id: string): Promise<string> {
    const doc = await this.getDocumentOrFail(id);
    const letterhead = await this.buildLetterheadInfo(doc);
    const visibilityLabel: Record<string, string> = {
      PUBLICO: '', RESERVADO: 'RESERVADO',
      RESTRITO: 'RESTRITO', CONTROLADO: 'CONTROLADO — CONFIDENCIAL',
    };
    const watermark = doc.status === 'RASCUNHO' ? 'RASCUNHO' : (visibilityLabel[doc.visibility] ?? '');
    const signaturesHtml = (doc.signatures as any[])?.length > 0 ? `
      <div style="margin-top:48pt;border-top:1px solid #000;padding-top:16pt;">
        <p><strong>ASSINATURAS DIGITAIS</strong></p>
        ${(doc.signatures as any[]).map(s => `
          <p>✓ ${s.signerName} — ${s.method === 'GOVBR' ? 'gov.br' : 'Certificado ICP-Brasil'} — ${new Date(s.signedAt).toLocaleDateString('pt-BR')}</p>
        `).join('')}
      </div>` : '';

    if (letterhead) {
      const pdfFileName = await this.buildDownloadFilename(id);
      const headerHtmlEsc = JSON.stringify(`
        <div class="letterhead-header">
          <div>${letterhead.logoImg}</div>
          <div style="text-align:right; line-height:1.4;">
            <div style="font-weight:bold; font-size:1em;">${letterhead.legalName}</div>
            <div style="font-size:0.8em;">${letterhead.enderecoLine1}<br>${letterhead.enderecoLine2}</div>
            <div style="font-size:0.8em;">CNPJ: ${letterhead.cnpjFmt}</div>
          </div>
        </div>
      `);
      const footerHtmlEsc = JSON.stringify(`
        <div class="letterhead-footer">
          <span>${pdfFileName}</span>
          <span>Página <span class="page-number"></span></span>
        </div>
      `);
      const watermarkEsc = JSON.stringify(watermark ?? '');
      const bodyFragment = (doc.content ?? '<p><em>Sem conteúdo</em></p>') + signaturesHtml;

      return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    html, body { margin:0; padding:0; background:#787878; font-family:'Times New Roman', serif; font-size:12pt; line-height:1.8; color:#000; }
    .pages-wrap { padding:20px 0; }
    .page { position:relative; width:210mm; min-height:297mm; background:#fff; margin:0 auto 16px auto; box-shadow:0 2px 10px rgba(0,0,0,0.35); overflow:hidden; }
    .page-header { position:absolute; top:0; left:0; right:0; padding:14mm 20mm 0 30mm; }
    .page-footer { position:absolute; bottom:0; left:0; right:0; padding:0 20mm 8mm 30mm; }
    .page-content { position:absolute; top:38mm; bottom:22mm; left:30mm; right:20mm; overflow:hidden; }
    .page-watermark { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); font-size:72pt; color:rgba(0,0,0,0.04); font-weight:bold; white-space:nowrap; pointer-events:none; }
    .page-tarja { position:absolute; left:5mm; top:50%; transform:translateY(-50%) rotate(-90deg); transform-origin:center; font-size:8pt; font-weight:bold; letter-spacing:3px; color:#999; white-space:nowrap; }
    .letterhead-header { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #ddd; padding-bottom:10px; font-family: Arial, sans-serif; font-size: 9pt; color:#333; }
    .letterhead-footer { display:flex; justify-content:space-between; border-top:1px solid #ddd; padding-top:6px; font-family: Arial, sans-serif; font-size: 8pt; color:#888; }
    p { text-align: justify; margin: 6pt 0; }
    h1 { text-align: center; font-size: 14pt; text-transform: uppercase; letter-spacing: 2px; }
    h2 { text-align: center; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 24pt; }
  </style>
</head>
<body>
  <div id="source" style="display:none">${bodyFragment}</div>
  <div class="pages-wrap" id="pages"></div>
  <script>
    (function () {
      var headerHtml = ${headerHtmlEsc};
      var footerHtml = ${footerHtmlEsc};
      var watermarkText = ${watermarkEsc};
      var source = document.getElementById('source');
      var pagesContainer = document.getElementById('pages');
      var nodes = Array.prototype.slice.call(source.childNodes);
      var pages = [];
      var currentContent = null;

      function newPage() {
        var page = document.createElement('div');
        page.className = 'page';
        var wm = watermarkText ? '<div class="page-watermark">' + watermarkText + '</div>' : '';
        var tarja = '<div class="page-tarja">CLASSIFICAÇÃO: ' + watermarkText + '</div>';
        page.innerHTML =
          wm +
          '<div class="page-header">' + headerHtml + '</div>' +
          '<div class="page-content"></div>' +
          '<div class="page-footer">' + footerHtml + '</div>';
        pagesContainer.appendChild(page);
        pages.push(page);
        currentContent = page.querySelector('.page-content');
        return page;
      }

      newPage();
      nodes.forEach(function (node) {
        currentContent.appendChild(node);
        if (currentContent.scrollHeight > currentContent.clientHeight + 1) {
          currentContent.removeChild(node);
          newPage();
          currentContent.appendChild(node);
        }
      });

      pages.forEach(function (page, i) {
        var pn = page.querySelector('.page-number');
        if (pn) pn.textContent = (i + 1) + ' de ' + pages.length;
      });
    })();
  </script>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8; color: #000; max-width: 210mm; margin: 0 auto; padding: 25mm 30mm; }
    h1 { text-align: center; font-size: 14pt; text-transform: uppercase; letter-spacing: 2px; }
    p { text-align: justify; margin: 6pt 0; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 72pt; color: rgba(0,0,0,0.04); font-weight: bold; z-index: -1; white-space: nowrap; pointer-events: none; }
    .header { border-bottom: 2px solid #1A3A5C; padding-bottom: 12pt; margin-bottom: 24pt; }
    .header h1 { color: #1A3A5C; margin: 0; }
    .meta { font-size: 9pt; color: #666; margin-top: 4pt; }
    .classification-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1A3A5C; color: white; font-size: 8pt; text-align: center; padding: 3pt; letter-spacing: 2px; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark">${watermark}</div>` : ''}
  <div class="header">
    <h1>${doc.title}</h1>
    <div class="meta">
      Tipo: ${doc.type} &nbsp;|&nbsp; Data: ${new Date(doc.date).toLocaleDateString('pt-BR')} &nbsp;|&nbsp; Status: ${doc.status}
    </div>
  </div>
  ${doc.content ? doc.content.split('\n\n').map((p: string) => `<p>${p.trim()}</p>`).join('\n') : '<p><em>Sem conteúdo</em></p>'}
  ${signaturesHtml}
  ${doc.visibility !== 'PUBLICO' ? `<div class="classification-bar">LEDGR — CLASSIFICAÇÃO: ${doc.visibility}</div>` : ''}
</body>
</html>`;
  }

  // ── Signatários ────────────────────────────────────────────

  async addSigner(documentId: string, dto: AddSignerDto) {
    return this.prisma.documentSigner.create({
      data: {
        documentId,
        name:   dto.name,
        cpf:    dto.cpf,
        email:  dto.email,
        role:   dto.role,
        order:  dto.order ?? 0,
        userId: dto.userId,
      },
    });
  }

  async removeSigner(documentId: string, signerId: string) {
    return this.prisma.documentSigner.delete({ where: { id: signerId } });
  }

  // ── Assinatura Digital ─────────────────────────────────────

  async initGovBrOAuth(documentId: string, userId: string): Promise<{ url: string }> {
    const doc = await this.getDocumentOrFail(documentId);
    const state = Buffer.from(JSON.stringify({ documentId, userId })).toString('base64');
    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             process.env.GOVBR_CLIENT_ID!,
      redirect_uri:          process.env.GOVBR_REDIRECT_URI!,
      scope:                 'openid email profile',
      state,
      code_challenge:        doc.contentHash!,
      code_challenge_method: 'S256',
    });
    return { url: `https://sso.acesso.gov.br/authorize?${params.toString()}` };
  }

  async sign(documentId: string, dto: SignDocumentDto, user: any) {
    if (dto.method === 'GOVBR') {
      throw new BadRequestException(
        'Para assinatura gov.br use GET /documents/:id/sign/govbr/init',
      );
    }
if (!(dto as any).certId && !dto.signatureHash) {
  throw new BadRequestException('É necessário fornecer certId ou signatureHash');
    }
    const doc = await this.getDocumentOrFail(documentId);
    return this.persistSignature(documentId, {
      method:          dto.method,
      signerName:      user.fullName,
      signerCpf:       dto.certificateData?.cpf ?? user.document,
      signerEmail:     user.email,
      signerId:        dto.signerId,
      signatureHash:   dto.signatureHash,
      documentHash:    doc.contentHash,
      certificateData: dto.certificateData,
      signatureFormat: 'CAdES-BES',
      ipAddress:       user.ip,
    });
  }

  async getSignatures(documentId: string) {
    return this.prisma.documentSignature.findMany({
      where: { documentId },
      orderBy: { signedAt: 'asc' },
    });
  }

  private async persistSignature(documentId: string, data: {
    method: string;
    signerName: string;
    signerCpf?: string;
    signerEmail?: string;
    signerRole?: string;
    signerId?: string;
    signatureHash: string;
    documentHash?: string | null;
    certificateData?: any;
    govbrTransactionId?: string;
    govbrAccountLevel?: string;
    signatureFormat?: string;
    ipAddress?: string;
  }) {
    const signature = await this.prisma.documentSignature.create({
      data: {
        documentId,
        method:             data.method as any,
        status:             'ASSINADO',
        signerName:         data.signerName,
        signerCpf:          data.signerCpf,
        signerEmail:        data.signerEmail,
        signerRole:         data.signerRole,
        signerId:           data.signerId,
        signatureHash:      data.signatureHash,
        documentHash:       data.documentHash,
        certificateData:    data.certificateData,
        govbrTransactionId: data.govbrTransactionId,
        govbrAccountLevel:  data.govbrAccountLevel,
        signatureFormat:    data.signatureFormat ?? 'CAdES-BES',
        ipAddress:          data.ipAddress,
        signedAt:           new Date(),
      },
    });

    await this.checkAndUpdateDocumentStatus(documentId);
    return signature;
  }

  private async checkAndUpdateDocumentStatus(documentId: string) {
    const [signers, signatures] = await Promise.all([
      this.prisma.documentSigner.findMany({ where: { documentId } }),
      this.prisma.documentSignature.findMany({ where: { documentId, status: 'ASSINADO' as any } }),
    ]);
    const allSigned = signers.length === 0 || signers.length <= signatures.length;
    if (allSigned) {
      await this.prisma.document.update({
        where: { id: documentId },
        data:  { status: 'ASSINADO', updatedAt: new Date() },
      });
    }
  }
// TODO: integração OAuth Gov.br — Lei 14.063/2020
// Recebe o code retornado pelo redirect, troca pelo token, aplica assinatura
async handleGovBrCallback(
  documentId: string,
  code: string,
  state: string,
  user: any,
): Promise<any> {
  throw new Error('handleGovBrCallback: não implementado — aguardando integração Gov.br');
}


  async importSignedPdf(
    file: Express.Multer.File,
    dto: { companyId: string; type: string; title: string; date: string; description?: string; validate?: string },
    userId: string,
  ) {
    const crypto = require('crypto');
    const fs = require('fs');
    const path = require('path');
    const pdfBuffer = file.buffer;
    const contentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const fileName = contentHash.slice(0,16) + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);
    const fileUrl = '/uploads/' + fileName;
    const pdfStr = pdfBuffer.toString('binary');
    const hasSignature = /\/ByteRange|\/Contents\s*<[0-9A-Fa-f]{100,}>/i.test(pdfStr);
    const status = dto.validate === 'true' && hasSignature ? 'ASSINADO' : 'ARQUIVADO';

    const doc = await this.prisma.document.create({
      data: {
        companyId:        dto.companyId,
        type:             dto.type as any,
        title:            dto.title,
        description:      dto.description ?? '',
        content:          '[PDF importado]',
        contentHash,
        currentVersion:   1,
        fileSize:         file.size,
        fileUrl,
        originalFileName: file.originalname,
        status:           status as any,
        visibility:       'RESERVADO' as any,
        date:             dto.date ? new Date(dto.date) : new Date(),
        createdById:      userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'DOCUMENT_IMPORTED',
        targetId: doc.id,
        after: { title: dto.title, type: dto.type, hash: contentHash, hasSignature, status },
      },
    });

    return { id: doc.id, title: doc.title, status, contentHash, hasSignature };
  }
}
