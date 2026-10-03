-- prisma/migrations-manuais/20261003_proj_1_1_schema.sql
-- Fase 1.1 - dominio Projetos (Recife Ocean): projeto, operacoes, papeis, contrapartes, participacoes.
-- Dependencia unidirecional: FKs de proj_* para o nucleo existem so no banco; o nucleo nao referencia proj_*.
-- Sem exclusao fisica: cancelamento com motivo.
BEGIN;
CREATE TABLE IF NOT EXISTS proj_projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(40) NOT NULL UNIQUE,
  nome varchar(200) NOT NULL,
  descricao text,
  status varchar(20) NOT NULL DEFAULT 'ATIVO',
  data_inicio date,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);
CREATE TABLE IF NOT EXISTS proj_projeto_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES proj_projetos(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text,
  UNIQUE (projeto_id, company_id)
);
CREATE TABLE IF NOT EXISTS proj_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES proj_projetos(id),
  codigo varchar(40) NOT NULL,
  nome varchar(200) NOT NULL,
  tipo varchar(40) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ATIVA',
  data_base date,
  valor_controle numeric(18,2),
  moeda varchar(3) NOT NULL DEFAULT 'BRL',
  descricao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text,
  UNIQUE (projeto_id, codigo)
);
CREATE TABLE IF NOT EXISTS proj_papeis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(40) NOT NULL UNIQUE,
  nome varchar(120) NOT NULL,
  descricao text,
  aplica_a varchar(20) NOT NULL DEFAULT 'AMBOS' CHECK (aplica_a IN ('EMPRESA', 'CONTRAPARTE', 'AMBOS')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid
);
CREATE TABLE IF NOT EXISTS proj_contrapartes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa varchar(2) CHECK (tipo_pessoa IN ('PF', 'PJ')),
  documento varchar(14),
  nome varchar(200) NOT NULL,
  email varchar(200),
  telefone varchar(20),
  person_id uuid,
  observacoes text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_contrapartes_documento_ativo_uq ON proj_contrapartes (documento) WHERE documento IS NOT NULL AND cancelado_em IS NULL;
CREATE TABLE IF NOT EXISTS proj_participacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  papel_id uuid NOT NULL REFERENCES proj_papeis(id),
  company_id uuid REFERENCES companies(id),
  contraparte_id uuid REFERENCES proj_contrapartes(id),
  vigencia_inicio date,
  vigencia_fim date,
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text,
  CONSTRAINT proj_participacoes_alvo_ck CHECK ((company_id IS NOT NULL) <> (contraparte_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS proj_participacoes_operacao_idx ON proj_participacoes (operacao_id);
CREATE UNIQUE INDEX IF NOT EXISTS proj_participacoes_empresa_ativa_uq ON proj_participacoes (operacao_id, papel_id, company_id) WHERE company_id IS NOT NULL AND cancelado_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS proj_participacoes_contraparte_ativa_uq ON proj_participacoes (operacao_id, papel_id, contraparte_id) WHERE contraparte_id IS NOT NULL AND cancelado_em IS NULL;
COMMIT;