// ============================================================
// LEDGR — apps/api/src/modules/finance/dto/filter-ap.dto.ts
// SUBSTITUIR o arquivo existente — adiciona dueDateFrom/dueDateTo/aging
// ============================================================
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApEntryStatus, APOrigin } from '@prisma/client';

export class FilterAPDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ApEntryStatus)
  status?: ApEntryStatus;

  @IsOptional()
  @IsEnum(APOrigin)
  origin?: APOrigin;

  @IsOptional()
  @IsString()
  competenceMonth?: string;

  @IsOptional()
  @IsString()
  categoryTag?: string;

  // Campos adicionados para filtros de data e aging
  @IsOptional()
  @IsString()
  dueDateFrom?: string;

  @IsOptional()
  @IsString()
  dueDateTo?: string;

  @IsOptional()
  @IsString()
  aging?: 'overdue' | 'today' | 'week' | 'month' | 'future';
}