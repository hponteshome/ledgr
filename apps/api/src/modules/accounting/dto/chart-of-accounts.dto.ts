// apps/api/src/modules/accounting/dto/chart-of-accounts.dto.ts

import { 
  IsString, IsOptional, IsBoolean, IsNumber, IsEnum, 
  IsUUID, Min, Max, ValidateNested, IsArray, IsDateString 
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountType, AccountNature } from '@prisma/client';

// ── Filtros para listagem ───────────────────────────────────────

export class AccountFilterDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsBoolean()
  onlyAnalytic?: boolean;

  @IsOptional()
  @IsBoolean()
  onlySynthetic?: boolean;

  @IsOptional()
  @IsEnum(AccountType, { each: true })
  types?: AccountType[];

  @IsOptional()
  @IsEnum(AccountNature, { each: true })
  natures?: AccountNature[];

  @IsOptional()
  @IsBoolean()
  showInactive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

// ── Criação de conta ────────────────────────────────────────────

export class CreateAccountDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @IsEnum(AccountNature)
  nature?: AccountNature;

  @IsOptional()
  @IsBoolean()
  isAnalytic?: boolean = false;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsString()
  spedCode?: string;

  @IsOptional()
  @IsString()
  ifrsCode?: string;

  @IsOptional()
  @IsString()
  usgaapCode?: string;

  @IsOptional()
  @IsString()
  eSocialCode?: string;
}

// ── Atualização de conta ────────────────────────────────────────

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isAnalytic?: boolean;

  @IsOptional()
  @IsString()
  spedCode?: string;

  @IsOptional()
  @IsString()
  ifrsCode?: string;

  @IsOptional()
  @IsString()
  usgaapCode?: string;

  @IsOptional()
  @IsString()
  eSocialCode?: string;
}

// ── Mover conta na hierarquia ───────────────────────────────────

export class AccountMoveDto {
  @IsOptional()
  @IsUUID()
  newParentId?: string;

  @IsOptional()
  @IsString()
  newParentCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  newPosition?: number;
}

// ── Importação em lote ──────────────────────────────────────────

export class ImportAccountItemDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @IsEnum(AccountNature)
  nature?: AccountNature;

  @IsOptional()
  @IsBoolean()
  isAnalytic?: boolean;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsString()
  spedCode?: string;
}

export class ImportAccountsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportAccountItemDto)
  accounts: ImportAccountItemDto[];

  @IsOptional()
  @IsString()
  strategy?: 'upsert' | 'skip' | 'overwrite' = 'upsert';
}

// ── Operações em lote ───────────────────────────────────────────

export class BulkOperationDto {
  @IsArray()
  @IsUUID('all', { each: true })
  accountIds: string[];

  @IsEnum(['activate', 'deactivate', 'delete', 'export'])
  operation: 'activate' | 'deactivate' | 'delete' | 'export';

  @IsOptional()
  @IsBoolean()
  permanent?: boolean;

  @IsOptional()
  @IsString()
  targetParentId?: string;
}