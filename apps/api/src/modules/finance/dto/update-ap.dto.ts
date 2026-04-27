// src/modules/finance/dto/update-ap.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsDateString, IsNumber, IsString, Min } from 'class-validator';
import { CreateApDto } from './create-ap.dto';
import { ApEntryStatus } from '@prisma/client';

export class UpdateApDto extends PartialType(CreateApDto) {
  @IsOptional()
  @IsEnum(ApEntryStatus)
  status?: ApEntryStatus;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionCode?: string;
}