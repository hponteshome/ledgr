-- prisma/migrations-manuais/20261019_proj_documento_vinculos.sql
-- 19/10/2026 - Vinculo de documento do projeto com aplicacao ou lancamento da custodia (comprovantes de pagamento).
-- Mesmo padrao das tabelas do projeto: sem DELETE, sem UPDATE exceto cancelamento (motivo obrigatorio).
-- RLS replicada de proj_documentos (operacao vem do documento vinculado). Reexecutavel.
BEGIN;
CREATE TABLE IF NOT EXISTS proj_documento_vinculos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id            uuid NOT NULL REFERENCES proj_documentos(id),
  aplicacao_id            uuid NULL REFERENCES proj_aplicacoes(id),
  custodia_lancamento_id  uuid NULL REFERENCES proj_custodia_lancamentos(id),
  motivo                  text NOT NULL,
  criado_em               timestamp NOT NULL DEFAULT now(),
  criado_por_id           uuid NOT NULL,
  cancelado_em            timestamp NULL,
  cancelado_por_id        uuid NULL,
  motivo_cancelamento     text NULL,
  CONSTRAINT proj_documento_vinculos_um_alvo CHECK ((aplicacao_id IS NULL) <> (custodia_lancamento_id IS NULL)),
  CONSTRAINT proj_documento_vinculos_cancelamento CHECK (cancelado_em IS NULL OR (cancelado_por_id IS NOT NULL AND coalesce(length(trim(motivo_cancelamento)), 0) >= 5))
);
CREATE INDEX IF NOT EXISTS proj_documento_vinculos_doc_idx ON proj_documento_vinculos (documento_id);
CREATE INDEX IF NOT EXISTS proj_documento_vinculos_apl_idx ON proj_documento_vinculos (aplicacao_id) WHERE cancelado_em IS NULL;
CREATE INDEX IF NOT EXISTS proj_documento_vinculos_cus_idx ON proj_documento_vinculos (custodia_lancamento_id) WHERE cancelado_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS proj_documento_vinculos_vigente_uq ON proj_documento_vinculos (documento_id, coalesce(aplicacao_id, custodia_lancamento_id)) WHERE cancelado_em IS NULL;

CREATE OR REPLACE FUNCTION proj_documento_vinculos_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'proj_documento_vinculos: exclusao nao permitida (cancele com motivo)';
  END IF;
  IF OLD.cancelado_em IS NOT NULL THEN
    RAISE EXCEPTION 'proj_documento_vinculos: vinculo ja cancelado';
  END IF;
  IF NEW.documento_id IS DISTINCT FROM OLD.documento_id OR NEW.aplicacao_id IS DISTINCT FROM OLD.aplicacao_id
     OR NEW.custodia_lancamento_id IS DISTINCT FROM OLD.custodia_lancamento_id OR NEW.motivo IS DISTINCT FROM OLD.motivo
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id
     OR NEW.cancelado_em IS NULL THEN
    RAISE EXCEPTION 'proj_documento_vinculos: so e permitido cancelar (com motivo)';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_documento_vinculos_imutavel_trg ON proj_documento_vinculos;
CREATE TRIGGER proj_documento_vinculos_imutavel_trg BEFORE UPDATE OR DELETE ON proj_documento_vinculos
  FOR EACH ROW EXECUTE FUNCTION proj_documento_vinculos_imutavel();
COMMIT;

-- RLS: mesmas politicas de proj_documentos (leitura se a operacao do documento for visivel; gravacao so Master),
-- trocando operacao_id pela operacao do documento vinculado.
BEGIN;
DO $$
DECLARE p record; q text; c text; sub text := '(SELECT dd.operacao_id FROM proj_documentos dd WHERE dd.id = proj_documento_vinculos.documento_id)';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'proj_documentos') THEN
    RAISE EXCEPTION 'proj_documentos nao tem politicas de RLS - nada a replicar';
  END IF;
  FOR p IN SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'proj_documentos' LOOP
    -- troca operacao_id sem qualificador ou qualificado por proj_documentos (outros aliases ficam intactos)
    q := CASE WHEN p.qual IS NULL THEN NULL ELSE regexp_replace(p.qual, '(^|[^.[:alnum:]_])(proj_documentos\.)?operacao_id\M', '\1' || sub, 'g') END;
    c := CASE WHEN p.with_check IS NULL THEN NULL ELSE regexp_replace(p.with_check, '(^|[^.[:alnum:]_])(proj_documentos\.)?operacao_id\M', '\1' || sub, 'g') END;
    EXECUTE format('DROP POLICY IF EXISTS %I ON proj_documento_vinculos', replace(p.policyname, 'proj_documentos', 'proj_documento_vinculos'));
    EXECUTE 'CREATE POLICY ' || quote_ident(replace(p.policyname, 'proj_documentos', 'proj_documento_vinculos')) || ' ON proj_documento_vinculos AS ' || p.permissive
         || ' FOR ' || p.cmd || ' TO ' || array_to_string(p.roles, ', ')
         || coalesce(' USING (' || q || ')', '') || coalesce(' WITH CHECK (' || c || ')', '');
  END LOOP;
END $$;
ALTER TABLE proj_documento_vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proj_documento_vinculos FORCE ROW LEVEL SECURITY;
COMMIT;
