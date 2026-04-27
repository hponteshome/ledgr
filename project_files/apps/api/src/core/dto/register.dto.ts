import { IsEmail, IsString, MinLength, Matches, IsEnum, IsOptional } from 'class-validator';

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
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$|^[A-Z0-9]{6,12}$/i, {
    message: 'Invalid document (CPF, Passport, or RNE)'
  })
  document: string;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

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
  phone?: string;
}