-- prisma/migrations-manuais/20261008_proj_simulacoes_rm.sql
-- Simulador do spread RM (08/10/2026): cenarios salvos (parametros, fluxo anual e resumo). Imutavel; so encerra com motivo. So Master.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS proj_simulacoes_rm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), projeto_id uuid NOT NULL,
  nome varchar(120) NOT NULL CHECK (length(trim(nome)) >= 3),
  parametros jsonb NOT NULL, anual jsonb NOT NULL, resumo jsonb NOT NULL,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, criado_por_id uuid,
  encerrado_em timestamp(6), encerrado_por_id uuid, motivo_encerramento text);
CREATE INDEX IF NOT EXISTS proj_simulacoes_rm_projeto_ix ON proj_simulacoes_rm (projeto_id, criado_em DESC) WHERE encerrado_em IS NULL;
DO $$ BEGIN
  IF to_regclass('proj_projetos') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proj_simulacoes_rm_projeto_fk') THEN
    ALTER TABLE proj_simulacoes_rm ADD CONSTRAINT proj_simulacoes_rm_projeto_fk FOREIGN KEY (projeto_id) REFERENCES proj_projetos(id);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION proj_simulacao_rm_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.encerrado_em IS NOT NULL OR ROW(NEW.projeto_id, NEW.nome, NEW.parametros, NEW.anual, NEW.resumo, NEW.criado_em, NEW.criado_por_id)
     IS DISTINCT FROM ROW(OLD.projeto_id, OLD.nome, OLD.parametros, OLD.anual, OLD.resumo, OLD.criado_em, OLD.criado_por_id) THEN
    RAISE EXCEPTION 'Simulacao: o cenario e imutavel; so pode ser encerrado (com motivo)'; END IF;
  IF NEW.encerrado_em IS NOT NULL AND COALESCE(length(trim(NEW.motivo_encerramento)), 0) < 10 THEN
    RAISE EXCEPTION 'Simulacao: o encerramento exige motivo'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_simulacao_rm_imutavel_trg ON proj_simulacoes_rm;
CREATE TRIGGER proj_simulacao_rm_imutavel_trg BEFORE UPDATE ON proj_simulacoes_rm FOR EACH ROW EXECUTE FUNCTION proj_simulacao_rm_imutavel();
ALTER TABLE proj_simulacoes_rm ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_simulacoes_rm FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_simulacoes_rm_master ON proj_simulacoes_rm;
CREATE POLICY proj_simulacoes_rm_master ON proj_simulacoes_rm FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
GRANT SELECT, INSERT, UPDATE ON proj_simulacoes_rm TO ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_simulacoes_rm FROM ledgr_api;
COMMIT;