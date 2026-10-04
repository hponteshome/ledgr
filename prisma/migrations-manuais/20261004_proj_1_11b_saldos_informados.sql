-- prisma/migrations-manuais/20261004_proj_1_11b_saldos_informados.sql
-- Fase 1.11 parte B - saldos informados (referencia externa para conferencia; nunca entram no calculo).
BEGIN;
CREATE TABLE IF NOT EXISTS proj_saldos_informados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  tipo varchar(30) NOT NULL CHECK (tipo IN ('CONTA_INDIVIDUAL', 'INTERCOMPANY_RECEBEDORA', 'INTERCOMPANY_BENEFICIARIA')),
  data_referencia date NOT NULL,
  valor numeric(18,2) NOT NULL,
  conta_contabil varchar(40),
  fonte text NOT NULL CHECK (length(trim(fonte)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);
CREATE INDEX IF NOT EXISTS proj_saldos_informados_operacao_idx ON proj_saldos_informados (operacao_id, tipo, data_referencia);
CREATE OR REPLACE FUNCTION proj_saldos_informados_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF OLD.cancelado_em IS NOT NULL OR NEW.cancelado_em IS NULL
     OR NEW.operacao_id IS DISTINCT FROM OLD.operacao_id OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.data_referencia IS DISTINCT FROM OLD.data_referencia OR NEW.valor IS DISTINCT FROM OLD.valor
     OR NEW.conta_contabil IS DISTINCT FROM OLD.conta_contabil OR NEW.fonte IS DISTINCT FROM OLD.fonte
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Saldo informado e imutavel: so pode ser encerrado, com motivo';
  END IF;
  IF NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10 THEN
    RAISE EXCEPTION 'Encerramento de saldo informado exige motivo (minimo 10 caracteres)';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_saldos_informados_validar_trg ON proj_saldos_informados;
CREATE TRIGGER proj_saldos_informados_validar_trg BEFORE INSERT OR UPDATE ON proj_saldos_informados FOR EACH ROW EXECUTE FUNCTION proj_saldos_informados_validar();
ALTER TABLE proj_saldos_informados ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_saldos_informados FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_saldos_informados_ler ON proj_saldos_informados;
DROP POLICY IF EXISTS proj_saldos_informados_inserir ON proj_saldos_informados;
DROP POLICY IF EXISTS proj_saldos_informados_encerrar ON proj_saldos_informados;
CREATE POLICY proj_saldos_informados_ler ON proj_saldos_informados FOR SELECT USING (EXISTS (SELECT 1 FROM proj_operacoes o WHERE o.id = operacao_id));
CREATE POLICY proj_saldos_informados_inserir ON proj_saldos_informados FOR INSERT WITH CHECK (proj_ctx_master());
CREATE POLICY proj_saldos_informados_encerrar ON proj_saldos_informados FOR UPDATE USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
REVOKE DELETE, TRUNCATE ON proj_saldos_informados FROM ledgr_api;
COMMIT;
SELECT count(*) AS saldos_informados FROM proj_saldos_informados;