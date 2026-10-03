-- prisma/migrations-manuais/20261003_proj_1_2a_concessoes.sql
-- Fase 1.2a - perfis do projeto e concessoes de acesso (usuario x escopo x perfil x nivel).
BEGIN;
CREATE TABLE IF NOT EXISTS proj_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(40) NOT NULL UNIQUE,
  nome varchar(120) NOT NULL,
  descricao text,
  acoes text[] NOT NULL DEFAULT '{}',
  nivel_padrao varchar(20) NOT NULL DEFAULT 'OPERACAO' CHECK (nivel_padrao IN ('OPERACAO', 'EMPRESA_PROJETO', 'EMPRESA_COMPLETA')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid
);
CREATE TABLE IF NOT EXISTS proj_concessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  projeto_id uuid NOT NULL REFERENCES proj_projetos(id),
  operacao_id uuid REFERENCES proj_operacoes(id),
  perfil_id uuid NOT NULL REFERENCES proj_perfis(id),
  nivel varchar(20) NOT NULL CHECK (nivel IN ('OPERACAO', 'EMPRESA_PROJETO', 'EMPRESA_COMPLETA')),
  valido_de timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valido_ate timestamp(6),
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);
CREATE INDEX IF NOT EXISTS proj_concessoes_user_idx ON proj_concessoes (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS proj_concessoes_escopo_ativo_uq ON proj_concessoes (user_id, projeto_id, COALESCE(operacao_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE cancelado_em IS NULL;
COMMIT;