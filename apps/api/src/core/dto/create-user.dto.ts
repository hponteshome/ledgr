// core/dto/create-user.dto\\
import { 
  IsEmail, 
  IsNumber,
  IsString, 
  IsOptional, 
  IsBoolean, 
  IsEnum, 
  MinLength, 
  Matches, 
  IsNotEmpty 
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum DocumentType {
  CPF = 'CPF',
  PASSPORT = 'PASSPORT',
  RNE = 'RNE'
}

export class CreateUserDto {
  @IsNotEmpty({ message: 'Document is required' })
  @IsString()
  @Transform(({ value }) => value?.replace(/\D/g, '')) // Limpa primeiro se for CPF/numérico
  @Matches(/^\d{11}$|^[A-Z0-9]{6,12}$/i, {
    message: 'Invalid document (CPF must have 11 digits, or Passport/RNE)'
  })
  document: string;

  @IsNotEmpty({ message: 'Document type is required' })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsNotEmpty({ message: 'level is required' })
  @IsNumber({}, { message: 'Invalid Nível' })
  level: number;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsNotEmpty({ message: 'Fullname is required' })
  @IsString()
  @MinLength(3, { message: 'Fullname must be at least 3 characters long' })
  fullName: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.replace(/\D/g, '')) // Mantém apenas números no telefone
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsNotEmpty({ message: 'Profile ID is required' })
  @IsString()
  profileId: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'inactive' | 'blocked' | 'deleted' = 'active';
}