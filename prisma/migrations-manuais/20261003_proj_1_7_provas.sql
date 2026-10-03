-- prisma/migrations-manuais/20261003_proj_1_7_provas.sql
-- Fase 1.7 - prova bancaria do credito: ligacao com a transacao do extrato (core bank_transactions), historico imutavel.
BEGIN;
CREATE TABLE IF NOT EXISTS proj_credito_provas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id uuid NOT NULL REFERENCES proj_creditos(id),
  bank_transaction_id uuid NOT NULL REFERENCES bank_transactions(id),
  criterio varchar(30) NOT NULL CHECK (criterio IN ('AUTO_DOC_DATA_VALOR', 'AUTO_DATA_VALOR', 'MANUAL')),
  motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_credito_provas_credito_vigente_uq ON proj_credito_provas (credito_id) WHERE cancelado_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS proj_credito_provas_transacao_vigente_uq ON proj_credito_provas (bank_transaction_id) WHERE cancelado_em IS NULL;

CREATE OR REPLACE FUNCTION proj_credito_provas_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM proj_creditos c JOIN bank_transactions t ON t.id = NEW.bank_transaction_id
      WHERE c.id = NEW.credito_id AND t.type::text = 'CREDIT' AND t.amount = c.valor
        AND (c.recebedora_company_id IS NULL OR t.company_id = c.recebedora_company_id)
    ) THEN
      RAISE EXCEPTION 'A prova precisa ser uma entrada do mesmo valor, na conta da empresa recebedora do credito';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.cancelado_em IS NOT NULL OR NEW.cancelado_em IS NULL
     OR NEW.credito_id IS DISTINCT FROM OLD.credito_id OR NEW.bank_transaction_id IS DISTINCT FROM OLD.bank_transaction_id
     OR NEW.criterio IS DISTINCT FROM OLD.criterio OR NEW.motivo IS DISTINCT FROM OLD.motivo
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Prova bancaria e imutavel: so pode ser encerrada, com motivo';
  END IF;
  IF NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10 THEN
    RAISE EXCEPTION 'Encerramento de prova exige motivo (minimo 10 caracteres)';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_credito_provas_validar_trg ON proj_credito_provas;
CREATE TRIGGER proj_credito_provas_validar_trg BEFORE INSERT OR UPDATE ON proj_credito_provas FOR EACH ROW EXECUTE FUNCTION proj_credito_provas_validar();

ALTER TABLE proj_credito_provas ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_credito_provas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_credito_provas_ler ON proj_credito_provas;
DROP POLICY IF EXISTS proj_credito_provas_inserir ON proj_credito_provas;
DROP POLICY IF EXISTS proj_credito_provas_encerrar ON proj_credito_provas;
CREATE POLICY proj_credito_provas_ler ON proj_credito_provas FOR SELECT USING (EXISTS (SELECT 1 FROM proj_creditos c WHERE c.id = credito_id));
CREATE POLICY proj_credito_provas_inserir ON proj_credito_provas FOR INSERT WITH CHECK (proj_ctx_master());
CREATE POLICY proj_credito_provas_encerrar ON proj_credito_provas FOR UPDATE USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
REVOKE DELETE, TRUNCATE ON proj_credito_provas FROM ledgr_api;

-- Ligacao automatica: so com UMA transacao correspondente e nunca com CPF/CNPJ divergente
INSERT INTO proj_credito_provas (credito_id, bank_transaction_id, criterio, motivo, criado_por_id)
SELECT c.id, m.tx_id, m.criterio,
       CASE m.criterio WHEN 'AUTO_DOC_DATA_VALOR'
         THEN 'Ligacao automatica (03/10/2026): mesma data, mesmo valor e mesmo CPF/CNPJ do remetente no extrato Itau'
         ELSE 'Ligacao automatica (03/10/2026): mesma data e mesmo valor no extrato Itau, transacao unica' END,
       (SELECT id FROM users WHERE email = 'hpontes@ledgr.com')
FROM proj_creditos c
LEFT JOIN proj_contrapartes ct ON ct.id = c.remetente_id
JOIN LATERAL (
  SELECT t.id AS tx_id,
         CASE WHEN t.counterparty_doc IS NOT NULL AND t.counterparty_doc = ct.documento THEN 'AUTO_DOC_DATA_VALOR' ELSE 'AUTO_DATA_VALOR' END AS criterio
  FROM bank_transactions t
  WHERE t.company_id = c.recebedora_company_id AND t.type::text = 'CREDIT' AND t.transaction_date::date = c.data_credito AND t.amount = c.valor
    AND NOT (t.counterparty_doc IS NOT NULL AND ct.documento IS NOT NULL AND t.counterparty_doc <> ct.documento)
) m ON true
WHERE c.cancelado_em IS NULL
  AND NOT EXISTS (SELECT 1 FROM proj_credito_provas p WHERE p.credito_id = c.id AND p.cancelado_em IS NULL)
  AND (SELECT count(*) FROM bank_transactions t2 WHERE t2.company_id = c.recebedora_company_id AND t2.type::text = 'CREDIT'
       AND t2.transaction_date::date = c.data_credito AND t2.amount = c.valor) = 1;

INSERT INTO audit_logs (actor_id, acao, target_id, depois)
SELECT hp.id, 'PROJ_CREDITOS_COMPROVADOS', o.id::text,
       jsonb_build_object('provas_vigentes', (SELECT count(*) FROM proj_credito_provas WHERE cancelado_em IS NULL), 'extrato', 'Itau SUNSYS', 'item', 'Fase 1.7')
FROM proj_operacoes o CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE o.codigo = 'ANCORA' AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.acao = 'PROJ_CREDITOS_COMPROVADOS' AND a.target_id = o.id::text);
COMMIT;
SELECT criterio, count(*) AS creditos FROM proj_credito_provas WHERE cancelado_em IS NULL GROUP BY 1 ORDER BY 1;