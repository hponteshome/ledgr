import { NotImplementedException } from '@nestjs/common'; // Seguranca 0A (04/10/2026): erros de negocio com o codigo HTTP certo
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
import { situacaoReajuste } from '../../modules/locacao/utils/reajuste.util'; // REAJ-01

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

    // Status (aceita 1 valor ou varios separados por virgula, ex: "ASSINADO,REGISTRADO")
    if (filters.status) {
      const statuses = filters.status.split(',').map(s => s.trim()) as DocumentStatus[];
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
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
        // Última versão - para exibir changeNote na listagem
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
    // Integridade (29/09/2026): conteudo so e editavel em RASCUNHO. Fora dele,
    // o caminho e Reabrir (POST /documents/:id/reopen).
    if (dto.content !== undefined && dto.content !== doc.content && doc.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `Documento com status ${doc.status} nao pode ter o conteudo editado. Use Reabrir para voltar a Rascunho.`,
      );
    }
    const newVersion = doc.currentVersion + 1;
    const hash = dto.content ? this.sha256(dto.content) : doc.contentHash;

    if (dto.content && dto.content !== doc.content) {
      await this.prisma.documentVersion.create({
        data: {
          documentId:  id,
          version:     newVersion,
          content:     dto.content,
          contentHash: hash,
          changeNote:  dto.changeNote ?? `Edição - v${newVersion}`,
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

  private readonly ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
    RASCUNHO: ['EM_REVISAO', 'ARQUIVADO', 'CANCELADO'],
    EM_REVISAO: ['AGUARDANDO_ASSINATURA', 'ARQUIVADO', 'CANCELADO'],
    AGUARDANDO_ASSINATURA: ['ASSINADO', 'ARQUIVADO', 'CANCELADO'],
    ASSINADO: ['REGISTRADO', 'ARQUIVADO'],
    REGISTRADO: ['ARQUIVADO'],
    ARQUIVADO: [],
    CANCELADO: [],
  };

  async updateStatus(id: string, status: string, userId?: string) {
    const before = await this.prisma.document.findUnique({
      where: { id },
      select: { status: true },
    });
    if (before) {
      const allowed = this.ALLOWED_STATUS_TRANSITIONS[before.status] ?? [];
      if (!allowed.includes(status)) {
        throw new BadRequestException(
          `Transicao invalida: ${before.status} -> ${status}. Para retroceder, use o endpoint de reabertura (POST /documents/:id/reopen), que remove assinaturas/signatarios de forma consistente.`,
        );
      }
    }
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
    ].filter(Boolean).join(' - ');
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

  private signatureMethodLabel(method: string): string {
    if (method === 'GOVBR') return 'gov.br';
    if (method === 'FISICO') return 'Assinatura Física (evidência anexada)';
    return 'Certificado ICP-Brasil';
  }

  // Corpo do PDF (29/09/2026): conteudo HTML (templates) entra como esta - antes
  // era quebrado em <p> por linha em branco, o que aninhava <h2>/<p> dentro de <p>
  // e anulava as regras de quebra. Texto puro continua virando paragrafos. Cada
  // titulo (h1-h3) e agrupado com o paragrafo seguinte num .keep-with-next
  // (break-inside: avoid) para nunca ficar isolado no pe da pagina.
  private buildPdfBody(content: string | null | undefined): string {
    const c = content ?? '';
    if (!/^\s*</.test(c)) {
      return c.split('\n\n').map((p: string) => `<p>${p.trim()}</p>`).join('\n');
    }
    return c.replace(
      /(<h([1-3])\b[^>]*>[\s\S]*?<\/h\2>)(\s*)(<p\b[^>]*>[\s\S]*?<\/p>)/gi,
      '<div class="keep-with-next">$1$3$4</div>',
    );
  }

  async generatePdf(id: string): Promise<Buffer> {
    const doc = await this.getDocumentOrFail(id);
    return this.renderPdf(doc, await this.buildDownloadFilename(id));
  }

  // Renderizacao do PDF a partir de um documento real ou virtual (pre-visualizacao de template, 30/09/2026).
  async renderPdf(doc: any, pdfFileName: string): Promise<Buffer> {
    const letterhead = await this.buildLetterheadInfo(doc);

    let headerTemplate: string | undefined;
    let footerTemplate: string | undefined;
    let letterheadMargin: { top: string; bottom: string; left: string; right: string } | undefined;

    if (letterhead) {
      headerTemplate = `
        <div style="font-size:9px; width:100%; margin:0; box-sizing:border-box; padding:6mm 20mm 1.5mm 30mm; display:flex; align-items:center; justify-content:space-between; font-family:Arial,sans-serif; color:#333; border-bottom:1px solid #ddd;">
          <div>${letterhead.logoImg}</div>
          <div style="text-align:right; line-height:1;">
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
      // Margens laterais 0: o recuo lateral vira padding do body (body.com-timbrado),
      // que se repete em todas as paginas, liberando a faixa da tarja a 15 mm da borda.
      // Topo 28 mm: o timbrado ocupa ~25 mm; o corpo comeca abaixo dele em todas as paginas
      // (como o Word faz quando o cabecalho e mais alto que a margem).
      letterheadMargin = { top: '28mm', bottom: '20mm', left: '0mm', right: '0mm' };
    }

    const visibilityWatermark: Record<string, string> = {
      PUBLICO:     '',
      RESERVADO:   'RESERVADO',
      RESTRITO:    'RESTRITO',
      CONTROLADO:  'CONTROLADO - CONFIDENCIAL',
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
          /* Com timbrado: margens laterais 0 (recuo lateral via body.com-timbrado) e
             superior/inferior iguais as do Puppeteer - o @page do CSS prevalece no Chrome. */
          @page { size: A4; margin: ${letterhead ? '28mm 0 20mm 0' : '25mm 20mm 25mm 30mm'}; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8; color: #000; }
          h1 { text-align: center; font-size: 14pt; text-transform: uppercase; letter-spacing: 2px; }
          h2 { text-align: center; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 24pt; }
          p { text-align: justify; margin: 6pt 0; orphans: 3; widows: 3; }
          .keep-with-next { break-inside: avoid; page-break-inside: avoid; }
          h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
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
            position: fixed; left: 15mm; top: 50%;
            transform-origin: left top;
            transform: rotate(-90deg) translateX(-50%);
            font-size: 8pt; line-height: 1; font-weight: bold; letter-spacing: 3px; color: #666; white-space: nowrap;
          }
          /* margem do body do template (40px 50px) neutralizada: texto exatamente a 3 cm / 2 cm */
          body.com-timbrado { margin: 0 !important; padding: 0 20mm 0 30mm; }
          body.com-timbrado table { width: 100%; border-collapse: collapse; }
          body.com-timbrado td { vertical-align: top; padding: 16mm 0 0 0; border: none; }
          body.com-timbrado td:nth-child(2) { text-align: right; }
          body.com-timbrado td[colspan] { text-align: center; }
          body.com-timbrado td p { margin: 0; line-height: 1.25; text-align: inherit; }
          body.com-timbrado tr { break-inside: avoid; page-break-inside: avoid; }
        </style>
      </head>
      <body class="${letterhead ? 'com-timbrado' : ''}">
        ${watermarkText ? `<div class="watermark">${watermarkText}</div>` : ''}
        ${(doc.visibility !== 'PUBLICO' && doc.type === 'CONTRATO_LOCACAO') ? `<div class="vertical-tarja">CLASSIFICAÇÃO: ${doc.visibility}</div>` : ''}
        ${this.buildPdfBody(doc.content)}
        ${doc.signatures?.length > 0 ? `
          <div class="signature-block">
            <p><strong>ASSINATURAS DIGITAIS</strong></p>
            ${(doc.signatures as any[]).map(s => `
              <p>✓ ${s.signerName} - ${this.signatureMethodLabel(s.method)} - ${new Date(s.signedAt).toLocaleDateString('pt-BR')}</p>
            `).join('')}
          </div>
        ` : ''}
        ${(doc.visibility !== 'PUBLICO' && doc.type !== 'CONTRATO_LOCACAO')
          ? `<div class="classification-bar">LEDGR - CLASSIFICAÇÃO: ${doc.visibility}</div>`
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

  // Corpo do Word (29/09/2026): remove <style>, converte blocos <div> em paragrafos
  // (linhas de assinatura viram tracos de texto), <em> -> <i> (a html-to-docx so
  // reconhece <i>) e limpa quebras soltas entre blocos.
  private buildDocxBody(content: string | null | undefined): string {
    const c = content ?? '';
    let h = /^\s*</.test(c)
      ? c.replace(/<style[\s\S]*?<\/style>/gi, '')
      : c.split('\n\n').map((p: string) => `<p>${p.trim()}</p>`).join('');
    h = h
      .replace(/<div class="linha-assinatura">([\s\S]*?)<\/div>/gi, '<p style="text-align:center">______________________________________<br>$1</p>')
      .replace(/<div class="testemunha">([\s\S]*?)<\/div>/gi, '<p>$1</p>')
      .replace(/<\/?div\b[^>]*>/gi, '')
      .replace(/<(\/?)em\b[^>]*>/gi, '<$1i>')
      .replace(/>\s*\n\s*</g, '><')
      .replace(/(<\/(?:p|h[1-6])>)(?:<br\s*\/?>)+/gi, '$1')
      .replace(/(?:<br\s*\/?>)+(<(?:p|h[1-6])\b)/gi, '$1');
    // Tabelas de assinatura (29/09/2026): alinhamento vindo das classes do template,
    // bordas brancas (o "sem borda" da html-to-docx gera XML invalido) e linhas em
    // branco antes de cada linha de assinatura (espaco para assinar).
    h = h
      .replace(/<td class="dir"([^>]*)><p>/gi, '<td$1><p style="text-align:right">')
      .replace(/<td class="centro"([^>]*)><p>/gi, '<td$1><p style="text-align:center">')
      .replace(/<(table|td)\b([^>]*)>/gi, (_m: string, tag: string, attrs: string) =>
        `<${tag}${attrs.replace(/\sclass="[^"]*"/i, '').replace(/\sstyle="[^"]*"/i, '')} style="border:0px solid #ffffff;${tag.toLowerCase() === 'table' ? 'width:100%;' : ''}">`)
      .replace(/<p([^>]*)>((?:\d\.\s*)?_{10,})/gi, '<p$1><br><br><br>$2');
    // Fonte explicita em todo paragrafo/titulo: Times New Roman 11 pt (titulos
    // centralizados). Cabecalho e rodape mantem tamanhos proprios.
    const base = 'font-family:Times New Roman;font-size:11pt;';
    h = h.replace(/<(p|h[1-6])\b([^>]*)>/gi, (_m: string, tag: string, attrs: string) => {
      const extra = /^h/i.test(tag) ? 'text-align:center;' : '';
      if (/style\s*=\s*"/i.test(attrs)) return `<${tag}${attrs.replace(/style\s*=\s*"/i, `style="${base}${extra}`)}>`;
      return `<${tag}${attrs} style="${base}${extra}">`;
    });
    return h.trim();
  }

  // Exportacao Word (29/09/2026): mesmo corpo do PDF (buildPdfBody), sem <style>;
  // timbrado no cabecalho, nome do arquivo + numero da pagina no rodape. Margens = PDF.
  async exportDocx(id: string): Promise<Buffer> {
    const doc = await this.getDocumentOrFail(id);
    return this.renderDocx(doc, (await this.buildDownloadFilename(id)).replace(/\.pdf$/i, '.docx'));
  }

  // Renderizacao do Word a partir de um documento real ou virtual (Word de templates, 30/09/2026).
  async renderDocx(doc: any, fileName: string): Promise<Buffer> {
    const letterhead = await this.buildLetterheadInfo(doc);
    const body = this.buildDocxBody(doc.content);
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body>${body}</body></html>`;
    const texto = letterhead
      ? `<p style="text-align:right;font-family:Arial;font-size:8pt;line-height:100%;"><strong>${letterhead.legalName}</strong><br>${letterhead.enderecoLine1}<br>${letterhead.enderecoLine2}<br>CNPJ: ${letterhead.cnpjFmt}</p>`
      : '';
    const footer = `<p style="font-family:Arial;font-size:8pt;color:#888888;">${fileName}</p>`;
    const options = {
      orientation: 'portrait',
      pageSize: { width: 11906, height: 16838 },
      margins: { top: 1134, right: 1134, bottom: 1134, left: 1701, header: 340, footer: 340, gutter: 0 },
      header: !!letterhead,
      footer: true,
      pageNumber: true,
      font: 'Times New Roman',
      fontSize: 22,
      lang: 'pt-BR',
      title: doc.title,
    };
    const HTMLtoDOCX = require('html-to-docx');
    let out: any;
    try {
      out = await HTMLtoDOCX(html, letterhead ? (letterhead.logoImg ?? '') + texto : null, options, footer);
    } catch {
      out = await HTMLtoDOCX(html, texto || null, options, footer);
    }
    return Buffer.isBuffer(out) ? out : Buffer.from(await out.arrayBuffer());
  }

  // Importar versao revisada (29/09/2026): .docx -> HTML (mammoth) como nova versao.
  // So em RASCUNHO. Mantem o <style> do conteudo atual. Marca revisionImportedAt,
  // que impede a locacao de gerar o documento de novo por cima sem confirmacao.
  async importRevision(id: string, file: Express.Multer.File, userId: string) {
    this.validateUuid(userId, 'userId');
    const doc = await this.getDocumentOrFail(id);
    if (doc.status !== 'RASCUNHO') {
      throw new BadRequestException(`Documento com status ${doc.status}: a versao revisada so pode ser importada em Rascunho. Use Reabrir.`);
    }
    if (!/\.docx$/i.test(file.originalname ?? '')) {
      throw new BadRequestException('Envie um arquivo Word (.docx).');
    }
    const result = await mammoth.convertToHtml({ buffer: file.buffer });
    const corpo = (result.value ?? '').trim();
    if (!corpo) throw new BadRequestException('O arquivo nao tem conteudo legivel.');
    const estilo = (doc.content ?? '').match(/<style[\s\S]*?<\/style>/i)?.[0] ?? '';
    const content = (estilo ? estilo + '\n\n' : '') + corpo;
    const hash = this.sha256(content);
    const newVersion = doc.currentVersion + 1;
    await this.prisma.documentVersion.create({
      data: {
        documentId: id,
        version: newVersion,
        content,
        contentHash: hash,
        changeNote: `Versao revisada importada do Word (${file.originalname}) - v${newVersion}`,
        createdById: userId,
      },
    });
    return this.prisma.document.update({
      where: { id },
      data: { content, contentHash: hash, currentVersion: newVersion, revisionImportedAt: new Date(), updatedAt: new Date() },
    });
  }

  private async buildLocacaoBaseFilename(doc: any): Promise<string | null> {
    if (doc.type !== 'CONTRATO_LOCACAO') return null;
    const contract = await this.prisma.rentalContract.findFirst({
      where: { OR: [{ documentId: doc.id }, { signedDocumentId: doc.id }], deletedAt: null },
      include: { fixedAsset: { select: { internalCode: true } } },
    });
    if (!contract || !contract.fixedAsset?.internalCode) return null;
    const ddmmyy = (d: Date) => {
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yy = String(d.getUTCFullYear()).slice(-2);
      return `${dd}${mm}${yy}`;
    };
    const inicio = ddmmyy(contract.startDate);
    const fim = contract.endDate ? ddmmyy(contract.endDate) : 'indeterminado';
    return `Locação_${contract.fixedAsset.internalCode}_${inicio}a${fim}`;
  }

  async buildDownloadFilename(id: string): Promise<string> {
    const doc = await this.getDocumentOrFail(id);
    const base = await this.buildLocacaoBaseFilename(doc);
    return base ? `${base}.pdf` : `documento-${id}.pdf`;
  }

  async generateHtml(id: string): Promise<string> {
    const doc = await this.getDocumentOrFail(id);
    const letterhead = await this.buildLetterheadInfo(doc);
    const visibilityLabel: Record<string, string> = {
      PUBLICO: '', RESERVADO: 'RESERVADO',
      RESTRITO: 'RESTRITO', CONTROLADO: 'CONTROLADO - CONFIDENCIAL',
    };
    const watermark = doc.status === 'RASCUNHO' ? 'RASCUNHO' : (visibilityLabel[doc.visibility] ?? '');
    const signaturesHtml = (doc.signatures as any[])?.length > 0 ? `
      <div style="margin-top:48pt;border-top:1px solid #000;padding-top:16pt;">
        <p><strong>ASSINATURAS DIGITAIS</strong></p>
        ${(doc.signatures as any[]).map(s => `
          <p>✓ ${s.signerName} - ${this.signatureMethodLabel(s.method)} - ${new Date(s.signedAt).toLocaleDateString('pt-BR')}</p>
        `).join('')}
      </div>` : '';

    if (letterhead) {
      const pdfFileName = await this.buildDownloadFilename(id);
      const headerHtmlEsc = JSON.stringify(`
        <div class="letterhead-header">
          <div>${letterhead.logoImg}</div>
          <div style="text-align:right; line-height:1;">
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
  ${doc.visibility !== 'PUBLICO' ? `<div class="classification-bar">LEDGR - CLASSIFICAÇÃO: ${doc.visibility}</div>` : ''}
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

  async signPhysical(documentId: string, signerId: string, evidenceUrl: string, userId?: string) {
    if (!evidenceUrl) {
      throw new BadRequestException('E necessario anexar a evidencia (foto/scan) da assinatura fisica.');
    }
    const signer = await this.prisma.documentSigner.findFirst({
      where: { id: signerId, documentId },
    });
    if (!signer) throw new NotFoundException('Signatario nao encontrado.');

    const docForFilename = await this.prisma.document.findUnique({ where: { id: documentId } });
    const baseFilename = docForFilename ? await this.buildLocacaoBaseFilename(docForFilename) : null;
    let finalEvidenceUrl = evidenceUrl;
    if (baseFilename) {
      try {
        const fs = require('fs');
        const path = require('path');
        const cpfDigits = (signer.cpf ?? '').replace(/\D/g, '') || 'semdocumento';
        const oldRel = evidenceUrl.replace(/^\/+/, '');
        const oldFull = path.join(process.cwd(), oldRel);
        const ext = path.extname(oldFull);
        const safeBase = baseFilename.replace(/[\\/:*?"<>|]/g, '_');
        const newFileName = `${safeBase}_signed_${cpfDigits}${ext}`;
        const newFull = path.join(path.dirname(oldFull), newFileName);
        fs.renameSync(oldFull, newFull);
        finalEvidenceUrl = '/uploads/signatures/' + newFileName;
      } catch {
        finalEvidenceUrl = evidenceUrl;
      }
    }

    await this.prisma.documentSigner.update({
      where: { id: signerId },
      data: { status: 'ASSINADO' },
    });

    await this.prisma.documentSignature.create({
      data: {
        documentId,
        signerId,
        method: 'FISICO',
        status: 'ASSINADO',
        signerName: signer.name,
        signerCpf: signer.cpf,
        signerEmail: signer.email,
        signerRole: signer.role,
        signatureFormat: 'FISICO',
        evidenceUrl: finalEvidenceUrl,
        signedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId ?? null,
        action: 'DOCUMENT_SIGNER_SIGNED_PHYSICAL',
        targetId: documentId,
        after: { signerId, signerName: signer.name, role: signer.role },
      },
    });

    const before = await this.prisma.document.findUnique({ where: { id: documentId }, select: { status: true } });
    await this.checkAndUpdateDocumentStatus(documentId);
    const after = await this.prisma.document.findUnique({ where: { id: documentId }, select: { status: true } });

    if (before?.status !== after?.status) {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId ?? null,
          action: 'DOCUMENT_STATUS_CHANGED',
          targetId: documentId,
          before: { status: before?.status ?? null },
          after: { status: after?.status ?? null },
        },
      });
    }

    return after;
  }

  async reopenDocument(documentId: string, userId?: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { status: true },
    });
    if (!doc) throw new NotFoundException('Documento nao encontrado.');
    if (doc.status !== 'EM_REVISAO' && doc.status !== 'AGUARDANDO_ASSINATURA') {
      throw new BadRequestException(
        `Nao e possivel reabrir um documento com status ${doc.status}. Qualquer edicao apos assinatura (fisica ou digital) invalida a assinatura - reabertura so e permitida antes da conclusao da assinatura.`,
      );
    }

    await this.prisma.documentSignature.deleteMany({ where: { documentId } });
    await this.prisma.documentSigner.deleteMany({ where: { documentId } });

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'RASCUNHO', updatedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId ?? null,
        action: 'DOCUMENT_REOPENED',
        targetId: documentId,
        before: { status: doc.status },
        after: { status: 'RASCUNHO' },
      },
    });

    return updated;
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
// TODO: integração OAuth Gov.br - Lei 14.063/2020
// Recebe o code retornado pelo redirect, troca pelo token, aplica assinatura
async handleGovBrCallback(
  documentId: string,
  code: string,
  state: string,
  user: any,
): Promise<any> {
  throw new NotImplementedException('handleGovBrCallback: não implementado - aguardando integração Gov.br');
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
    // ARQ-DECL-01 (19/11/2026): arquivo identico (mesmo SHA-256) ja arquivado na empresa -> recusa, para nao duplicar
    const dup: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT title, to_char(created_at, 'DD/MM/YYYY') AS em FROM documents
        WHERE company_id = $1::uuid AND content_hash = $2 AND deleted_at IS NULL AND file_url IS NOT NULL LIMIT 1`,
      dto.companyId, contentHash);
    if (dup.length) throw new BadRequestException(`Arquivo idêntico já arquivado: "${dup[0].title}" (enviado em ${dup[0].em}).`);
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

  // ── Imoveis: matriculas e escrituras (04/11/2026) ─────────────
  // Vinculo documento x imovel em asset_documents (migracao 20261104_imoveis_matriculas.sql),
  // com a situacao registral. A matricula mais recente atualiza numero/cartorio no cadastro do imovel.
  private readonly SITUACOES_IMOVEL = ['EMPRESA', 'SOCIO_PENDENTE_REGISTRO', 'GRUPO_TERCEIRO', 'SEM_MATRICULA'];

  async listarDocsImoveis(companyId: string, tipo?: string) {
    this.validateUuid(companyId, 'companyId');
    const t = tipo === 'MATRICULA' || tipo === 'ESCRITURA' || tipo === 'CESSAO' ? tipo : null;
    return this.prisma.$queryRawUnsafe(
      `SELECT v.id, v.tipo, v.fixed_asset_id::text AS "fixedAssetId", a.internal_code AS "internalCode",
              a.description AS "assetDescription", v.numero_matricula AS "numeroMatricula", v.cartorio,
              to_char(v.data_certidao, 'YYYY-MM-DD') AS "dataCertidao", v.ultimo_ato AS "ultimoAto",
              v.proprietario_registral AS "proprietarioRegistral", v.situacao, v.observacao,
              d.id::text AS "documentId", d.title, d.status::text AS status, d.file_url AS "fileUrl"
         FROM asset_documents v
         JOIN documents d ON d.id = v.document_id AND d.deleted_at IS NULL
         JOIN fixed_assets a ON a.id = v.fixed_asset_id
        WHERE v.company_id = $1::uuid AND v.deleted_at IS NULL AND ($2::text IS NULL OR v.tipo = $2::text)
        ORDER BY a.internal_code, v.tipo, v.data_certidao DESC NULLS LAST, v.created_at DESC`,
      companyId, t,
    );
  }

  async importarDocImovel(file: Express.Multer.File, body: any, userId: string) {
    // 04/11/2026: tipo CESSAO (contrato de cessao) pode cobrir varios imoveis (fixedAssetIds separados por virgula)
    const companyId = body.companyId;
    this.validateUuid(companyId, 'companyId');
    const tipo = body.tipo === 'ESCRITURA' ? 'ESCRITURA' : body.tipo === 'CESSAO' ? 'CESSAO' : 'MATRICULA';
    const ids: string[] = Array.from(new Set(String(body.fixedAssetIds || body.fixedAssetId || '')
      .split(',').map((x: string) => x.trim()).filter(Boolean)));
    if (!ids.length) throw new BadRequestException('Informe o imovel.');
    if (tipo !== 'CESSAO' && ids.length > 1) throw new BadRequestException('Matricula e escritura sao de um imovel so.');
    ids.forEach(x => this.validateUuid(x, 'fixedAssetId'));
    if (!/\.pdf$/i.test(file.originalname ?? '')) throw new BadRequestException('Envie o documento em PDF.');
    if (!body.dataCertidao) throw new BadRequestException('Informe a data do documento.');
    if (!body.title || String(body.title).trim().length < 3) throw new BadRequestException('Informe o titulo do documento.');
    const situacao = tipo === 'CESSAO' ? 'EMPRESA' : (this.SITUACOES_IMOVEL.includes(body.situacao) ? body.situacao : 'EMPRESA');
    const assets = await this.prisma.fixedAsset.findMany({
      where: { id: { in: ids }, companyId, deletedAt: null },
      select: { id: true, internalCode: true },
    });
    if (assets.length !== ids.length) throw new BadRequestException('Imovel nao encontrado nesta empresa.');
    const vazio = (v: any) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
    const descricao = [vazio(body.ultimoAto),
      vazio(body.proprietarioRegistral) ? (tipo === 'CESSAO' ? 'Cedente: ' : 'Proprietario registral: ') + vazio(body.proprietarioRegistral) : null,
      tipo === 'CESSAO' ? 'Imoveis: ' + assets.map(a => a.internalCode).join(', ') : null]
      .filter(Boolean).join(' | ');

    const r = await this.importSignedPdf(file, {
      companyId,
      type: tipo === 'ESCRITURA' ? 'ESCRITURA_PUBLICA' : tipo === 'CESSAO' ? 'CONTRATO_CESSAO' : 'MATRICULA_IMOVEL',
      title: String(body.title).trim(),
      date: body.dataCertidao,
      description: descricao,
      validate: tipo === 'CESSAO' ? 'true' : 'false',
    }, userId);
    await this.prisma.document.update({
      where: { id: r.id },
      data: {
        ...(tipo === 'CESSAO' ? {} : { status: 'REGISTRADO' as any, registrationNumber: vazio(body.numeroMatricula), registrationDate: new Date(body.dataCertidao) }),
        notes: vazio(body.observacao),
      },
    });

    const vinculos: string[] = [];
    let cadastroAtualizado = false;
    for (const asset of assets) {
      const ins: any[] = await this.prisma.$queryRawUnsafe(
        `INSERT INTO asset_documents (company_id, fixed_asset_id, document_id, tipo, numero_matricula, cartorio, data_certidao,
                                      ultimo_ato, proprietario_registral, situacao, observacao, created_by_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::date, $8, $9, $10, $11, $12::uuid) RETURNING id::text AS id`,
        companyId, asset.id, r.id, tipo, tipo === 'CESSAO' ? null : vazio(body.numeroMatricula), tipo === 'CESSAO' ? null : vazio(body.cartorio),
        body.dataCertidao, vazio(body.ultimoAto), vazio(body.proprietarioRegistral), situacao, vazio(body.observacao), userId,
      );
      vinculos.push(ins[0]?.id);
      if (tipo === 'MATRICULA' && (vazio(body.numeroMatricula) || vazio(body.cartorio))) {
        const recente: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT id::text AS id FROM asset_documents
            WHERE fixed_asset_id = $1::uuid AND tipo = 'MATRICULA' AND deleted_at IS NULL
            ORDER BY data_certidao DESC NULLS LAST, created_at DESC LIMIT 1`, asset.id);
        if (recente[0]?.id === ins[0]?.id) {
          await this.prisma.fixedAsset.update({
            where: { id: asset.id },
            data: {
              ...(vazio(body.numeroMatricula) ? { registryNumber: vazio(body.numeroMatricula) as string } : {}),
              ...(vazio(body.cartorio) ? { registryOffice: vazio(body.cartorio) as string } : {}),
            },
          });
          cadastroAtualizado = true;
        }
      }
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: tipo === 'CESSAO' ? 'IMOVEL_CESSAO_ARQUIVADA' : 'IMOVEL_DOCUMENTO_ARQUIVADO',
        targetId: assets[0].id,
        after: { documentId: r.id, vinculos, imoveis: assets.map(a => a.internalCode), tipo, numeroMatricula: vazio(body.numeroMatricula), situacao, cadastroAtualizado },
      },
    });
    return { id: vinculos[0], vinculos, documentId: r.id, status: tipo === 'CESSAO' ? r.status : 'REGISTRADO', contentHash: r.contentHash, cadastroAtualizado };
  }

  async atualizarDocImovel(companyId: string, id: string, body: any, userId: string) {
    this.validateUuid(companyId, 'companyId');
    this.validateUuid(id, 'id');
    if (body?.situacao && !this.SITUACOES_IMOVEL.includes(body.situacao)) throw new BadRequestException('Situacao invalida.');
    const antes: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT situacao, observacao FROM asset_documents WHERE id = $1::uuid AND company_id = $2::uuid AND deleted_at IS NULL`, id, companyId);
    if (!antes.length) throw new NotFoundException('Documento do imovel nao encontrado.');
    await this.prisma.$executeRawUnsafe(
      `UPDATE asset_documents SET situacao = COALESCE($3::varchar, situacao), observacao = COALESCE($4::text, observacao), updated_at = now()
        WHERE id = $1::uuid AND company_id = $2::uuid`,
      id, companyId, body?.situacao ?? null, body?.observacao ?? null);
    await this.prisma.auditLog.create({
      data: {
        actorId: userId, action: 'IMOVEL_DOCUMENTO_SITUACAO', targetId: id,
        before: antes[0], after: { situacao: body?.situacao ?? antes[0].situacao, observacao: body?.observacao ?? antes[0].observacao },
      },
    });
    return { ok: true };
  }

  // ── Arquivo Digital reorganizado (04/11/2026) ─────────────────
  // Areas com abas; subtipo (coluna documents.subtipo) separa Balancete/ECD/ECF/Obrigacao etc.
  private readonly SUBTIPOS_DOC: Record<string, string[]> = { // ARQ-IMP-01 (19/11/2026): SPED, declaracoes e eSocial
    CONTABIL: ['BALANCETE', 'DEMONSTRACAO', 'ECD', 'LIVRO_CAIXA', 'EXTRATO_BANCARIO'],
    FISCAL: ['ECF', 'OBRIGACAO', 'DIMOB', 'DARF', 'NOTIFICACAO', 'ECD', 'EFD_CONTRIBUICOES', 'EFD_REINF', 'SPED_OUTROS', 'DCTF', 'DCTFWEB'],
    TRABALHISTA: ['CONTRATO_TRABALHO', 'ACORDO_COLETIVO', 'ESOCIAL', 'FOLHA', 'RECIBO_PROLABORE'],
  };

  async listarArquivo(companyId: string, types?: string, q?: string) {
    this.validateUuid(companyId, 'companyId');
    const tipos = (types ?? '').split(',').map(s => s.trim()).filter(s => /^[A-Z_]+$/.test(s));
    const busca = (q ?? '').trim();
    return this.prisma.$queryRawUnsafe(
      `SELECT d.id::text AS id, d.type::text AS type, d.subtipo, d.title, d.description, d.status::text AS status,
              d.visibility::text AS visibility, to_char(d.date, 'YYYY-MM-DD') AS date, d.created_at AS "createdAt"
         FROM documents d
        WHERE d.company_id = $1::uuid AND d.deleted_at IS NULL AND d.is_template = false
          AND ($2::text IS NULL OR d.type::text = ANY (string_to_array($2::text, ',')))
          AND ($3::text IS NULL OR d.title ILIKE '%' || $3::text || '%' OR coalesce(d.description, '') ILIKE '%' || $3::text || '%')
        ORDER BY d.date DESC NULLS LAST, d.created_at DESC
        LIMIT 1000`,
      companyId, tipos.length ? tipos.join(',') : null, busca || null,
    );
  }

  async listarLocacoesImoveis(companyId: string) {
    this.validateUuid(companyId, 'companyId');
    return this.prisma.$queryRawUnsafe(
      `SELECT d.id::text AS "documentId", d.title, d.status::text AS status, to_char(d.date, 'YYYY-MM-DD') AS date,
              rc.contract_number AS "contractNumber", rc.status::text AS "contractStatus",
              to_char(rc.start_date, 'YYYY-MM-DD') AS "startDate", to_char(rc.end_date, 'YYYY-MM-DD') AS "endDate",
              rc.tenant_name AS "tenantName", a.internal_code AS "internalCode"
         FROM documents d
         LEFT JOIN rental_contracts rc ON (rc.document_id = d.id OR rc.signed_document_id = d.id) AND rc.deleted_at IS NULL /* LOFT-ADITIVO-01: tambem pelo PDF assinado */
         LEFT JOIN fixed_assets a ON a.id = rc.fixed_asset_id
        WHERE d.company_id = $1::uuid AND d.deleted_at IS NULL AND d.is_template = false AND d.type::text = 'CONTRATO_LOCACAO'
        ORDER BY a.internal_code NULLS LAST, d.date DESC NULLS LAST`,
      companyId,
    );
  }

  // ── ARQ-LOC-01 (24/11/2026): contratos de locacao com os documentos ligados ──────────
  private readonly PAPEIS_LOCACAO = ['LASTRO', 'ADITIVO', 'TERMO', 'VISTORIA', 'NOTIFICACAO', 'GARANTIA', 'DOC_LOCATARIO', 'RECIBO', 'OUTRO'];

  // Contratos vigentes e futuros (status ATIVO), um por linha, com o lastro e os documentos ligados; e os
  // documentos de locacao sem vinculo (nao sao lastro, minuta nem documento ligado de nenhum contrato).
  async listarContratosLocacao(companyId: string) {
    if (!companyId) throw new BadRequestException('Empresa nao informada.');
    const iso = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
    const hoje = new Date().toISOString().slice(0, 10);
    const contratos = await this.prisma.rentalContract.findMany({
      where: { companyId, deletedAt: null, status: 'ATIVO' as any },
      include: { fixedAsset: { select: { internalCode: true } } },
      orderBy: { startDate: 'asc' },
    });
    const todosContratos = await this.prisma.rentalContract.findMany({
      where: { companyId, deletedAt: null },
      select: { signedDocumentId: true, documentId: true },
    });
    const vinculos = await this.prisma.rentalContractDocument.findMany({ where: { companyId, deletedAt: null } });
    const ocupados = new Set<string>();
    for (const c of todosContratos) { if (c.signedDocumentId) ocupados.add(c.signedDocumentId); if (c.documentId) ocupados.add(c.documentId); }
    for (const v of vinculos) ocupados.add(v.documentId);
    const ids = new Set<string>();
    contratos.forEach(c => { if (c.signedDocumentId) ids.add(c.signedDocumentId); });
    vinculos.forEach(v => ids.add(v.documentId));
    const docs = ids.size ? await this.prisma.document.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, title: true, date: true, status: true, fileUrl: true, deletedAt: true },
    }) : [];
    const dMap = new Map(docs.map(d => [d.id, d]));
    const info = (id: string | null) => {
      const d = id ? dMap.get(id) : undefined;
      return d && !d.deletedAt ? { documentId: d.id, title: d.title, data: iso(d.date), status: String(d.status), temArquivo: !!d.fileUrl } : null;
    };
    const lista = contratos.map(c => {
      const inicio = iso(c.startDate) as string;
      const fim = iso(c.endDate);
      const situacao = inicio > hoje ? 'RESERVADO' : (fim && fim < hoje ? 'VENCIDO' : 'VIGENTE');
      const documentos = vinculos
        .filter(v => v.rentalContractId === c.id)
        .map(v => { const d = info(v.documentId); return d ? { vinculoId: v.id, papel: v.papel, ...d, data: iso(v.dataDocumento) ?? d.data, observacao: v.observacao ?? null } : null; })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => String(a.data ?? '').localeCompare(String(b.data ?? '')));
      return {
        id: c.id, numero: c.contractNumber, imovelId: c.fixedAssetId, imovel: (c as any).fixedAsset?.internalCode ?? null,
        locatario: c.tenantName, inicio, fim, situacao,
        lastro: info(c.signedDocumentId), lastroRessalva: c.lastroRessalva ?? null,
        reajuste: situacaoReajuste(c as any), // REAJ-01
        documentos,
      };
    }).sort((a, b) => String(a.imovel ?? '').localeCompare(String(b.imovel ?? ''), 'pt-BR', { numeric: true }) || a.inicio.localeCompare(b.inicio));
    const soltos = await this.prisma.document.findMany({
      where: { companyId, deletedAt: null, type: 'CONTRATO_LOCACAO' as any, id: { notIn: [...ocupados] } },
      select: { id: true, title: true, date: true, status: true, fileUrl: true },
      orderBy: { date: 'desc' },
    });
    return {
      contratos: lista,
      semVinculo: soltos.map(d => ({ documentId: d.id, title: d.title, data: iso(d.date), status: String(d.status), temArquivo: !!d.fileUrl })),
    };
  }

  // Liga um documento ao contrato com um papel. LASTRO grava o PDF assinado do contrato (so se ainda nao tiver).
  async vincularDocumentoContrato(companyId: string, userId: string, contratoId: string, body: any) {
    const papel = String(body?.papel ?? '').toUpperCase();
    if (!this.PAPEIS_LOCACAO.includes(papel)) throw new BadRequestException('Papel do documento invalido.');
    const documentId = String(body?.documentId ?? '');
    const contrato = await this.prisma.rentalContract.findFirst({ where: { id: contratoId, companyId, deletedAt: null } });
    if (!contrato) throw new NotFoundException('Contrato de locacao nao encontrado.');
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, companyId, deletedAt: null } });
    if (!doc) throw new NotFoundException('Documento nao encontrado.');
    if (papel === 'LASTRO') {
      if (contrato.signedDocumentId && contrato.signedDocumentId !== documentId) {
        throw new BadRequestException('O contrato ja tem o PDF assinado (lastro). Vincule este documento com outro papel.');
      }
      await this.prisma.rentalContract.update({ where: { id: contrato.id }, data: { signedDocumentId: documentId, updatedById: userId } });
      return { ok: true, papel };
    }
    if (contrato.signedDocumentId === documentId) throw new BadRequestException('Este documento ja e o lastro do contrato.');
    const existe = await this.prisma.rentalContractDocument.findFirst({ where: { rentalContractId: contrato.id, documentId, deletedAt: null } });
    if (existe) throw new BadRequestException('Documento ja vinculado a este contrato.');
    const data = body?.data ? new Date(String(body.data).slice(0, 10) + 'T00:00:00Z') : null;
    const v = await this.prisma.rentalContractDocument.create({
      data: {
        companyId, rentalContractId: contrato.id, documentId, papel, dataDocumento: data,
        observacao: body?.observacao ? String(body.observacao).slice(0, 1000) : null, createdById: userId,
      },
    });
    return { ok: true, papel, vinculoId: v.id };
  }

  // Desfaz o vinculo (soft-delete); o documento continua no Arquivo Digital e volta para "sem vinculo".
  async desvincularDocumentoContrato(companyId: string, vinculoId: string) {
    const v = await this.prisma.rentalContractDocument.findFirst({ where: { id: vinculoId, companyId, deletedAt: null } });
    if (!v) throw new NotFoundException('Vinculo nao encontrado.');
    await this.prisma.rentalContractDocument.update({ where: { id: v.id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async definirSubtipo(companyId: string, id: string, subtipo: string | null, userId: string) {
    this.validateUuid(companyId, 'companyId');
    this.validateUuid(id, 'id');
    const docs: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT type::text AS type, subtipo FROM documents WHERE id = $1::uuid AND company_id = $2::uuid AND deleted_at IS NULL`, id, companyId);
    if (!docs.length) throw new NotFoundException('Documento nao encontrado.');
    const novo = subtipo ? String(subtipo) : null;
    if (novo && !(this.SUBTIPOS_DOC[docs[0].type] ?? []).includes(novo)) {
      throw new BadRequestException(`Subtipo ${novo} nao se aplica a documentos do tipo ${docs[0].type}.`);
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE documents SET subtipo = $3::varchar, updated_at = now() WHERE id = $1::uuid AND company_id = $2::uuid`, id, companyId, novo);
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'DOCUMENT_SUBTIPO', targetId: id, before: { subtipo: docs[0].subtipo }, after: { subtipo: novo } },
    });
    return { ok: true, subtipo: novo };
  }
}
