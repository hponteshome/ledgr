// src/auth/dto/update-user.dto.ts
import { IsEmail, IsString, IsOptional, IsBoolean, IsEnum, MinLength, Matches, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export enum DocumentType {
  CPF = 'CPF',
  PASSPORT = 'PASSPORT',
  RNE = 'RNE'
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (!value) return value;
    const clean = String(value).replace(/\D/g, '');
    return clean.length === 11 ? clean : value;
  })
  @Matches(/^\d{11}$|^[A-Z0-9]{6,12}$/i, {
    message: 'Invalid document (CPF must have 11 digits, or Passport/RNE)'
  })
  document?: string;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  // ALTERADO: de 'name' para 'fullName' para coincidir com o schema.prisma
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Full name must be at least 3 characters long' })
  fullName?: string; 

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ? String(value).replace(/\D/g, '') : value)
  phone1?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID() // Garante que seja um UUID válido
  profileId?: string;

  // ADICIONADO: Para suportar o novo vínculo que criamos
  @IsOptional()
  @IsUUID()
  personId?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'inactive' | 'blocked' | 'deleted';
}