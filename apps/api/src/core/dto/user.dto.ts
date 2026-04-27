/** // src/auth/dto/user.dto.ts
 * Data Transfer Object for User information.
 * Replaces 'UsuarioDto' following international naming standards.
 */


export class UserDto {
  id: string;
  fullName: string;
  nickname?: string;
  email: string;
  phone1?: string;
  document: string;
  documentType: string;
  personId?: string;
  birthDate?: Date;
  isActive: boolean;
  status: string;
  level: number;
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
    this.id = user.id;
    this.fullName = user.fullName ?? user.full_name ?? user.name ?? user.nome;
    this.nickname = user.nickname ?? user.nick ?? null;
    this.email = user.email;
    this.personId = user.personId ?? user.person_id ?? null;

    // Padronização para números puros
    const rawPhone = user.phone1 ?? user.phone_1 ?? user.telefone;
    this.phone1 = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;

    const rawDocument = user.document ?? user.documento;
    this.document = rawDocument ? String(rawDocument).replace(/\D/g, '') : null;

    this.documentType = user.documentType ?? user.tipo_documento;
    this.birthDate = user.birthDate ?? user.data_nascimento ?? null;
    this.isActive = user.isActive ?? user.esta_ativo;
    this.status = user.status;
    this.level = user.level;
    this.emailConfirmed = user.emailConfirmed ?? user.email_confirmado;
    this.documentConfirmed = user.documentConfirmed ?? user.documento_confirmado;
    this.twoFactorActive = user.twoFactorActive ?? user.dois_fatores_ativo;
    this.lastAccess = user.lastAccess ?? user.ultimo_acesso ?? null;
    this.blockedUntil = user.blockedUntil ?? user.bloqueado_ate ?? null;
    this.createdAt = user.createdAt ?? user.criado_em;
    this.updatedAt = user.updatedAt ?? user.atualizado_em;

    // Mapping profile relation
    const profileSource = user.profile || user.perfil;
    this.profile = profileSource
      ? {
          id: profileSource.id,
          name: profileSource.name ?? profileSource.nome,
          permissions: profileSource.permissions ?? [],
        }
      : null;
  }
}