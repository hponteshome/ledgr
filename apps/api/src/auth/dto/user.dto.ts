import { Exclude, Expose, Transform } from 'class-transformer';

export class UserDto {
  @Expose()
  id: string;

  @Expose()
  @Transform(({ value }) => value ? String(value).replace(/\D/g, '') : value)
  document: string; // Antes: documento (Agora garantido apenas números)

  @Expose()
  documentType: string; // Antes: tipoDocumento

  @Expose()
  email: string;

  @Expose()
  fullName: string; // Antes: nome

  @Expose()
  isEmailConfirmed: boolean; // Antes: emailConfirmado

  @Expose()
  isTwoFactorActive: boolean; // Antes: doisFatoresAtivo

  @Expose()
  status: string;

  @Expose()
  level: number;

  @Expose()
  isActive: boolean;

  @Expose()
  @Transform(({ value }) => value ? String(value).replace(/\D/g, '') : value)
  phoneNumber: string; // Agora garantido apenas números

  // Campos Excluídos (Nunca enviados para o Frontend)
  @Exclude()
  passwordHash: string;

  @Exclude()
  twoFactorSecret: string;

  @Exclude()
  refreshToken: string;

  @Exclude()
  failedAttempts: number;

  @Exclude()
  blockedUntil: Date;

  @Exclude()
  deletedAt: Date;

  constructor(partial: Partial<UserDto>) {
    Object.assign(this, partial);
  }
}