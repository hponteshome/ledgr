// src/auth/dto/update-user.dto.ts
import { IsEmail, IsString, IsOptional, IsBoolean, IsEnum, MinLength, Matches } from 'class-validator';

export enum DocumentType {
  CPF = 'CPF',
  PASSPORT = 'PASSPORT',
  RNE = 'RNE'
}

export class UpdatePersonDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$|^[A-Z0-9]{6,12}$/i, {
    message: 'Invalid document (CPF, Passport, or RNE)'
  })
  document?: string;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  name?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  profileId?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'inactive' | 'blocked' | 'deleted';
}