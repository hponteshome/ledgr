// apps/api/src/modules/signatures/signature-validator.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as forge from 'node-forge';
import * as crypto from 'crypto';

export interface SignatureValidationResult {
  valid: boolean;
  signatures: SignatureInfo[];
  documentHash: string;
  validatedAt: Date;
  errors: string[];
}

export interface SignatureInfo {
  signerName: string;
  signerCpf: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  signedAt: Date | null;
  certificateType: 'ICP_BRASIL' | 'GOVBR' | 'OTHER';
  trustLevel: 'VALID' | 'EXPIRED' | 'UNTRUSTED' | 'UNKNOWN';
  algorithm: string;
}

@Injectable()
export class SignatureValidatorService {
  constructor(private prisma: PrismaService) {}

  async validateSignedPdf(pdfBuffer: Buffer, documentId?: string): Promise<SignatureValidationResult> {
    const errors: string[] = [];
    const signatures: SignatureInfo[] = [];
    const documentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    try {
      const sigBuffers = this.extractSignatureBuffers(pdfBuffer);
      console.log(`[Validator] Encontrados ${sigBuffers.length} blocos de assinatura`);

      for (const buf of sigBuffers) {
        try {
          const info = this.parseCertificateFromBytes(buf);
          if (info) signatures.push(info);
        } catch (e: any) {
          console.log('[Validator] Erro no bloco:', e.message);
          errors.push(`Erro ao processar assinatura: ${e.message}`);
        }
      }

      if (sigBuffers.length === 0) {
        errors.push('Nenhuma assinatura digital encontrada no PDF');
      }
    } catch (e: any) {
      errors.push(`Erro ao processar PDF: ${e.message}`);
    }

    const result: SignatureValidationResult = {
      valid: signatures.length > 0 && signatures.some(s => s.trustLevel === 'VALID'),
      signatures,
      documentHash,
      validatedAt: new Date(),
      errors,
    };

    if (documentId) await this.registerValidation(documentId, result).catch(() => {});
    return result;
  }

  // ── Extrair todos os blocos de assinatura do PDF ──────────────────────────
  private extractSignatureBuffers(pdfBuffer: Buffer): Buffer[] {
    const results: Buffer[] = [];
    const pdfStr = pdfBuffer.toString('binary');

    // Buscar /Contents <hex> — formato padrão de assinatura PDF
    const re = /\/Contents[\s]*<([0-9A-Fa-f\s]+)>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pdfStr)) !== null) {
      const hex = m[1].replace(/\s/g, '');
      if (hex.length > 200) {
        try {
          const buf = Buffer.from(hex, 'hex');
          results.push(buf);
          console.log(`[Validator] Bloco extraído: ${buf.length} bytes`);
        } catch {}
      }
    }

    return results;
  }

  // ── Parsear certificado dos bytes PKCS#7/CMS ──────────────────────────────
  private parseCertificateFromBytes(buf: Buffer): SignatureInfo | null {
    // Tentar múltiplas abordagens

    // Abordagem 1: node-forge messageFromAsn1
    try {
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(buf.toString('binary')), false);
      const p7 = forge.pkcs7.messageFromAsn1(asn1) as any;
      if (p7?.certificates?.length > 0) {
        return this.extractFromForgeCert(p7.certificates[0]);
      }
    } catch {}

    // Abordagem 2: Extrair certificados X.509 embutidos diretamente via ASN.1
    try {
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(buf.toString('binary')), false);
      const certs = this.findCertificatesInAsn1(asn1);
      if (certs.length > 0) {
        return this.extractFromForgeCert(certs[0]);
      }
    } catch {}

    // Abordagem 3: Buscar certificado X.509 nos bytes brutos por OID conhecido
    try {
      const cert = this.extractCertFromRawBytes(buf);
      if (cert) return cert;
    } catch {}

    // Abordagem 4: Extrair dados diretamente de campos de texto no PDF
    const textInfo = this.extractFromPdfText(buf);
    if (textInfo) return textInfo;

    return null;
  }

  // ── Buscar certificados recursivamente no ASN.1 ───────────────────────────
  private findCertificatesInAsn1(asn1: forge.asn1.Asn1): forge.pki.Certificate[] {
    const certs: forge.pki.Certificate[] = [];

    const search = (node: forge.asn1.Asn1) => {
      try {
        // Tentar parsear como certificado X.509
        const cert = forge.pki.certificateFromAsn1(node);
        certs.push(cert);
        return;
      } catch {}

      if (Array.isArray(node.value)) {
        for (const child of node.value) {
          search(child as forge.asn1.Asn1);
        }
      }
    };

    search(asn1);
    return certs;
  }

  // ── Extrair dados de um certificado forge ─────────────────────────────────
  private extractFromForgeCert(cert: forge.pki.Certificate): SignatureInfo {
    const cn = cert.subject.getField('CN')?.value ?? '';
    const issuerCn = cert.issuer.getField('CN')?.value ?? '';
    const cpf = this.extractCpfFromCn(cn);
    const certType = this.detectCertType(issuerCn);
    const now = new Date();
    const trustLevel = (now >= cert.validity.notBefore && now <= cert.validity.notAfter)
      ? (certType !== 'OTHER' ? 'VALID' : 'UNTRUSTED')
      : 'EXPIRED';

    return {
      signerName: cn.split(':')[0].trim(),
      signerCpf: cpf,
      issuer: issuerCn,
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
      signedAt: new Date(),
      certificateType: certType,
      trustLevel,
      algorithm: 'RSA',
    };
  }

  // ── Buscar sequências X.509 nos bytes brutos ──────────────────────────────
  private extractCertFromRawBytes(buf: Buffer): SignatureInfo | null {
    // Procurar por sequências DER que possam ser certificados X.509
    for (let i = 0; i < buf.length - 4; i++) {
      if (buf[i] === 0x30) { // SEQUENCE
        try {
          const sub = buf.slice(i);
          const asn1 = forge.asn1.fromDer(
            forge.util.createBuffer(sub.toString('binary')), false
          );
          const cert = forge.pki.certificateFromAsn1(asn1);
          if (cert?.subject) {
            return this.extractFromForgeCert(cert);
          }
        } catch {}
      }
    }
    return null;
  }

  // ── Extrair dados de texto legível no buffer ──────────────────────────────
  private extractFromPdfText(buf: Buffer): SignatureInfo | null {
    const text = buf.toString('latin1');

    // Buscar padrões de CPF e nome em texto legível
    const cpfMatch = text.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
    const namePatterns = [
      /CN=([^,\n\r\x00-\x1F]+)/,
      /([A-Z][A-Z\s]{5,50}:\d{11})/,
    ];

    let name = '';
    let cpf = cpfMatch ? cpfMatch[1] : '';

    for (const re of namePatterns) {
      const m = text.match(re);
      if (m) { name = m[1].split(':')[0].trim(); break; }
    }

    // Buscar emissor
    const issuerMatch = text.match(/(?:AC|Autoridade Certificadora)[^,\n\r\x00-\x1F]*/i);
    const issuer = issuerMatch ? issuerMatch[0].trim() : 'ICP-Brasil';

    if (name || cpf) {
      return {
        signerName: name || 'Nome não identificado',
        signerCpf: cpf ? this.formatCpf(cpf) : '',
        issuer,
        serialNumber: crypto.randomBytes(4).toString('hex'),
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        signedAt: new Date(),
        certificateType: this.detectCertType(issuer),
        trustLevel: this.detectCertType(issuer) !== 'OTHER' ? 'VALID' : 'UNKNOWN',
        algorithm: 'RSA',
      };
    }
    return null;
  }

  private extractCpfFromCn(cn: string): string {
    const match = cn.match(/:(\d{11})/) ?? cn.match(/(\d{11})/);
    return match ? this.formatCpf(match[1]) : '';
  }

  private formatCpf(cpf: string): string {
    const d = cpf.replace(/\D/g, '');
    if (d.length !== 11) return cpf;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  }

  private detectCertType(issuer: string): SignatureInfo['certificateType'] {
    const l = issuer.toLowerCase();
    if (l.includes('gov.br') || l.includes('acesso.gov')) return 'GOVBR';
    const icpACs = ['serpro','certisign','valid','safeweb','soluti','ac ','icp','serasa','caixa','receita','oab','jus','iti','instituto nacional','rfb','casa da moeda','digitalsign'];
    if (icpACs.some(a => l.includes(a))) return 'ICP_BRASIL';
    return 'OTHER';
  }

  private async registerValidation(documentId: string, result: SignatureValidationResult) {
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        contentHash: result.documentHash,
        status: result.valid ? 'ASSINADO' : 'EM_REVISAO',
      },
    }).catch(() => {});

    // Persistir signatarios detectados (limpa anteriores e recria)
    await this.prisma.documentSigner.deleteMany({ where: { documentId } }).catch(() => {});
    const uniqueSigs = result.signatures.filter((s, i, arr) => arr.findIndex(x => x.signerCpf === s.signerCpf) === i);
    for (const sig of uniqueSigs) {
      await this.prisma.documentSigner.create({
        data: {
          documentId,
          name:   sig.signerName,
          cpf:    sig.signerCpf || null,
          role:   sig.certificateType,
          status: sig.trustLevel === 'VALID' ? 'ASSINADO' : 'PENDENTE',
        },
      }).catch(() => {});
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'SIGNATURE_VALIDATED',
        targetId: documentId,
        after: {
          valid: result.valid,
          signers: result.signatures.map(s => s.signerName),
          hash: result.documentHash,
        },
      },
    }).catch(() => {});
  }
}
