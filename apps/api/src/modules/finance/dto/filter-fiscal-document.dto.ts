// ============================================================
// LEDGR — src/modules/finance/dto/filter-fiscal-document.dto.ts
// ============================================================

import { IsOptional, IsEnum, IsString, Matches } from 'class-validator';
import { FiscalDocumentType, IntegrationStatus } from '@prisma/client';

export class FilterFiscalDocumentDto {
  @IsOptional()
  @IsEnum(FiscalDocumentType)
  documentType?: FiscalDocumentType;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'competenceMonth deve estar no formato YYYY-MM (ex: 2024-01)',
  })
  competenceMonth?: string;

  @IsOptional()
  @IsEnum(IntegrationStatus)
  integrationStatus?: IntegrationStatus;

  @IsOptional()
  @IsString()
  search?: string; // busca por issuerName, documentNumber

  @IsOptional()
  @IsString()
  dueDateFrom?: string;

  @IsOptional()
  @IsString()
  dueDateTo?: string;
}