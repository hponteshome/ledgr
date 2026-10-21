-- prisma/migrations-manuais/20261021_proj_custodia_retencoes.sql
-- Custodia (21/10/2026): "Mantido em custodia (autorizado)". Autorizacao para a custodiante ficar com parte de um envio,
-- com valor, motivo, quem autorizou e quando. Sai de "a justificar" e de "vencido" e entra no saldo em poder autorizado.
-- Imutavel: so encerra com motivo (como as demais tabelas da custodia). Soma por envio: alocacoes vigentes (nao recusadas)
-- + retencoes vigentes <= valor do envio; o gatilho das alocacoes passa a descontar as retencoes.
-- Rollback: DROP TABLE proj_custodia_retencoes; e reverter a linha do gatilho proj_custodia_aloc_validar (texto antigo abaixo).
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS proj_custodia_retencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), custodia_id uuid NOT NULL REFERENCES proj_custodias(id),
  envio_id uuid NOT NULL REFERENCES proj_custodia_lancamentos(id), valor numeric(18,2) NOT NULL CHECK (valor > 0),
  motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, criado_por_id uuid, cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text);
CREATE INDEX IF NOT EXISTS proj_custodia_ret_envio_ix ON proj_custodia_retencoes (envio_id) WHERE cancelado_em IS NULL;

CREATE OR REPLACE FUNCTION proj_custodia_ret_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e record; usado numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.cancelado_em IS NOT NULL OR ROW(NEW.custodia_id, NEW.envio_id, NEW.valor, NEW.motivo, NEW.criado_em, NEW.criado_por_id)
       IS DISTINCT FROM ROW(OLD.custodia_id, OLD.envio_id, OLD.valor, OLD.motivo, OLD.criado_em, OLD.criado_por_id) THEN
      RAISE EXCEPTION 'Retencao e imutavel: so pode ser encerrada (com motivo)'; END IF;
    IF NEW.cancelado_em IS NOT NULL AND COALESCE(length(trim(NEW.motivo_cancelamento)), 0) < 10 THEN
      RAISE EXCEPTION 'Retencao: o encerramento exige motivo'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Retencao nasce vigente'; END IF;
  SELECT * INTO e FROM proj_custodia_lancamentos WHERE id = NEW.envio_id;
  IF e.id IS NULL OR e.tipo <> 'ENVIO' OR e.custodia_id <> NEW.custodia_id OR e.cancelado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Retencao: so vale para um envio vigente da mesma custodia'; END IF;
  SELECT COALESCE(sum(valor), 0) INTO usado FROM proj_custodia_alocacoes WHERE origem_id = NEW.envio_id AND cancelado_em IS NULL AND situacao <> 'RECUSADO';
  usado := usado + COALESCE((SELECT sum(valor) FROM proj_custodia_retencoes WHERE envio_id = NEW.envio_id AND cancelado_em IS NULL AND id <> NEW.id), 0);
  IF usado + NEW.valor > e.valor THEN
    RAISE EXCEPTION 'Retencao excede o saldo livre do envio (livre: %)', to_char(e.valor - usado, 'FM999999990.00'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_custodia_ret_validar_trg ON proj_custodia_retencoes;
CREATE TRIGGER proj_custodia_ret_validar_trg BEFORE INSERT OR UPDATE ON proj_custodia_retencoes FOR EACH ROW EXECUTE FUNCTION proj_custodia_ret_validar();

ALTER TABLE proj_custodia_retencoes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_custodia_retencoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_custodia_ret_master ON proj_custodia_retencoes;
CREATE POLICY proj_custodia_ret_master ON proj_custodia_retencoes FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
GRANT SELECT, INSERT, UPDATE ON proj_custodia_retencoes TO ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_custodia_retencoes FROM ledgr_api;

-- Gatilho das alocacoes: a origem passa a descontar as retencoes vigentes. Troca so a linha do limite da origem,
-- preservando o resto da funcao como esta no banco.
DO $$
DECLARE def text; velho text; novo text;
BEGIN
  def := pg_get_functiondef('proj_custodia_aloc_validar()'::regprocedure);
  IF position('proj_custodia_retencoes' IN def) > 0 THEN RAISE NOTICE 'gatilho das alocacoes ja desconta retencoes'; RETURN; END IF;
  velho := 'IF usado + NEW.valor > o.valor THEN RAISE EXCEPTION ''Alocacao excede o valor da origem''; END IF;';
  novo := 'usado := usado + COALESCE((SELECT sum(r.valor) FROM proj_custodia_retencoes r WHERE r.envio_id = NEW.origem_id AND r.cancelado_em IS NULL), 0);' || chr(10)
       || '  IF usado + NEW.valor > o.valor THEN RAISE EXCEPTION ''Alocacao excede o valor da origem (descontado o mantido em custodia autorizado)''; END IF;';
  IF (length(def) - length(replace(def, velho, ''))) / length(velho) <> 1 THEN
    RAISE EXCEPTION 'gatilho proj_custodia_aloc_validar diferente do esperado - nada alterado'; END IF;
  EXECUTE replace(def, velho, novo);
  RAISE NOTICE 'gatilho das alocacoes atualizado';
END $$;

SELECT 'retencoes: tabela ' || to_regclass('proj_custodia_retencoes')::text
       || ' | gatilho alocacoes desconta: ' || (position('proj_custodia_retencoes' IN pg_get_functiondef('proj_custodia_aloc_validar()'::regprocedure)) > 0)::text AS conferencia;
COMMIT;
