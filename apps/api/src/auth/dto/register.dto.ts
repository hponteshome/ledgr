import { IsEmail, IsNumber, IsString, MinLength, Matches, IsEnum, IsOptional } from 'class-validator';

// Enum atualizado para o padrão do banco (Capitalizado ou conforme seu schema)
export enum DocumentType {
  CPF = 'CPF',
  PASSPORT = 'PASSPORT',
  RNE = 'RNE'
}

export class RegisterDto {
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$|^[A-Z0-9]{6,12}$/i, {
    message: 'Invalid document (CPF, Passport or RNE)'
  })
  document: string; // Antes: documento

  @IsEnum(DocumentType)
  documentType: DocumentType; // Antes: tipoDocumento

  @IsEmail({}, { message: 'Invalid email address' })
  email: string;
  
  @IsNumber({}, { message: 'Invalid level address' })
  level: number;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string; // Antes: senha

  @IsString()
  @MinLength(3, { message: 'Full name must be at least 3 characters long' })
  fullName: string; // Antes: nome

  @IsOptional()
  @IsString()
  phoneNumber?: string; // Antes: telefone
}