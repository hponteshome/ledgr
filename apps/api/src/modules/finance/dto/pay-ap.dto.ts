// src/modules/finance/dto/pay-ap.dto.ts

import { IsOptional, IsDateString, IsNumber, IsString, Min } from 'class-validator';

export class PayAPDto {
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
  @IsNumber()
  @Min(0)
  interestApplied?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fineApplied?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  receiptRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}