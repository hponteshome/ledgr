//core/dto/register.dto.ts

import { IsEmail, IsString, MinLength, Matches, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export enum DocumentType {
  CPF = 'CPF',
  PASSPORT = 'PASSPORT',
  RNE = 'RNE'
}

/**
 * Data Transfer Object for User Registration.
 * Replaces 'RegistroDto' following international naming standards.
 */
export class RegisterDto {
  @IsString()
  // Limpa o documento antes da validação. 
  // Se for CPF, remove pontos/traços. Se for Passaporte alfanumérico, mantém letras.
  @Transform(({ value, obj }) => 
    obj.documentType === DocumentType.CPF ? value?.replace(/\D/g, '') : value
  )
  @Matches(/^\d{11}$|^[A-Z0-9]{6,12}$/i, {
    message: 'Invalid document (CPF must have 11 digits, or Passport/RNE)'
  })
  document: string;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsNumber({}, { message: 'Invalid level' })
  level: number;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsString()
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  name: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.replace(/\D/g, '')) // Normaliza o telefone para números puros
  phone?: string;
}