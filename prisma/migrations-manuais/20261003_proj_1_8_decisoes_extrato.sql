-- prisma/migrations-manuais/20261003_proj_1_8_decisoes_extrato.sql
-- Fase 1.8 - decisoes sobre entradas do extrato que NAO pertencem a operacao (reversiveis, historico imutavel).
BEGIN;
CREATE TABLE IF NOT EXISTS proj_extrato_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  bank_transaction_id uuid NOT NULL REFERENCES bank_transactions(id),
  decisao varchar(20) NOT NULL CHECK (decisao IN ('NAO_PERTENCE')),
  motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_extrato_decisoes_vigente_uq ON proj_extrato_decisoes (operacao_id, bank_transaction_id) WHERE cancelado_em IS NULL;
CREATE OR REPLACE FUNCTION proj_extrato_decisoes_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF OLD.cancelado_em IS NOT NULL OR NEW.cancelado_em IS NULL
     OR NEW.operacao_id IS DISTINCT FROM OLD.operacao_id OR NEW.bank_transaction_id IS DISTINCT FROM OLD.bank_transaction_id
     OR NEW.decisao IS DISTINCT FROM OLD.decisao OR NEW.motivo IS DISTINCT FROM OLD.motivo
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Decisao sobre extrato e imutavel: so pode ser encerrada, com motivo';
  END IF;
  IF NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10 THEN
    RAISE EXCEPTION 'Encerramento de decisao exige motivo (minimo 10 caracteres)';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_extrato_decisoes_validar_trg ON proj_extrato_decisoes;
CREATE TRIGGER proj_extrato_decisoes_validar_trg BEFORE INSERT OR UPDATE ON proj_extrato_decisoes FOR EACH ROW EXECUTE FUNCTION proj_extrato_decisoes_validar();
ALTER TABLE proj_extrato_decisoes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_extrato_decisoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_extrato_decisoes_ler ON proj_extrato_decisoes;
DROP POLICY IF EXISTS proj_extrato_decisoes_inserir ON proj_extrato_decisoes;
DROP POLICY IF EXISTS proj_extrato_decisoes_encerrar ON proj_extrato_decisoes;
CREATE POLICY proj_extrato_decisoes_ler ON proj_extrato_decisoes FOR SELECT USING (EXISTS (SELECT 1 FROM proj_operacoes o WHERE o.id = operacao_id));
CREATE POLICY proj_extrato_decisoes_inserir ON proj_extrato_decisoes FOR INSERT WITH CHECK (proj_ctx_master());
CREATE POLICY proj_extrato_decisoes_encerrar ON proj_extrato_decisoes FOR UPDATE USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
REVOKE DELETE, TRUNCATE ON proj_extrato_decisoes FROM ledgr_api;
COMMIT;
SELECT tablename, policyname FROM pg_policies WHERE tablename = 'proj_extrato_decisoes' ORDER BY 2;