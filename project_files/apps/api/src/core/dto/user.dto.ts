/**
 * Data Transfer Object for User information.
 * Replaces 'UsuarioDto' following international naming standards.
 */
export class UserDto {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  phone?: string;
  document: string;
  documentType: string;
  birthDate?: Date;
  isActive: boolean;
  status: string;
  emailConfirmed: boolean;
  documentConfirmed: boolean;
  twoFactorActive: boolean;
  lastAccess?: Date;
  blockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;

  profile?: {
    id: string;
    name: string;
    permissions?: any;
  };

  constructor(user: any) {
    this.id                = user.id;
    this.name              = user.name ?? user.nome;
    this.nickname          = user.nickname ?? user.nick ?? null;
    this.email             = user.email;
    this.phone             = user.phone ?? user.telefone ?? null;
    this.document          = user.document ?? user.documento;
    this.documentType      = user.documentType ?? user.tipo_documento;
    this.birthDate         = user.birthDate ?? user.data_nascimento ?? null;
    this.isActive          = user.isActive ?? user.esta_ativo;
    this.status            = user.status;
    this.emailConfirmed    = user.emailConfirmed ?? user.email_confirmado;
    this.documentConfirmed = user.documentConfirmed ?? user.documento_confirmado;
    this.twoFactorActive   = user.twoFactorActive ?? user.dois_fatores_ativo;
    this.lastAccess        = user.lastAccess ?? user.ultimo_acesso ?? null;
    this.blockedUntil      = user.blockedUntil ?? user.bloqueado_ate ?? null;
    this.createdAt         = user.createdAt ?? user.criado_em;
    this.updatedAt         = user.updatedAt ?? user.atualizado_em;

    // Sensitive fields NEVER exposed:
    // passwordHash, twoFactorSecret, refreshToken, deletedAt

    this.profile = user.profile || user.perfil
      ? {
          id:          user.profile?.id          ?? user.perfil?.id,
          name:        user.profile?.name        ?? user.perfil?.nome,
          permissions: user.profile?.permissions ?? user.perfil?.permissions ?? [],
        }
      : null;
  }
}