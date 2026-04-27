// ============================================================
// LEDGR — src/modules/finance/dto/update-fiscal-document.dto.ts
// ============================================================

import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { IntegrationStatus } from '@prisma/client';
import { CreateFiscalDocumentDto } from './create-fiscal-document.dto';

export class UpdateFiscalDocumentDto extends PartialType(CreateFiscalDocumentDto) {
  @IsOptional()
  @IsEnum(IntegrationStatus)
  integrationStatus?: IntegrationStatus;

  @IsOptional()
  @IsBoolean()
  isIntegrated?: boolean;
}