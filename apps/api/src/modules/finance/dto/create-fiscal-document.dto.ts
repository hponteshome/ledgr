// ============================================================
// LEDGR — src/modules/finance/dto/create-fiscal-document.dto.ts
// ============================================================

import {
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsUUID,
  IsDecimal,
  Min,
  MaxLength,
  Matches,
  IsNotEmpty
} from 'class-validator';
import { FiscalDocumentType, IntegrationStatus } from '@prisma/client';

export class CreateFiscalDocumentDto {
  @IsEnum(FiscalDocumentType)
  documentType: FiscalDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(44)
  accessKey?: string;

  // Emitente/Fornecedor
  @IsString()
  @Matches(/^\d{14}$/, { message: 'CNPJ deve ter 14 dígitos' })
  issuerCnpj: string;

  @IsString()
  @IsNotEmpty()
  issuerName: string;

  @IsOptional()
  @IsString()
  issuerStateReg?: string;

  // Datas
  @IsDateString()
  issueDate: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'competenceMonth deve estar no formato YYYY-MM' })
  competenceMonth: string;

  // Valores
  @IsNumber()
  @Min(0)
  grossAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  netAmount: number;

  // Retenções
  @IsOptional()
  @IsNumber()
  @Min(0)
  irAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pisAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cofinsAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  csllAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  issAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inssAmount?: number;

  // Classificação contábil
  @IsOptional()
  @IsUUID()
  expenseAccountId?: string;

  @IsOptional()
  @IsString()
  costCenter?: string;

  // Metadados
  @IsOptional()
  @IsEnum(IntegrationStatus)
  integrationStatus?: IntegrationStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}