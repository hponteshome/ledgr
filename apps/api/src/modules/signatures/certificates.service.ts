// apps/api/src/modules/signatures/certificates.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as forge from 'node-forge';
import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.CERT_ENCRYPTION_KEY || 'ledgr-cert-key-32-bytes-padded!!';
const IV_LENGTH = 16;

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  // ── Criptografia AES-256-GCM ───────────────────────────────────────────────
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decrypt(text: string): string {
    const [ivHex, tagHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  // ── Upload de certificado A1 (.pfx) ───────────────────────────────────────
  async uploadCertificate(companyId: string, pfxBuffer: Buffer, password: string, alias: string) {
    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'));
      p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der), password);
    } catch {
      throw new BadRequestException('Certificado inválido ou senha incorreta');
    }

    // Extrair chave privada e certificado
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBags = bags[forge.pki.oids.certBag] ?? [];
    if (!certBags.length) throw new BadRequestException('Nenhum certificado encontrado no .pfx');

    const certObj = certBags[0].cert!;
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [])[0];
    if (!keyBag?.key) throw new BadRequestException('Chave privada não encontrada');

    const subject = certObj.subject.getField('CN')?.value ?? 'Desconhecido';
    const issuer = certObj.issuer.getField('CN')?.value ?? 'Desconhecido';
    const serialNumber = certObj.serialNumber;
    const validFrom = certObj.validity.notBefore;
    const validTo = certObj.validity.notAfter;

    // Fingerprint SHA-256
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes();
    const fingerprint = crypto.createHash('sha256')
      .update(Buffer.from(certDer, 'binary'))
      .digest('hex');

    // Serializar e criptografar chave privada
    const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
    const encryptedKey = this.encrypt(privateKeyPem);
    const certificatePem = forge.pki.certificateToPem(certObj);

    return this.prisma.certificate.create({
      data: {
        companyId,
        alias,
        type: 'A1',
        usage: ['SIGNING'],
        encryptedKey,
        certificate: certificatePem,
        subject,
        issuer,
        serialNumber,
        validFrom,
        validTo,
        fingerprint,
        isActive: true,
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.certificate.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true, alias: true, type: true, subject: true, issuer: true,
        serialNumber: true, validFrom: true, validTo: true, fingerprint: true,
        isActive: true, createdAt: true,
      },
      orderBy: { validTo: 'desc' },
    });
  }

  async revoke(companyId: string, id: string) {
    const cert = await this.prisma.certificate.findFirst({ where: { id, companyId } });
    if (!cert) throw new NotFoundException('Certificado não encontrado');
    return this.prisma.certificate.update({ where: { id }, data: { isActive: false } });
  }

  // ── Retorna chave privada descriptografada para uso interno ────────────────
  async getPrivateKey(companyId: string, certId: string): Promise<{ privateKeyPem: string; certificatePem: string }> {
    const cert = await this.prisma.certificate.findFirst({
      where: { id: certId, companyId, isActive: true },
    });
    if (!cert) throw new NotFoundException('Certificado não encontrado ou inativo');
    if (new Date() > cert.validTo) throw new BadRequestException('Certificado expirado');
    return {
      privateKeyPem: this.decrypt(cert.encryptedKey),
      certificatePem: cert.certificate,
    };
  }
}
