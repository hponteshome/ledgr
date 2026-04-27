// src/core/certificates/dto/certificates.dto.ts

import { IsString, IsOptional, IsArray, IsBoolean, IsEnum } from 'class-validator';

export enum CertType {
  A1   = 'A1',
  A3   = 'A3',
  GOVBR = 'GOVBR',
}

export enum CertUsage {
  SIGNING      = 'SIGNING',      // assinatura de documentos societários
  TRANSMISSION = 'TRANSMISSION', // transmissão ao fisco / RFB
}

// ── Importar certificado (.p12 / .pfx) ──────────────────────────
export class ImportCertificateDto {
  @IsString()
  alias: string; // nome descritivo: "e-CNPJ A1 - Receita"

  @IsEnum(CertType)
  type: CertType;

  @IsArray()
  @IsString({ each: true })
  usage: CertUsage[];

  @IsString()
  password: string; // senha do .p12 — usado apenas durante o import; nunca gravado

  // O arquivo .p12 chega como Buffer via multipart/form-data
  // Injetado pelo controller após FileInterceptor
}

// ── Atualizar metadados ──────────────────────────────────────────
export class UpdateCertificateDto {
  @IsOptional()
  @IsString()
  alias?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  usage?: CertUsage[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Resposta pública (nunca expõe encryptedKey) ──────────────────
export class CertificateResponseDto {
  id:           string;
  companyId:    string;
  certId?:       string;
  alias:        string;
  type:         string;
  usage:        string[];
  subject:      string;
  issuer:       string;
  serialNumber: string;
  validFrom:    Date;
  validTo:      Date;
  fingerprint:  string;
  isActive:     boolean;
  createdAt:    Date;
  // Campos calculados
  daysUntilExpiry: number;
  expiryStatus:    'valid' | 'warning' | 'danger' | 'expired';
}
