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

  async updateStatus(id: string, status: string) {
    return this.prisma.document.update({
      where: { id },
      data: { status: status as DocumentStatus, updatedAt: new Date() },
    });
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

  async generatePdf(id: string): Promise<Buffer> {
    const doc = await this.getDocumentOrFail(id);

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
          @page { size: A4; margin: 25mm 30mm 25mm 30mm; }
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
        </style>
      </head>
      <body>
        ${watermarkText ? `<div class="watermark">${watermarkText}</div>` : ''}
        ${doc.content.split('\n\n').map((p: string) => `<p>${p.trim()}</p>`).join('\n')}
        ${doc.signatures?.length > 0 ? `
          <div class="signature-block">
            <p><strong>ASSINATURAS DIGITAIS</strong></p>
            ${(doc.signatures as any[]).map(s => `
              <p>✓ ${s.signerName} — ${s.method === 'GOVBR' ? 'gov.br' : 'Certificado ICP-Brasil'} — ${new Date(s.signedAt).toLocaleDateString('pt-BR')}</p>
            `).join('')}
          </div>
        ` : ''}
        ${doc.visibility !== 'PUBLICO'
          ? `<div class="classification-bar">LEDGR — CLASSIFICAÇÃO: ${doc.visibility}</div>`
          : ''}
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true }) as Buffer;
    await browser.close();

    return pdfBuffer;
  }

  async generateHtml(id: string): Promise<string> {
    const doc = await this.getDocumentOrFail(id);
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
