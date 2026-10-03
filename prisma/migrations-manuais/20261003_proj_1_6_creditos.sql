-- prisma/migrations-manuais/20261003_proj_1_6_creditos.sql
-- Fase 1.6 - creditos da operacao (dado de origem, nunca sobrescrito), com RLS e idempotencia.
BEGIN;
CREATE TABLE IF NOT EXISTS proj_creditos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  numero_ordem integer,
  data_credito date NOT NULL,
  valor numeric(18,2) NOT NULL CHECK (valor > 0),
  remetente_id uuid REFERENCES proj_contrapartes(id),
  remetente_nome_extrato varchar(200),
  referencia_bancaria varchar(200),
  recebedora_company_id uuid REFERENCES companies(id),
  origem varchar(20) NOT NULL CHECK (origem IN ('HISTORICO', 'EXTRATO', 'MANUAL')),
  identificacao_pendente boolean NOT NULL DEFAULT false,
  chave_idempotencia varchar(64) NOT NULL,
  bank_transaction_id uuid,
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text,
  UNIQUE (operacao_id, chave_idempotencia),
  CONSTRAINT proj_creditos_remetente_ck CHECK (identificacao_pendente OR remetente_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS proj_creditos_operacao_id_data_credito_idx ON proj_creditos (operacao_id, data_credito);
ALTER TABLE proj_creditos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_creditos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_creditos_ler ON proj_creditos;
DROP POLICY IF EXISTS proj_creditos_gravar ON proj_creditos;
CREATE POLICY proj_creditos_ler ON proj_creditos FOR SELECT USING (EXISTS (SELECT 1 FROM proj_operacoes o WHERE o.id = operacao_id));
CREATE POLICY proj_creditos_gravar ON proj_creditos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
COMMIT;