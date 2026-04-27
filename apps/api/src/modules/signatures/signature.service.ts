// apps/api/src/modules/signatures/signature.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CertificatesService } from './certificates.service';
import * as forge from 'node-forge';
import * as crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class SignatureService {
  constructor(
    private prisma: PrismaService,
    private certificatesService: CertificatesService,
  ) {}

  // ── Adicionar signatários ao documento ─────────────────────────────────────
  async addSigners(documentId: string, companyId: string, signers: Array<{
    name: string; cpf?: string; email?: string; role?: string; order: number;
  }>) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, companyId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return this.prisma.$transaction(
      signers.map(s => this.prisma.documentSigner.create({
        data: {
          documentId,
          name: s.name,
          cpf: s.cpf,
          email: s.email,
          role: s.role,
          order: s.order,
          status: 'PENDENTE',
        },
      }))
    );
  }

  async getSigners(documentId: string) {
    return this.prisma.documentSigner.findMany({
      where: { documentId },
      include: { signatures: true },
      orderBy: { order: 'asc' },
    });
  }

  // ── Assinar com certificado A1 ─────────────────────────────────────────────
  async signWithA1(documentId: string, companyId: string, signerId: string, certId: string) {
    const [doc, signer] = await Promise.all([
      this.prisma.document.findFirst({ where: { id: documentId, companyId } }),
      this.prisma.documentSigner.findFirst({ where: { id: signerId, documentId } }),
    ]);
    if (!doc) throw new NotFoundException('Documento não encontrado');
    if (!signer) throw new NotFoundException('Signatário não encontrado');
    if (signer.status === 'ASSINADO') throw new BadRequestException('Já assinado por este signatário');

    // Verificar ordem — só pode assinar se todos os anteriores já assinaram
    if (signer.order > 1) {
      const previous = await this.prisma.documentSigner.findMany({
        where: { documentId, order: { lt: signer.order } },
      });
      const allSigned = previous.every(p => p.status === 'ASSINADO');
      if (!allSigned) throw new BadRequestException('Aguardando assinatura(s) anterior(es) na sequência');
    }

    const { privateKeyPem, certificatePem } = await this.certificatesService.getPrivateKey(companyId, certId);

    // Calcular hash do conteúdo do documento
    const content = doc.content ?? doc.pdfUrl ?? '';
    const documentHash = crypto.createHash('sha256').update(content).digest('hex');

    // Assinar hash com chave privada RSA
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const md = forge.md.sha256.create();
    md.update(documentHash, 'utf8');
    const signatureBytes = privateKey.sign(md);
    const signatureHash = forge.util.encode64(signatureBytes);

    // Extrair dados do certificado para snapshot
    const cert = forge.pki.certificateFromPem(certificatePem);
    const certData = {
      subject: cert.subject.getField('CN')?.value,
      issuer: cert.issuer.getField('CN')?.value,
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
    };

    return this.prisma.$transaction(async (tx) => {
      // Registrar assinatura
      const signature = await tx.documentSignature.create({
        data: {
          documentId,
          signerId,
          method: 'CERT_A1',
          status: 'ASSINADO',
          signerName: signer.name,
          signerCpf: signer.cpf,
          signerEmail: signer.email,
          signerRole: signer.role,
          documentHash,
          signatureHash,
          signatureFormat: 'RSA-SHA256',
          certificateData: certData as any,
          ipAddress: null,
          signedAt: new Date(),
        },
      });

      // Atualizar status do signatário
      await tx.documentSigner.update({
        where: { id: signerId },
        data: { status: 'ASSINADO' },
      });

      // Verificar se todos assinaram → atualizar documento
      const allSigners = await tx.documentSigner.findMany({ where: { documentId } });
      const allSigned = allSigners.every(s => s.status === 'ASSINADO');
      if (allSigned) {
        await tx.document.update({
          where: { id: documentId },
          data: { status: 'ASSINADO', digitalSignature: signatureHash },
        });
      }

      return signature;
    });
  }

  // ── Iniciar fluxo gov.br ───────────────────────────────────────────────────
  async initiateGovBr(documentId: string, companyId: string, signerId: string, redirectUrl: string) {
    const [doc, signer] = await Promise.all([
      this.prisma.document.findFirst({ where: { id: documentId, companyId } }),
      this.prisma.documentSigner.findFirst({ where: { id: signerId, documentId } }),
    ]);
    if (!doc) throw new NotFoundException('Documento não encontrado');
    if (!signer) throw new NotFoundException('Signatário não encontrado');

    const content = doc.content ?? '';
    const documentHash = crypto.createHash('sha256').update(content).digest('hex');

    // Criar registro pendente
    await this.prisma.documentSignature.create({
      data: {
        documentId,
        signerId,
        method: 'GOVBR',
        status: 'PENDENTE',
        signerName: signer.name,
        signerCpf: signer.cpf,
        signerEmail: signer.email,
        signerRole: signer.role,
        documentHash,
        govbrTransactionId: `ledgr-${documentId}-${signerId}-${Date.now()}`,
      },
    });

    // URL de autorização gov.br (contas.acesso.gov.br)
    const govBrAuthUrl = `https://contas.acesso.gov.br/authorize?` +
      `response_type=code` +
      `&client_id=${process.env.GOVBR_CLIENT_ID ?? 'ledgr'}` +
      `&scope=openid+profile+govbr_confiabilidades` +
      `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
      `&state=${documentId}:${signerId}` +
      `&nonce=${crypto.randomBytes(16).toString('hex')}`;

    return { authUrl: govBrAuthUrl, documentHash };
  }

  // ── Callback gov.br ───────────────────────────────────────────────────────
  async processGovBrCallback(documentId: string, signerId: string, code: string) {
    const signature = await this.prisma.documentSignature.findFirst({
      where: { documentId, signerId, method: 'GOVBR', status: 'PENDENTE' },
    });
    if (!signature) throw new NotFoundException('Assinatura pendente não encontrada');

    // Em produção: trocar code por token e validar com gov.br
    // Por ora registrar como assinado com o code recebido
    return this.prisma.$transaction(async (tx) => {
      await tx.documentSignature.update({
        where: { id: signature.id },
        data: {
          status: 'ASSINADO',
          signatureHash: code,
          govbrAccountLevel: 'bronze',
          signedAt: new Date(),
        },
      });
      await tx.documentSigner.update({
        where: { id: signerId },
        data: { status: 'ASSINADO' },
      });
      const allSigners = await tx.documentSigner.findMany({ where: { documentId } });
      if (allSigners.every(s => s.status === 'ASSINADO')) {
        await tx.document.update({
          where: { id: documentId },
          data: { status: 'ASSINADO' },
        });
      }
      return { success: true };
    });
  }

  // ── Status de assinatura do documento ─────────────────────────────────────
  async getSignatureStatus(documentId: string) {
    const [signers, signatures] = await Promise.all([
      this.prisma.documentSigner.findMany({
        where: { documentId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.documentSignature.findMany({
        where: { documentId },
        orderBy: { signedAt: 'desc' },
      }),
    ]);
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { status: true, digitalSignature: true, contentHash: true },
    });
    return { document: doc, signers, signatures };
  }
}
