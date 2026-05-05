// ============================================================
// LEDGR — apps/api/src/modules/assets/dto/create-asset.dto.ts
// ============================================================
import {
  IsString, IsEnum, IsOptional, IsNumber, IsDateString,
  IsBoolean, IsUUID, Min, Max, MaxLength, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

// ── Enums (mirror schema) ─────────────────────────────────────

export enum AssetGroup {
  REAL_ESTATE          = 'REAL_ESTATE',
  MACHINERY_EQUIPMENT  = 'MACHINERY_EQUIPMENT',
  VEHICLE              = 'VEHICLE',
  FURNITURE_FIXTURE    = 'FURNITURE_FIXTURE',
  IT_EQUIPMENT         = 'IT_EQUIPMENT',
  INTANGIBLE           = 'INTANGIBLE',
  OTHER                = 'OTHER',
}

export enum AssetStatus {
  PENDING_ACTIVATION = 'PENDING_ACTIVATION',
  ACTIVE             = 'ACTIVE',
  UNDER_MAINTENANCE  = 'UNDER_MAINTENANCE',
  INACTIVE           = 'INACTIVE',
  DISPOSED           = 'DISPOSED',
  WRITTEN_OFF        = 'WRITTEN_OFF',
}

export enum DepreciationMethod {
  STRAIGHT_LINE        = 'STRAIGHT_LINE',
  SUM_OF_DIGITS        = 'SUM_OF_DIGITS',
  UNITS_OF_PRODUCTION  = 'UNITS_OF_PRODUCTION',
  ACCELERATED_2X       = 'ACCELERATED_2X',
}

export enum MaintenanceType {
  PREVENTIVE  = 'PREVENTIVE',
  CORRECTIVE  = 'CORRECTIVE',
  PREDICTIVE  = 'PREDICTIVE',
  OVERHAUL    = 'OVERHAUL',
  EMERGENCY   = 'EMERGENCY',
}

export enum MaintenanceStatus {
  SCHEDULED    = 'SCHEDULED',
  IN_PROGRESS  = 'IN_PROGRESS',
  COMPLETED    = 'COMPLETED',
  CANCELLED    = 'CANCELLED',
}

export enum ImprovementType {
  ACCESSORY                 = 'ACCESSORY',
  CAPITALIZABLE_RENOVATION  = 'CAPITALIZABLE_RENOVATION',
  EXPANSION                 = 'EXPANSION',
  RETROFIT                  = 'RETROFIT',
  RESTORATION               = 'RESTORATION',
}

export enum AppraisalType {
  ASSET_VALUATION       = 'ASSET_VALUATION',
  TECHNICAL_INSPECTION  = 'TECHNICAL_INSPECTION',
  PHYSICAL_DEPRECIATION = 'PHYSICAL_DEPRECIATION',
  TAX_CLASSIFICATION    = 'TAX_CLASSIFICATION',
  ENGINEERING_REPORT    = 'ENGINEERING_REPORT',
}

export enum RetrofitStatus {
  PLANNING    = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED   = 'COMPLETED',
  SUSPENDED   = 'SUSPENDED',
  CANCELLED   = 'CANCELLED',
}

export enum WriteOffReason {
  DISPOSAL    = 'DISPOSAL',
  SCRAPPING   = 'SCRAPPING',
  DONATION    = 'DONATION',
  CASUALTY    = 'CASUALTY',
  OTHER       = 'OTHER',
}

// ── Create Asset ──────────────────────────────────────────────

export class CreateAssetDto {
  // Identification
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  internalCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsEnum(AssetGroup)
  group: AssetGroup;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subgroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Valuation
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  acquisitionCost: number;

  @IsDateString()
  acquisitionDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  residualValue?: number;

  // Depreciation
  @IsOptional()
  @IsEnum(DepreciationMethod)
  depreciationMethod?: DepreciationMethod;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  usefulLifeMonths: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  annualRatePercent?: number;

  @IsDateString()
  depreciationStart: string;

  @IsOptional()
  @IsBoolean()
  nonDepreciable?: boolean;

  // Real Estate
  @IsOptional()
  @IsString()
  @MaxLength(50)
  iptuRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  registryNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  registryOffice?: string;
  @IsOptional()
  @IsString()
  realEstateNotes?: string;
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalArea?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  builtArea?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  assessedValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  landValuePercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  // Accounting links
  @IsOptional()
  @IsUUID()
  assetAccountId?: string;

  @IsOptional()
  @IsUUID()
  depreciationAccId?: string;

  @IsOptional()
  @IsUUID()
  accumDeprecAccId?: string;
}

export class UpdateAssetDto extends PartialType(CreateAssetDto) {}

// ── Filter ────────────────────────────────────────────────────

export class FilterAssetDto {
  @IsOptional()
  @IsEnum(AssetGroup)
  group?: AssetGroup;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}

// ── Write-Off ─────────────────────────────────────────────────

export class WriteOffAssetDto {
  @IsDateString()
  writeOffDate: string;

  @IsEnum(WriteOffReason)
  reason: WriteOffReason;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  disposalValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Maintenance ───────────────────────────────────────────────

export class CreateMaintenanceDto {
  @IsUUID()
  assetId: string;

  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  providerCnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactInfo?: string;

  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estimatedCost?: number;

  @IsOptional()
  @IsBoolean()
  capitalizable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  serviceOrderNo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto) {
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  actualCost?: number;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;
}

// ── Improvement ───────────────────────────────────────────────

export class CreateImprovementDto {
  @IsUUID()
  assetId: string;

  @IsEnum(ImprovementType)
  type: ImprovementType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  completionDate?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalCost: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  usefulLifeExtension?: number;

  @IsOptional()
  @IsString()
  technicalReport?: string;
}

// ── Retrofit ──────────────────────────────────────────────────

export class CreateRetrofitProjectDto {
  @IsUUID()
  assetId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  objective: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  responsible?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalBudget: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  usefulLifeImpact?: number;

  @IsOptional()
  phases?: CreateRetrofitPhaseDto[];
}

export class CreateRetrofitPhaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  sequence: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  phaseBudget: number;

  @IsDateString()
  plannedDate: string;
}

export class UpdateRetrofitPhaseDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  executedAmount?: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsDateString()
  completionDate?: string;
}

// ── Appraisal ─────────────────────────────────────────────────

export class CreateAppraisalDto {
  @IsUUID()
  assetId: string;

  @IsEnum(AppraisalType)
  type: AppraisalType;

  @IsDateString()
  appraisalDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  appraisalFirm: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  responsibleName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  creaRegistration?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  appraisedValue: number;

  @IsOptional()
  @IsString()
  methodology?: string;

  @IsOptional()
  @IsString()
  conclusions?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estimatedRemainingMonths?: number;
}
