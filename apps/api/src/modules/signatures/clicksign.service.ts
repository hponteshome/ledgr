// apps/api/src/modules/signatures/clicksign.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const CS_BASE = () => process.env.CLICKSIGN_BASE_URL ?? 'https://sandbox.clicksign.com';
const CS_TOKEN = () => process.env.CLICKSIGN_ACCESS_TOKEN ?? '';

@Injectable()
export class ClicksignService {
  constructor(private prisma: PrismaService) {}

  // ── Helper HTTP ───────────────────────────────────────────────────────────
  private async csRequest(method: string, endpoint: string, body?: any): Promise<any> {
    const url = `${CS_BASE()}/api/v1${endpoint}?access_token=${CS_TOKEN()}`;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[ClickSign] ${method} ${endpoint} → ${res.status}: ${err}`);
      throw new BadRequestException(`ClickSign API error: ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ── 1. Upload do documento PDF ────────────────────────────────────────────
  async uploadDocument(pdfBuffer: Buffer, filename: string, deadline?: Date): Promise<string> {
    const base64 = pdfBuffer.toString('base64');
    const deadlineDate = deadline ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    const body = {
      document: {
        path: `/${filename}`,
        content_base64: `data:application/pdf;base64,${base64}`,
        deadline_at: deadlineDate.toISOString(),
        auto_close: true,
        locale: 'pt-BR',
        sequence_enabled: true, // assinatura sequencial
      },
    };

    const res = await this.csRequest('POST', '/documents', body);
    return res.document.key;
  }

  // ── 2. Adicionar signatário ────────────────────────────────────────────────
  async addSigner(params: {
    name: string;
    email: string;
    cpf?: string;
    phone?: string;
    auth: 'email' | 'sms' | 'whatsapp' | 'pix' | 'icp';
    selfie?: boolean;
  }): Promise<string> {
    console.log('[ClickSign addSigner] auth:', params.auth, 'name:', params.name);
    const body = {
      signer: {
        name: params.name,
        email: params.email,
        phone_number: params.phone,
        documentation: params.cpf,
        auths: [params.auth ?? "email"],
        selfie_enabled: params.selfie ?? false,
        has_documentation: !!params.cpf,
        delivery: 'email',
      },
    };
    const res = await this.csRequest('POST', '/signers', body);
    return res.signer.key;
  }

  // ── 3. Adicionar signatário ao documento ──────────────────────────────────
  async addSignerToDocument(documentKey: string, signerKey: string, order: number): Promise<string> {
    const body = {
      list: {
        document_key: documentKey,
        signer_key: signerKey,
        sign_as: 'sign',
        group: order,
        message: 'Por favor, assine o documento.',
      },
    };
    const res = await this.csRequest('POST', '/lists', body);
    return res.list.key;
  }

  // ── 4. Ativar documento (dispara e-mails) ─────────────────────────────────
  async activateDocument(documentKey: string): Promise<void> {
    // Documento já fica ativo ao ser criado — apenas logar
    console.log('[ClickSign] Documento ativo:', documentKey);
  }
  // ── 5. Fluxo completo: criar solicitação de assinatura ────────────────────
  async createSignatureRequest(params: {
    documentId: string;
    companyId: string;
    pdfBuffer: Buffer;
    filename: string;
    signers: Array<{
      id: string;
      name: string;
      email: string;
      cpf?: string;
      phone?: string;
      order: number;
      auth: 'email' | 'sms' | 'whatsapp' | 'pix' | 'icp';
    }>;
    deadline?: Date;
  }): Promise<{ documentKey: string }> {
    // Upload do PDF
    const documentKey = await this.uploadDocument(params.pdfBuffer, params.filename, params.deadline);

    // Adicionar signatários em sequência
    for (const signer of params.signers.sort((a, b) => a.order - b.order)) {
      const signerKey = await this.addSigner({
        name: signer.name,
        email: signer.email,
        cpf: signer.cpf,
        phone: signer.phone,
        auth: signer.auth,
      });
      await this.addSignerToDocument(documentKey, signerKey, signer.order);

      // Atualizar signatário no banco com referência ClickSign
      await this.prisma.documentSigner.update({
        where: { id: signer.id },
        data: { notifiedAt: new Date() },
      });
    }

    // Ativar — dispara e-mails
    await this.activateDocument(documentKey);

    // Salvar referência do documento ClickSign
    await this.prisma.document.update({
      where: { id: params.documentId },
      data: {
        status: 'AGUARDANDO_ASSINATURA',
        digitalSignature: documentKey, // chave ClickSign
      },
    });

    // Log de auditoria
    await this.prisma.auditLog.create({
      data: {
        action: 'CLICKSIGN_REQUEST_CREATED',
        targetId: params.documentId,
        after: { documentKey, signers: params.signers.length },
      },
    });

    return { documentKey };
  }

  // ── 6. Webhook — processar notificação de assinatura ──────────────────────
  async processWebhook(payload: any): Promise<void> {
    const { event, document } = payload;
    if (!event || !document) return;

    const documentKey = document.key;
    const doc = await this.prisma.document.findFirst({
      where: { digitalSignature: documentKey },
      include: { signers: true },
    });
    if (!doc) return;

    if (event.name === 'sign') {
      // Um signatário assinou
      const signerEmail = event.signer?.email;
      const signer = doc.signers.find(s => s.email === signerEmail);
      if (signer) {
        await this.prisma.documentSigner.update({
          where: { id: signer.id },
          data: { status: 'ASSINADO' },
        });
        await this.prisma.documentSignature.create({
          data: {
            documentId: doc.id,
            signerId: signer.id,
            method: 'CERT_A1',
            status: 'ASSINADO',
            signerName: signer.name,
            signerCpf: signer.cpf,
            signerEmail: signer.email,
            signerRole: signer.role,
            documentHash: crypto.createHash('sha256').update(documentKey).digest('hex'),
            signatureHash: event.signer?.key ?? documentKey,
            govbrTransactionId: event.signer?.key,
            signedAt: new Date(event.at ?? Date.now()),
          },
        });
      }
    }

    if (event.name === 'close' && document.status === 'closed') {
      // Todos assinaram — baixar PDF assinado e atualizar status
      await this.prisma.document.update({
        where: { id: doc.id },
        data: { status: 'ASSINADO' },
      });
      await this.prisma.auditLog.create({
        data: {
          action: 'DOCUMENT_FULLY_SIGNED',
          targetId: doc.id,
          after: { documentKey, status: 'closed' },
        },
      });
    }
  }

  // ── 7. Baixar PDF assinado ────────────────────────────────────────────────
  async downloadSignedPdf(documentKey: string): Promise<Buffer> {
    const url = `${CS_BASE()}/api/v1/documents/${documentKey}/download?access_token=${CS_TOKEN()}`;
    const res = await fetch(url);
    if (!res.ok) throw new NotFoundException('PDF assinado não disponível ainda');
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ── 8. Status do documento no ClickSign ───────────────────────────────────
  async getDocumentStatus(documentKey: string): Promise<any> {
    return this.csRequest('GET', `/documents/${documentKey}`);
  }
}
