// apps/api/src/modules/accounting/fixed-income/dto/fixed-income.dto.ts

import {
  IsString, IsEnum, IsNumber, IsDateString, IsOptional,
  IsBoolean, IsArray, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum FixedIncomeType {
  CDB = 'CDB', LCI = 'LCI', LCA = 'LCA', CRI = 'CRI',
  CRA = 'CRA', DEBENTURE = 'DEBENTURE',
  TESOURO_PREFIXADO = 'TESOURO_PREFIXADO',
  TESOURO_SELIC = 'TESOURO_SELIC', TESOURO_IPCA = 'TESOURO_IPCA',
  OUTRO = 'OUTRO',
}

export enum FixedIncomeIndexer {
  CDI = 'CDI', SELIC = 'SELIC', IPCA = 'IPCA',
  IGPM = 'IGPM', PREFIXADO = 'PREFIXADO',
}

// ── Criar/atualizar investimento ──────────────────────────────────────────────

export class CreateFixedIncomeDto {
  @IsString() description: string;
  @IsEnum(FixedIncomeType) type: FixedIncomeType;
  @IsString() issuerName: string;
  @IsOptional() @IsString() issuerCnpj?: string;
  @IsOptional() @IsString() externalCode?: string;
  @IsEnum(FixedIncomeIndexer) indexer: FixedIncomeIndexer;
  @IsNumber() @Min(0) @Max(200) indexerRate: number; // 96 = 96% do CDI
  @IsOptional() @IsNumber() fixedRate?: number;
  @IsNumber() @Min(0) capitalInitial: number;
  @IsDateString() applicationDate: string;
  @IsDateString() maturityDate: string;
  @IsOptional() @IsBoolean() irrfExempt?: boolean;
  @IsOptional() @IsString() assetAccountId?: string;
  @IsOptional() @IsString() revenueAccountId?: string;
  @IsOptional() @IsString() irrfAccountId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateFixedIncomeDto extends CreateFixedIncomeDto {}

// ── Atualização mensal de saldo ───────────────────────────────────────────────

export class MonthlyUpdateDto {
  @IsString() competence: string; // "2024-01"
  @IsNumber() @Min(0) indexerRate: number; // Taxa mensal acumulada (ex: 0.009666902)
  @IsOptional() @IsNumber() businessDays?: number;
  @IsOptional() @IsNumber() calendarDays?: number;
  @IsOptional() @IsBoolean() generateJournalEntry?: boolean;
  @IsOptional() @IsString() journalDescription?: string;
}

export class BulkMonthlyUpdateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonthlyUpdateDto)
  updates: MonthlyUpdateDto[];
}

// ── Resgate ───────────────────────────────────────────────────────────────────

export class RedemptionDto {
  @IsDateString() redemptionDate: string;
  @IsOptional() @IsNumber() @Min(0) redemptionAmount?: number;
  @IsOptional() @IsNumber() @Min(0) redemptionPrincipal?: number;
  @IsOptional() @IsNumber() @Min(0) redemptionYield?: number;
  @IsOptional() @IsNumber() @Min(0) irrfAmount?: number;
  @IsOptional() @IsNumber() @Min(0) netAmount?: number;
  @IsOptional() @IsBoolean() isTotal?: boolean;
  @IsOptional() @IsBoolean() generateJournalEntry?: boolean;
  @IsOptional() @IsString() notes?: string;
}

// ── Projeção ──────────────────────────────────────────────────────────────────

export class ProjectionParamsDto {
  @IsOptional() @IsNumber() projectedMonthlyRate?: number; // CDI mensal médio projetado
  @IsOptional() @IsDateString() projectionUntil?: string;  // até quando projetar (default: vencimento)
  @IsOptional() @IsArray() partialRedemptions?: PartialRedemptionProjectionDto[];
}

export class PartialRedemptionProjectionDto {
  @IsDateString() date: string;
  @IsNumber() @Min(0) amount: number; // 0 = total
}