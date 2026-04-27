// ── dto/create-documents.dto.ts ───────────────────────────────────

import { IsString, IsEnum, IsOptional, IsInt, IsBoolean, IsDateString, MinLength } from 'class-validator';

// ── Enums locais (espelham o schema Prisma) ───────────────────────
// Mantidos aqui para validação no DTO sem depender do @prisma/client
// diretamente nos decorators do class-validator.

export enum DocumentType {
  // Societário — S.A. (Lei 6.404/1976)
  ESTATUTO_SOCIAL = 'ESTATUTO_SOCIAL',
  ATA_AGO = 'ATA_AGO',
  ATA_AGE = 'ATA_AGE',
  ATA_DIRETORIA = 'ATA_DIRETORIA',
  ACORDO_ACIONISTAS = 'ACORDO_ACIONISTAS',
  CERTIFICADO_ACOES = 'CERTIFICADO_ACOES',
  LIVRO_REGISTRO_ACOES = 'LIVRO_REGISTRO_ACOES',
  LIVRO_TRANSFERENCIA_ACOES = 'LIVRO_TRANSFERENCIA_ACOES',
  LIVRO_ATAS_AGO = 'LIVRO_ATAS_AGO',
  LIVRO_ATAS_AGE = 'LIVRO_ATAS_AGE',
  // Contratual
  CONTRATO_SOCIAL = 'CONTRATO_SOCIAL',
  ADITIVO_CONTRATUAL = 'ADITIVO_CONTRATUAL',
  PROCURACAO = 'PROCURACAO',
  // Fiscal / Contábil / Trabalhista
  FISCAL = 'FISCAL',
  TRABALHISTA = 'TRABALHISTA',
  CONTABIL = 'CONTABIL',
  // Genérico
  OUTRO = 'OUTRO',
}

export enum DocumentStatus {
  RASCUNHO = 'RASCUNHO',
  EM_REVISAO = 'EM_REVISAO',
  AGUARDANDO_ASSINATURA = 'AGUARDANDO_ASSINATURA',
  ASSINADO = 'ASSINADO',
  REGISTRADO = 'REGISTRADO',   // autenticado na JUCESP / cartório
  ARQUIVADO = 'ARQUIVADO',
  CANCELADO = 'CANCELADO',
}

export enum DocumentVisibility {
  PUBLICO = 'PUBLICO',    // acessível sem autenticação (atos registrados, certidões)
  RESERVADO = 'RESERVADO',  // visível apenas para usuários da empresa ativa — DEFAULT
  RESTRITO = 'RESTRITO',   // apenas perfis autorizados (sócios, diretores)
  CONTROLADO = 'CONTROLADO', // somente admins/gestores (due diligence, laudos sigilosos)
}

// ── CreateDocumentDto ─────────────────────────────────────────────

export class CreateDocumentDto {
  // null = template global (sem empresa vinculada)
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  bookNumber?: number;

  @IsOptional()
  @IsBoolean()
  requiresJucesp?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  // Conteúdo textual (do upload .docx parseado ou digitado no editor)
  @IsOptional()
  @IsString()
  content?: string;

  // ── Adições ──────────────────────────────────────────────────

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;           // default: RASCUNHO

  @IsOptional()
  @IsEnum(DocumentVisibility)
  visibility?: DocumentVisibility;   // default: RESERVADO

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;              // default: false — true = template global sem empresa

  @IsOptional()
  @IsDateString()
  date?: string;                     // data do documento (aprovação, assinatura, etc.)
}

// ── UpdateDocumentDto ─────────────────────────────────────────────

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  changeNote?: string;               // nota sobre o que mudou nesta versão

  @IsOptional()
  @IsString()
  notes?: string;

  // ── Adições ──────────────────────────────────────────────────

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsEnum(DocumentVisibility)
  visibility?: DocumentVisibility;

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @IsOptional()
  @IsInt()
  bookNumber?: number;

  @IsOptional()
  @IsDateString()
  date?: string;
}

// ── AddSignerDto ──────────────────────────────────────────────────

export class AddSignerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  userId?: string;
}

// ── SignDocumentDto ───────────────────────────────────────────────

export class SignDocumentDto {
  @IsEnum(['GOVBR', 'CERT_A1', 'CERT_A3'])
  method: 'GOVBR' | 'CERT_A1' | 'CERT_A3';

  @IsOptional()
  @IsString()
  signerId?: string;

  // Gov.br
  @IsOptional()
  @IsString()
  govbrCode?: string;         // código retornado pelo OAuth gov.br

  // Certificado Digital
  @IsOptional()
  @IsString()
  signatureHash?: string;     // assinatura gerada pelo frontend (WebCrypto / Lacuna)

  @IsOptional()
  certificateData?: {
    subject: string;
    issuer: string;
    serialNumber: string;
    validFrom: string;
    validTo: string;
    cpf?: string;
    cnpj?: string;
  };
}