// apps/api/src/modules/locacao/dto/rental-contract.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import {
  IsString, IsOptional, IsUUID, IsNumber, IsInt, IsBoolean,
  IsEnum, IsDateString, MaxLength, Min, Max,
} from 'class-validator';
import {
  RentalDuePeriodicity,
  RentalGuaranteeType,
  RentalReadjustmentIndex,
  RentalIntermediaryType,
  RentalContractStatus,
  MaritalStatus,
} from '@prisma/client';

export class CreateRentalContractDto {
  @IsOptional() @IsString() @MaxLength(50)
  contractNumber?: string;

  @IsUUID('4')
  fixedAssetId!: string;

  @IsOptional() @IsUUID('4')
  tenantId?: string;

  @IsString() @MaxLength(200)
  tenantName!: string;

  @IsOptional() @IsString() @MaxLength(18)
  tenantTaxId?: string;
  @IsOptional() @IsString() @MaxLength(20)
  tenantRg?: string;
  @IsOptional() @IsString() @MaxLength(100)
  tenantProfession?: string;
  @IsOptional() @IsEnum(MaritalStatus)
  tenantMaritalStatus?: MaritalStatus;
  @IsOptional() @IsString()
  tenantNationality?: string;
  @IsOptional() @IsString()
  tenantStreet?: string;
  @IsOptional() @IsString() @MaxLength(20)
  tenantNumber?: string;
  @IsOptional() @IsString()
  tenantComplement?: string;
  @IsOptional() @IsString()
  tenantNeighborhood?: string;
  @IsOptional() @IsString()
  tenantCity?: string;
  @IsOptional() @IsString() @MaxLength(2)
  tenantState?: string;
  @IsOptional() @IsString() @MaxLength(9)
  tenantZipCode?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsNumber()
  rentAmount!: number;

  @IsOptional() @IsEnum(RentalDuePeriodicity)
  duePeriodicity?: RentalDuePeriodicity;

  @IsInt() @Min(1) @Max(31)
  dueDay!: number;

  @IsDateString()
  firstDueDate!: string;

  @IsOptional()
  explicitDueDates?: any;

  @IsOptional() @IsEnum(RentalGuaranteeType)
  guaranteeType?: RentalGuaranteeType;

  @IsOptional() @IsString()
  guaranteeDescription?: string;

  @IsOptional() @IsString() @MaxLength(60)
  policyNumber?: string;

  @IsOptional() @IsDateString()
  policyStartDate?: string;

  @IsOptional() @IsDateString()
  policyEndDate?: string;

  @IsOptional() @IsNumber()
  policyCoverage?: number;

  @IsOptional() @IsNumber()
  policyPremium?: number;

  @IsOptional() @IsInt()
  readjustmentPeriodMonths?: number;

  @IsOptional() @IsEnum(RentalReadjustmentIndex)
  readjustmentIndex?: RentalReadjustmentIndex;

  @IsOptional() @IsString() @MaxLength(50)
  readjustmentIndexOther?: string;

  @IsOptional() @IsString()
  penaltyDescription?: string;

  @IsOptional() @IsInt()
  penaltyReleaseDeadlineDays?: number;

  @IsOptional() @IsString()
  bonusDescription?: string;

  @IsOptional() @IsDateString()
  bonusStartDate?: string;

  @IsOptional() @IsDateString()
  bonusEndDate?: string;

  @IsOptional() @IsBoolean()
  hasIntermediary?: boolean;

  @IsOptional() @IsEnum(RentalIntermediaryType)
  intermediaryType?: RentalIntermediaryType;

  @IsOptional() @IsString() @MaxLength(200)
  intermediaryName?: string;

  @IsOptional() @IsString() @MaxLength(18)
  intermediaryTaxId?: string;

  @IsOptional() @IsString() @MaxLength(30)
  intermediaryCreci?: string;

  @IsOptional() @IsBoolean()
  intermediaryManagesCollection?: boolean;

  @IsOptional() @IsNumber()
  intermediaryAdminFeeAmount?: number;

  @IsOptional() @IsNumber()
  intermediaryCommissionPercent?: number;

  @IsOptional() @IsEnum(RentalContractStatus)
  status?: RentalContractStatus;

  @IsOptional() @IsUUID('4')
  documentId?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateRentalContractDto extends PartialType(CreateRentalContractDto) {}