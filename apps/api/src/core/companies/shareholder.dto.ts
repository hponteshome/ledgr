import { IsString, IsOptional, IsBoolean, IsDateString, IsDecimal, IsIn } from 'class-validator';

export class CreateShareholderDto {
  @IsIn(['PF', 'PJ'])
  shareholderType: 'PF' | 'PJ';

  @IsOptional() @IsString()
  personId?: string;

  @IsOptional() @IsString()
  shareholderCompanyId?: string;

  @IsOptional() @IsString()
  qualificacao?: string;

  @IsOptional() @IsDateString()
  dataEntrada?: string;

  @IsOptional() @IsDateString()
  dataRetirada?: string;

  @IsOptional()
  participacaoPercent?: number;

  @IsOptional() @IsBoolean()
  assinaEcd?: boolean;

  @IsOptional() @IsBoolean()
  assinaEcf?: boolean;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateShareholderDto {
  @IsOptional() @IsString()
  qualificacao?: string;

  @IsOptional() @IsDateString()
  dataEntrada?: string;

  @IsOptional() @IsDateString()
  dataRetirada?: string;

  @IsOptional()
  participacaoPercent?: number;

  @IsOptional() @IsBoolean()
  assinaEcd?: boolean;

  @IsOptional() @IsBoolean()
  assinaEcf?: boolean;

  @IsOptional() @IsString()
  notes?: string;
}
