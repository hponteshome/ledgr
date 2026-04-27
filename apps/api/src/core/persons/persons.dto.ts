// apps/api/src/core/persons/persons.dto.ts
import {
  IsString, IsOptional, IsEmail, IsEnum, IsDateString,
  IsBoolean, IsArray, ValidateNested, Length, Matches, IsJSON
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export enum MaritalStatus {
  SOLTEIRO        = 'SOLTEIRO',
  CASADO          = 'CASADO',
  UNIAO_ESTAVEL   = 'UNIAO_ESTAVEL',
  SEPARADO        = 'SEPARADO',
  DIVORCIADO      = 'DIVORCIADO',
  VIUVO           = 'VIUVO',
}

export enum MatrimonialRegime {
  COMUNHAO_PARCIAL            = 'COMUNHAO_PARCIAL',
  COMUNHAO_UNIVERSAL          = 'COMUNHAO_UNIVERSAL',
  SEPARACAO_TOTAL             = 'SEPARACAO_TOTAL',
  SEPARACAO_OBRIGATORIA       = 'SEPARACAO_OBRIGATORIA',
  PARTICIPACAO_FINAL_AQUESTOS = 'PARTICIPACAO_FINAL_AQUESTOS',
}

export class OtherRegistrationDto {
  @IsString() conselho: string;
  @IsString() numero: string;
  @IsString() @Length(2, 2) estado: string;
}

export class CreatePersonDto {
  // ── Identificação ──────────────────────────────────────────
  @IsString()
  @Transform(({ value }) => value?.replace(/\D/g, '')) // Limpa antes de validar e salvar
  @Matches(/^\d{11}$/, { message: 'O documento deve conter exatamente 11 dígitos numéricos (CPF)' })
  document: string;

  // Removido o campo 'cpf' redundante para evitar conflito com o mapeamento 'document' do Prisma

  @IsString()
  fullName: string;

  @IsOptional() @IsString() nickname?: string;

  // ── Filiação ───────────────────────────────────────────────
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsString() fatherName?: string;

  // ── Dados pessoais ─────────────────────────────────────────
  @IsOptional() @IsDateString()       birthDate?: string;
  @IsOptional() @IsString()           birthCity?: string;
  @IsOptional() @IsString() @Length(2,2) birthState?: string;
  @IsOptional() @IsString()           birthCountry?: string;
  @IsOptional() @IsString()           nationality?: string;

  @IsOptional() @IsEnum(MaritalStatus)     maritalStatus?: MaritalStatus;
  @IsOptional() @IsEnum(MatrimonialRegime) matrimonialRegime?: MatrimonialRegime;
  @IsOptional() @IsString()                spouseName?: string;
  
  @IsOptional() 
  @IsString()
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  spouseCpf?: string;

  // ── Documentos ─────────────────────────────────────────────
  @IsOptional() @IsString()    rgNumber?: string;
  @IsOptional() @IsString()    rgIssuer?: string;
  @IsOptional() @IsDateString() rgIssueDate?: string;
  @IsOptional() @IsString()    cnh?: string;
  @IsOptional() @IsString()    passport?: string;
  @IsOptional() @IsString()    tituloEleitor?: string;

  // ── Contato ────────────────────────────────────────────────
  @IsOptional() @IsEmail()  email?: string;
  
  @IsOptional() 
  @IsString()
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  phone1?: string;

  @IsOptional() 
  @IsString()
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  phone2?: string;

  // ── Endereço ───────────────────────────────────────────────
  @IsOptional() @IsString()               street?: string;
  @IsOptional() @IsString()               number?: string;
  @IsOptional() @IsString()               complement?: string;
  @IsOptional() @IsString()               neighborhood?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  @Length(8,8, { message: 'O CEP deve conter exatamente 8 dígitos' })
  zipCode?: string;
  
  @IsOptional() @IsString()               city?: string;
  @IsOptional() @IsString() @Length(2,2)  state?: string;
  @IsOptional() @IsString()               country?: string;

  // ── Registros profissionais ────────────────────────────────
  @IsOptional() @IsString()               oabNumber?: string;
  @IsOptional() @IsString() @Length(2,2)  oabState?: string;

  @IsOptional() @IsString()               crcNumber?: string;
  @IsOptional() @IsString() @Length(2,2)  crcState?: string;
  @IsOptional() @IsString()               crcType?: string;

  @IsOptional() @IsString()               creaNumber?: string;
  @IsOptional() @IsString() @Length(2,2)  creaState?: string;

  @IsOptional() @IsString()               coreconNumber?: string;
  @IsOptional() @IsString() @Length(2,2)  coreconState?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OtherRegistrationDto)
  otherRegistrations?: OtherRegistrationDto[];

  // ── Dados bancários ────────────────────────────────────────
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankAgency?: string;
  @IsOptional() @IsString() bankAccount?: string;

  // ── Metadados ──────────────────────────────────────────────
  @IsOptional() @IsString()  notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdatePersonDto extends PartialType(CreatePersonDto) {
  @IsOptional()
  @IsJSON()
  dependents?: any;
}

// ── Vínculos ──────────────────────────────────────────────────
export class CreatePersonCompanyDto {
  @IsString()               personId: string;
  @IsString()               companyId: string;
  @IsString()               role: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString()     notes?: string;
}

export class UpdatePersonCompanyDto extends PartialType(CreatePersonCompanyDto) {}