// apps/api/src/core/contratos/contratos.dto.ts
import {
  IsString, IsOptional, IsEnum, IsInt, IsBoolean,
  IsArray, ValidateNested, Min, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

// ── Enums ─────────────────────────────────────────────────────
export enum ContratoDocType {
  CONTRATO_SOCIAL    = 'CONTRATO_SOCIAL',
  ADITIVO_CONTRATUAL = 'ADITIVO_CONTRATUAL',
}

export enum ContratoStatus {
  RASCUNHO              = 'RASCUNHO',
  EM_REVISAO            = 'EM_REVISAO',
  AGUARDANDO_ASSINATURA = 'AGUARDANDO_ASSINATURA',
  ASSINADO              = 'ASSINADO',
  REGISTRADO            = 'REGISTRADO',
  ARQUIVADO             = 'ARQUIVADO',
  CANCELADO             = 'CANCELADO',
}

// ── Sub-DTOs ──────────────────────────────────────────────────

/** Representa um sócio conforme salvo no campo `notes` (JSON) */
export class SocioDto {
  @IsOptional() @IsString() personId?: string;  // FK para Person, se localizado
  @IsString()               cpf: string;
  @IsString()               nome: string;
  @IsOptional() @IsString() qualificacao?: string;
  @IsOptional() @IsString() participacao?: string;
  @IsOptional() @IsString() cargo?: string;
}

// ── DTO principal ─────────────────────────────────────────────

export class CreateContratoDto {
  /** UUID da empresa dona do documento */
  @IsString()
  companyId: string;

  @IsEnum(ContratoDocType)
  type: ContratoDocType;

  /** Título do documento, ex: "Contrato Social — Arena Adm Ltda" */
  @IsString()
  title: string;

  /** Texto completo gerado pelo frontend (formato RenderDocument) */
  @IsOptional() @IsString()
  content?: string;

  @IsOptional() @IsEnum(ContratoStatus)
  status?: ContratoStatus;

  /** Data de lavratura/assinatura */
  @IsOptional() @IsDateString()
  date?: string;

  /** NIRE, nº do livro etc. */
  @IsOptional() @IsString()
  bookNumber?: string;

  /** styleId do DocumentStylePicker, guardado em `description` */
  @IsOptional() @IsString()
  styleId?: string;

  /** Nota de alteração (versão) */
  @IsOptional() @IsString()
  changeNote?: string;

  /**
   * JSON serializado com os campos extras:
   * cidade, numerarSecoes, objetoSocial, capitalSocial, prazo,
   * sede, administracao, socios[], clausulasAlteradas, motivoAlteracao
   */
  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateContratoDto extends PartialType(CreateContratoDto) {}

// ── Query params do findAll ────────────────────────────────────
export class ContratoFilters {
  @IsOptional() @IsString()               companyId?: string;
  @IsOptional() @IsEnum(ContratoDocType)  type?: ContratoDocType;
  @IsOptional() @IsEnum(ContratoStatus)   status?: ContratoStatus;
  @IsOptional() @IsString()               search?: string;
}
