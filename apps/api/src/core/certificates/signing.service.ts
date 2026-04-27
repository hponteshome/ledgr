// src/core/certificates/signing.service.ts
//
// Responsabilidades:
//  1. Importar certificado .p12/.pfx → extrair cert público + chave privada
//  2. Cache em memória de chaves descriptografadas (TTL 5 min)
//  3. Assinar PDF com PAdES  (node-signpdf + pdf-lib)
//  4. Assinar XML com XAdES-BES  (xml-crypto)
//  5. Validar certificado X.509 (expiração, cadeia)
//
// INSTALAÇÃO:
//   npm install --prefix apps/api node-forge @peculiar/x509 node-signpdf pdf-lib xml-crypto xmlbuilder2
//
// Dependência interna: CryptoService

import { X509Certificate } from '@peculiar/x509';


import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as forge from 'node-forge';
import * as crypto from 'crypto';

// ── Cache em memória para chaves descriptografadas ───────────────
interface CachedKey {
  privateKeyPem: string;
  certPem:       string;
  expiresAt:     number;
}
const KEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// ── Resultado de validação ───────────────────────────────────────
export interface CertValidationResult {
  valid:          boolean;
  expired:        boolean;
  validFrom:      Date;
  validTo:        Date;
  subject:        string;
  issuer:         string;
  serialNumber:   string;
  fingerprint:    string;
  daysRemaining:  number;
}

// ── Metadados extraídos de um .p12 ──────────────────────────────
export interface P12Parsed {
  privateKeyPem: string;
  certPem:       string;
  chainPem:      string[];
  subject:       string;
  issuer:        string;
  serialNumber:  string;
  validFrom:     Date;
  validTo:       Date;
  fingerprint:   string;
}

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);
  private readonly keyCache = new Map<string, CachedKey>();

  constructor(
    private readonly cryptoService: CryptoService,
    private readonly prisma: PrismaService,
  ) {
    // Limpa expirados a cada minuto
    setInterval(() => this.purgeExpiredCache(), 60_000);
  }

  // ════════════════════════════════════════════════════════════
  // 1. IMPORTAÇÃO DE CERTIFICADO
  // ════════════════════════════════════════════════════════════

  parseP12(pfxBuffer: Buffer, password: string): P12Parsed {
    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      // CORREÇÃO: Usar string binária para o forge processar o DER corretamente
      const pfxAsn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
    } catch (err) {
      throw new BadRequestException(
        'Não foi possível abrir o arquivo .p12. Verifique se a senha está correta.',
      );
    }

    // Extrair chave privada (PKCS#8 Shrouded ou KeyBag simples)
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    let keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    
    if (!keyBag) {
      keyBag = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
    }

    if (!keyBag?.key) {
      throw new BadRequestException('Chave privada não encontrada no arquivo .p12');
    }
    const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key as forge.pki.rsa.PrivateKey);

    // Extrair certificados
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = certBags[forge.pki.oids.certBag] ?? [];
    if (certs.length === 0) {
      throw new BadRequestException('Certificado não encontrado no arquivo .p12');
    }

    // Certificado do titular (primeiro) e cadeia
    const mainCert = certs[0].cert!;
    const certPem = forge.pki.certificateToPem(mainCert);
    const chainPem = certs.slice(1).map(b => forge.pki.certificateToPem(b.cert!));

    // Metadados
    const subject = this.forgeNameToStr(mainCert.subject.attributes);
    const issuer = this.forgeNameToStr(mainCert.issuer.attributes);
    const serialNumber = mainCert.serialNumber;
    const validFrom = mainCert.validity.notBefore;
    const validTo = mainCert.validity.notAfter;

    // Fingerprint SHA-256
    const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(mainCert)).getBytes(), 'binary');
    const fingerprint = this.cryptoService.sha256Hex(certDer);

    return { privateKeyPem, certPem, chainPem, subject, issuer, serialNumber, validFrom, validTo, fingerprint };
  }

  // ════════════════════════════════════════════════════════════
  // 2. CACHE DE CHAVES
  // ════════════════════════════════════════════════════════════

  async getKeyMaterial(certId: string): Promise<{ privateKeyPem: string; certPem: string }> {
    const cached = this.keyCache.get(certId);
    if (cached && cached.expiresAt > Date.now()) {
      return { privateKeyPem: cached.privateKeyPem, certPem: cached.certPem };
    }

    // Nota: O cast (this.prisma as any) é mantido para evitar erros se a tipagem do Prisma estiver sendo gerada
    const cert = await (this.prisma as any).certificate.findFirst({
      where: { id: certId, isActive: true },
      select: { encryptedKey: true, certificate: true, validTo: true },
    });

    if (!cert) throw new NotFoundException(`Certificado ${certId} não encontrado ou inativo`);

    if (new Date(cert.validTo) < new Date()) {
      throw new BadRequestException('Certificado expirado.');
    }

    const privateKeyPem = this.cryptoService.decrypt(cert.encryptedKey);

    this.keyCache.set(certId, {
      privateKeyPem,
      certPem: cert.certificate,
      expiresAt: Date.now() + KEY_CACHE_TTL_MS,
    });

    return { privateKeyPem, certPem: cert.certificate };
  }

  evictKey(certId: string): void {
    this.keyCache.delete(certId);
  }

  private purgeExpiredCache(): void {
    const now = Date.now();
    for (const [id, entry] of this.keyCache.entries()) {
      if (entry.expiresAt <= now) this.keyCache.delete(id);
    }
  }

  // ════════════════════════════════════════════════════════════
  // 3. ASSINATURA PDF (PAdES)
  // ════════════════════════════════════════════════════════════

  async signPdf(
    pdfBuffer: Buffer,
    certId:    string,
    options?: { reason?: string; location?: string; contactInfo?: string },
  ): Promise<Buffer> {
    const { privateKeyPem, certPem } = await this.getKeyMaterial(certId);

    try {
      // Importação dinâmica com tratamento de default export
      const signpdf = await import('node-signpdf');
      const { plainAddPlaceholder } = await import('node-signpdf/dist/helpers');

      const pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer,
        reason: options?.reason ?? 'Assinado digitalmente',
        contactInfo: options?.contactInfo ?? '',
        name: '',
        location: options?.location ?? 'Brasil',
      });

      const p12Buffer = this.pemToP12Buffer(privateKeyPem, certPem);
      
      // O node-signpdf costuma exportar o signer como default
      const signer = (signpdf as any).default || signpdf;
      return signer.sign(pdfWithPlaceholder, p12Buffer);

    } catch (err: any) {
      this.logger.error('Erro ao assinar PDF', err);
      throw new BadRequestException(`Falha na assinatura do PDF: ${err.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════
  // 4. ASSINATURA XML (XAdES-BES / NF-e)
  // ════════════════════════════════════════════════════════════

  async signXml(xmlString: string, certId: string, refId: string): Promise<string> {
    const { privateKeyPem, certPem } = await this.getKeyMaterial(certId);

    try {
      const { SignedXml } = await import('xml-crypto');

      const sig = new SignedXml({
        privateKey: privateKeyPem,
        signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      });

      sig.addReference({
        xpath: `//*[@Id='${refId}']`,
        transforms: [
          'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
          'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        ],
        digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      });

      const certClean = certPem
        .replace(/-----(BEGIN|END) CERTIFICATE-----/g, '')
        .replace(/\s/g, '');

      // CORREÇÃO: Cast para any para aceitar a atribuição do keyInfoProvider se a tipagem falhar
      (sig as any).keyInfoProvider = {
        getKeyInfo: () => `<X509Data><X509Certificate>${certClean}</X509Certificate></X509Data>`,
        getKey: () => Buffer.from(certPem),
      };

      sig.computeSignature(xmlString, { prefix: '' });
      return sig.getSignedXml();
    } catch (err: any) {
      this.logger.error('Erro ao assinar XML', err);
      throw new BadRequestException(`Falha na assinatura do XML: ${err.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════
  // 5. VALIDAÇÃO E HELPERS
  // ════════════════════════════════════════════════════════════

  validateCertPem(certPem: string): CertValidationResult {
    let cert: forge.pki.Certificate;
    try {
      cert = forge.pki.certificateFromPem(certPem);
    } catch {
      throw new BadRequestException('PEM de certificado inválido');
    }

    const now = new Date();
    const validFrom = cert.validity.notBefore;
    const validTo = cert.validity.notAfter;
    const expired = now > validTo;
    const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / 86_400_000);

    const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary');
    const fingerprint = this.cryptoService.sha256Hex(certDer);

    return {
      valid: !expired && now >= validFrom,
      expired,
      validFrom,
      validTo,
      subject: this.forgeNameToStr(cert.subject.attributes),
      issuer: this.forgeNameToStr(cert.issuer.attributes),
      serialNumber: cert.serialNumber,
      fingerprint,
      daysRemaining,
    };
  }

  private forgeNameToStr(attrs: forge.pki.CertificateField[]): string {
    const order = ['CN', 'O', 'OU', 'L', 'ST', 'C'];
    const map: Record<string, string> = {};
    for (const a of attrs) {
      if (a.shortName) map[a.shortName] = a.value as string;
    }
    return order
      .filter(k => map[k])
      .map(k => `${k}=${map[k]}`)
      .join(', ');
  }

  private pemToP12Buffer(privateKeyPem: string, certPem: string): Buffer {
    const key = forge.pki.privateKeyFromPem(privateKeyPem);
    const cert = forge.pki.certificateFromPem(certPem);
    // Criação do P12 para o node-signpdf
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], '', {
      algorithm: '3des',
      generateLocalKeyId: true,
    });
    return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
  }
}