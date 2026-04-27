// src/modules/finance/dto/create-ap.dto.ts

import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsUUID,
  Min,
  Max,
  IsEnum,
  IsNotEmpty
} from 'class-validator';
import { ApEntryStatus, PaymentMethod, APOrigin } from '@prisma/client';

export class CreateApDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(APOrigin)
  origin?: APOrigin;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  barCode?: string;

  @IsOptional()
  @IsString()
  supplierCnpj?: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

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

  @IsDateString()
  issueDate: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  competenceMonth: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  installmentNumber?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalInstallments?: number;

  @IsOptional()
  @IsUUID()
  expenseAccountId?: string;

  @IsOptional()
  @IsString()
  costCenter?: string;

  @IsOptional()
  @IsString()
  categoryTag?: string;

  @IsOptional()
  @IsUUID()
  fiscalDocumentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}