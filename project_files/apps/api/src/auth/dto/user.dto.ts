import { Exclude, Expose, Type } from 'class-transformer';

export class UserDto {
  @Expose()
  id: string;

  @Expose()
  document: string; // Antes: documento

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
  isActive: boolean;

  @Expose()
  phoneNumber: string;

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