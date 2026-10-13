-- prisma/migrations-manuais/20261013_proj_fluxo_lancamentos.sql
-- Gerar lancamentos do Fluxo (13/10/2026): controle dos lancamentos gravados no Contabil pelo projeto. Uma chave ativa por vez;
-- a linha so aceita o registro do estorno (uma vez, com motivo). So Master (RLS). Sem DELETE.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS proj_fluxo_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES proj_projetos(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  chave varchar(60) NOT NULL,
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id),
  valor numeric(18,2) NOT NULL CHECK (valor > 0),
  data date NOT NULL,
  descricao text NOT NULL,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid NULL,
  estornado_em timestamp(6) NULL,
  estorno_journal_entry_id uuid NULL REFERENCES journal_entries(id),
  estornado_por_id uuid NULL,
  motivo_estorno text NULL);
CREATE UNIQUE INDEX IF NOT EXISTS proj_fluxo_lancamentos_chave_ativa ON proj_fluxo_lancamentos (projeto_id, chave) WHERE estornado_em IS NULL;
CREATE OR REPLACE FUNCTION proj_fluxo_lancamentos_upd() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.projeto_id, NEW.company_id, NEW.chave, NEW.journal_entry_id, NEW.valor, NEW.data, NEW.descricao, NEW.criado_em, NEW.criado_por_id)
     IS DISTINCT FROM ROW(OLD.projeto_id, OLD.company_id, OLD.chave, OLD.journal_entry_id, OLD.valor, OLD.data, OLD.descricao, OLD.criado_em, OLD.criado_por_id) THEN
    RAISE EXCEPTION 'Lancamento do Fluxo: os dados gravados nao mudam; so o estorno pode ser registrado'; END IF;
  IF OLD.estornado_em IS NOT NULL THEN RAISE EXCEPTION 'Lancamento do Fluxo: estorno ja registrado'; END IF;
  IF NEW.estornado_em IS NULL OR NEW.estorno_journal_entry_id IS NULL OR COALESCE(length(trim(NEW.motivo_estorno)), 0) < 10 THEN
    RAISE EXCEPTION 'Lancamento do Fluxo: o estorno exige o lancamento de estorno e o motivo'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_fluxo_lancamentos_upd_trg ON proj_fluxo_lancamentos;
CREATE TRIGGER proj_fluxo_lancamentos_upd_trg BEFORE UPDATE ON proj_fluxo_lancamentos FOR EACH ROW EXECUTE FUNCTION proj_fluxo_lancamentos_upd();
ALTER TABLE proj_fluxo_lancamentos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_fluxo_lancamentos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_fluxo_lancamentos_master ON proj_fluxo_lancamentos;
CREATE POLICY proj_fluxo_lancamentos_master ON proj_fluxo_lancamentos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
GRANT SELECT, INSERT, UPDATE ON proj_fluxo_lancamentos TO ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_fluxo_lancamentos FROM ledgr_api;
COMMIT;