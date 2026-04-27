// src/modules/finance/dto/batch-pay-ap.dto.ts
import { IsArray, IsUUID, IsOptional, IsNumber, IsDateString, Min, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class BatchPayItemDto {
  @IsUUID()
  id: string;

  @IsDateString()
  paidAt: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountApplied?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  receiptRef?: string;
}

export class BatchPayAPDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchPayItemDto)
  items: BatchPayItemDto[];
}