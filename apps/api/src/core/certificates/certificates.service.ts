// src/core/certificates/certificates.service.ts

import {
  Injectable, Logger, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService }   from '../../prisma/prisma.service';
import { CryptoService }   from './crypto.service';
import { SigningService }  from './signing.service';
import {
  ImportCertificateDto, UpdateCertificateDto, CertificateResponseDto,
} from './certificates.dto';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly crypto:   CryptoService,
    private readonly signing:  SigningService,
  ) {}

  // ── Formata resposta pública (sem encryptedKey) ──────────────
  private toResponse(cert: any): CertificateResponseDto {
    const now           = Date.now();
    const daysUntilExpiry = Math.floor((new Date(cert.validTo).getTime() - now) / 86_400_000);
    let expiryStatus: CertificateResponseDto['expiryStatus'] = 'valid';
    if (daysUntilExpiry < 0)  expiryStatus = 'expired';
    else if (daysUntilExpiry < 30) expiryStatus = 'danger';
    else if (daysUntilExpiry < 60) expiryStatus = 'warning';

    return {
      id:             cert.id,
      companyId:      cert.companyId,
      alias:          cert.alias,
      type:           cert.type,
      usage:          cert.usage,
      subject:        cert.subject,
      issuer:         cert.issuer,
      serialNumber:   cert.serialNumber,
      validFrom:      cert.validFrom,
      validTo:        cert.validTo,
      fingerprint:    cert.fingerprint,
      isActive:       cert.isActive,
      createdAt:      cert.createdAt,
      daysUntilExpiry,
      expiryStatus,
    };
  }

  // ── SELECT sem encryptedKey (uso padrão) ─────────────────────
  private safeSelect = {
    id: true, companyId: true, alias: true, type: true, usage: true,
    subject: true, issuer: true, serialNumber: true,
    validFrom: true, validTo: true, fingerprint: true,
    isActive: true, createdAt: true, updatedAt: true,
    // encryptedKey: NUNCA incluído por padrão
  };

  // ════════════════════════════════════════════════════════════
  // IMPORTAR CERTIFICADO
  // ════════════════════════════════════════════════════════════

  async import(
    companyId:  string,
    dto:        ImportCertificateDto,
    pfxBuffer:  Buffer,
  ): Promise<CertificateResponseDto> {

    // 1. Parse do .p12
    const parsed = this.signing.parseP12(pfxBuffer, dto.password);

    // 2. Verificar expiração
    if (new Date(parsed.validTo) < new Date()) {
      throw new BadRequestException(
        `Certificado já expirado em ${parsed.validTo.toLocaleDateString('pt-BR')}`,
      );
    }

    // 3. Verificar duplicidade por fingerprint
    const existing = await (this.prisma as any).certificate.findFirst({
      where: { companyId, fingerprint: parsed.fingerprint },
      select: { id: true, alias: true },
    });
    if (existing) {
      throw new ConflictException(
        `Este certificado já está cadastrado como "${existing.alias}" (id: ${existing.id})`,
      );
    }

    // 4. Criptografar chave privada
    const encryptedKey = this.crypto.encrypt(parsed.privateKeyPem);

    // 5. Gravar no banco
    const cert = await (this.prisma as any).certificate.create({
      data: {
        companyId,
        alias:        dto.alias,
        type:         dto.type,
        usage:        dto.usage,
        encryptedKey,
        certificate:  parsed.certPem,
        subject:      parsed.subject,
        issuer:       parsed.issuer,
        serialNumber: parsed.serialNumber,
        validFrom:    parsed.validFrom,
        validTo:      parsed.validTo,
        fingerprint:  parsed.fingerprint,
      },
      select: this.safeSelect,
    });

    this.logger.log(
      `Certificado importado: ${cert.alias} | ${cert.subject} | válido até ${parsed.validTo.toLocaleDateString('pt-BR')}`,
    );

    return this.toResponse(cert);
  }

  // ════════════════════════════════════════════════════════════
  // LISTAR CERTIFICADOS DA EMPRESA
  // ════════════════════════════════════════════════════════════

  async findAll(companyId: string, onlyActive = false): Promise<CertificateResponseDto[]> {
    const where: any = { companyId };
    if (onlyActive) where.isActive = true;

    const certs = await (this.prisma as any).certificate.findMany({
      where,
      select:  this.safeSelect,
      orderBy: { validTo: 'asc' },
    });

    return certs.map((c: any) => this.toResponse(c));
  }

  // ════════════════════════════════════════════════════════════
  // BUSCAR UM CERTIFICADO
  // ════════════════════════════════════════════════════════════

  async findOne(id: string, companyId: string): Promise<CertificateResponseDto> {
    const cert = await (this.prisma as any).certificate.findFirst({
      where:  { id, companyId },
      select: this.safeSelect,
    });
    if (!cert) throw new NotFoundException(`Certificado ${id} não encontrado`);
    return this.toResponse(cert);
  }

  // ════════════════════════════════════════════════════════════
  // ATUALIZAR METADADOS
  // ════════════════════════════════════════════════════════════

  async update(
    id:        string,
    companyId: string,
    dto:       UpdateCertificateDto,
  ): Promise<CertificateResponseDto> {
    await this.findOne(id, companyId); // garante existência

    const cert = await (this.prisma as any).certificate.update({
      where:  { id },
      data:   {
        ...(dto.alias    !== undefined && { alias:    dto.alias }),
        ...(dto.usage    !== undefined && { usage:    dto.usage }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      },
      select: this.safeSelect,
    });

    // Se desativado, evictar do cache
    if (dto.isActive === false) {
      this.signing.evictKey(id);
    }

    return this.toResponse(cert);
  }

  // ════════════════════════════════════════════════════════════
  // DELETAR (soft: isActive = false)
  // ════════════════════════════════════════════════════════════

  async remove(id: string, companyId: string): Promise<void> {
    await this.findOne(id, companyId);
    await (this.prisma as any).certificate.update({
      where: { id },
      data:  { isActive: false, updatedAt: new Date() },
    });
    this.signing.evictKey(id);
    this.logger.warn(`Certificado ${id} desativado por solicitação do usuário`);
  }

  // ════════════════════════════════════════════════════════════
  // PREVIEW — parse sem salvar (usado no frontend antes do import)
  // ════════════════════════════════════════════════════════════

  async preview(pfxBuffer: Buffer, password: string) {
    const parsed = this.signing.parseP12(pfxBuffer, password);
    const daysRemaining = Math.floor(
      (parsed.validTo.getTime() - Date.now()) / 86_400_000,
    );
    return {
      subject:       parsed.subject,
      issuer:        parsed.issuer,
      serialNumber:  parsed.serialNumber,
      validFrom:     parsed.validFrom,
      validTo:       parsed.validTo,
      fingerprint:   parsed.fingerprint,
      daysRemaining,
      expired:       daysRemaining < 0,
    };
  }

  // ════════════════════════════════════════════════════════════
  // CRON — Alertas de expiração (todo dia às 07:00)
  // ════════════════════════════════════════════════════════════

  @Cron(process.env.CERT_EXPIRY_CRON ?? '0 7 * * *')
  async checkExpirations(): Promise<void> {
    const warnDays = parseInt(process.env.CERT_EXPIRY_WARN_DAYS ?? '30', 10);
    const threshold = new Date(Date.now() + warnDays * 86_400_000);

    const expiring = await (this.prisma as any).certificate.findMany({
      where: {
        isActive: true,
        validTo: { lte: threshold },
      },
      select: { id: true, alias: true, companyId: true, validTo: true, subject: true },
    });

    if (expiring.length === 0) return;

    this.logger.warn(
      `[CERT EXPIRY] ${expiring.length} certificado(s) vencendo nos próximos ${warnDays} dias:`,
    );

    for (const cert of expiring) {
      const days = Math.floor((new Date(cert.validTo).getTime() - Date.now()) / 86_400_000);
      this.logger.warn(
        `  • [${cert.companyId}] ${cert.alias} | ${cert.subject} | vence em ${days} dias (${new Date(cert.validTo).toLocaleDateString('pt-BR')})`,
      );
      // TODO fase 2: disparar notificação in-app + e-mail
    }
  }
}
