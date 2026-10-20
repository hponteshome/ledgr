-- prisma/migrations-manuais/20261020_proj_demonstrativo_textos.sql
-- 20/10/2026 - Texto do credor / obrigacao de cada pagamento no demonstrativo do Termo VAL (Anexo I do Doc. 21).
-- Imutavel: novo texto encerra o anterior (com motivo); sem DELETE. Gravacao e leitura so Master (RLS). Reexecutavel.
BEGIN;
CREATE TABLE IF NOT EXISTS proj_demonstrativo_textos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aplicacao_id            uuid NULL REFERENCES proj_aplicacoes(id),
  custodia_lancamento_id  uuid NULL REFERENCES proj_custodia_lancamentos(id),
  texto                   text NOT NULL,
  criado_em               timestamp NOT NULL DEFAULT now(),
  criado_por_id           uuid NOT NULL,
  cancelado_em            timestamp NULL,
  cancelado_por_id        uuid NULL,
  motivo_cancelamento     text NULL,
  CONSTRAINT proj_demonstrativo_textos_alvo_ck CHECK ((aplicacao_id IS NULL) <> (custodia_lancamento_id IS NULL)),
  CONSTRAINT proj_demonstrativo_textos_texto_ck CHECK (length(trim(texto)) >= 3),
  CONSTRAINT proj_demonstrativo_textos_cancel_ck CHECK (cancelado_em IS NULL OR (cancelado_por_id IS NOT NULL AND coalesce(length(trim(motivo_cancelamento)), 0) >= 5))
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_demonstrativo_textos_vigente_uq ON proj_demonstrativo_textos (coalesce(aplicacao_id, custodia_lancamento_id)) WHERE cancelado_em IS NULL;
CREATE OR REPLACE FUNCTION proj_demonstrativo_textos_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Demonstrativo: texto nao pode ser excluido (e substituido por novo texto)'; END IF;
  IF OLD.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Demonstrativo: texto ja encerrado'; END IF;
  IF NEW.aplicacao_id IS DISTINCT FROM OLD.aplicacao_id OR NEW.custodia_lancamento_id IS DISTINCT FROM OLD.custodia_lancamento_id
     OR NEW.texto IS DISTINCT FROM OLD.texto OR NEW.criado_em IS DISTINCT FROM OLD.criado_em OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id
     OR NEW.cancelado_em IS NULL THEN
    RAISE EXCEPTION 'Demonstrativo: o texto e imutavel; so pode ser encerrado';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_demonstrativo_textos_imutavel_trg ON proj_demonstrativo_textos;
CREATE TRIGGER proj_demonstrativo_textos_imutavel_trg BEFORE UPDATE OR DELETE ON proj_demonstrativo_textos FOR EACH ROW EXECUTE FUNCTION proj_demonstrativo_textos_imutavel();
ALTER TABLE proj_demonstrativo_textos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proj_demonstrativo_textos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_demonstrativo_textos_master ON proj_demonstrativo_textos;
CREATE POLICY proj_demonstrativo_textos_master ON proj_demonstrativo_textos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ledgr_api') THEN
    GRANT SELECT, INSERT, UPDATE ON proj_demonstrativo_textos TO ledgr_api;
  END IF;
END $$;
COMMIT;
