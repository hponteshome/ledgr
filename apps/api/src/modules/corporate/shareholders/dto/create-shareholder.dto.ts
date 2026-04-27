// apps/api/src/modules/corporate/shareholders/dto/create-shareholder.dto.ts
import {
  IsString, IsEnum, IsOptional, IsBoolean,
  IsNumber, IsDateString, IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ShareType { ORDINARIA = 'ORDINARIA', PREFERENCIAL = 'PREFERENCIAL', QUOTA = 'QUOTA' }
export enum ShareEntryType { SA = 'SA', LTDA = 'LTDA' }

export class CreateShareholderDto {
  @IsEnum(ShareEntryType)
  entryType: ShareEntryType;

  @IsString()
  holderName: string;

  @IsString()
  holderTaxId: string;

  @IsString()
  @IsOptional()
  holderType?: string; // 'PF' | 'PJ'

  @IsUUID()
  @IsOptional()
  personId?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEnum(ShareType)
  shareType: ShareType;

  @IsString()
  @IsOptional()
  series?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nominalValue: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  percentOwned: number;

  @IsDateString()
  @IsOptional()
  subscriptionDate?: string;

  @IsDateString()
  @IsOptional()
  integralizationDate?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  paidInAmount?: number;

  @IsBoolean()
  @IsOptional()
  isFullyPaid?: boolean;

  @IsBoolean()
  @IsOptional()
  hasEncumbrance?: boolean;

  @IsString()
  @IsOptional()
  encumbranceDesc?: string;

  @IsBoolean()
  @IsOptional()
  isPledged?: boolean;

  @IsNumber()
  @IsOptional()
  shareNumberFrom?: number;

  @IsNumber()
  @IsOptional()
  shareNumberTo?: number;

  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  bookId?: string;
}