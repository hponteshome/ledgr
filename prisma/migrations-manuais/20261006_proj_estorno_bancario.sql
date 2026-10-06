-- prisma/migrations-manuais/20261006_proj_estorno_bancario.sql
-- Estorno bancario (06/10/2026): par debito x credito do mesmo valor que se anula; sai da triagem, dos circuitos e dos saldos.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE proj_extrato_decisoes DROP CONSTRAINT IF EXISTS proj_extrato_decisoes_decisao_check;
ALTER TABLE proj_extrato_decisoes ADD CONSTRAINT proj_extrato_decisoes_decisao_check CHECK (decisao IN ('NAO_PERTENCE', 'TRANSFERENCIA_INTERNA', 'ESTORNO_BANCARIO'));
ALTER TABLE proj_extrato_decisoes ADD COLUMN IF NOT EXISTS par_bank_transaction_id uuid REFERENCES bank_transactions(id);
ALTER TABLE proj_extrato_decisoes DROP CONSTRAINT IF EXISTS proj_extrato_decisoes_estorno_ck;
ALTER TABLE proj_extrato_decisoes ADD CONSTRAINT proj_extrato_decisoes_estorno_ck CHECK ((decisao = 'ESTORNO_BANCARIO') = (par_bank_transaction_id IS NOT NULL));
CREATE OR REPLACE FUNCTION proj_extrato_estorno_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a record; b record;
BEGIN
  IF NEW.decisao <> 'ESTORNO_BANCARIO' THEN RETURN NEW; END IF;
  SELECT company_id, type::text AS tipo, amount, transaction_date::date AS data INTO a FROM bank_transactions WHERE id = NEW.bank_transaction_id;
  SELECT company_id, type::text AS tipo, amount, transaction_date::date AS data INTO b FROM bank_transactions WHERE id = NEW.par_bank_transaction_id;
  IF b IS NULL OR NEW.par_bank_transaction_id = NEW.bank_transaction_id OR a.company_id <> b.company_id OR a.tipo = b.tipo
     OR a.amount <> b.amount OR abs(a.data - b.data) > 7 THEN
    RAISE EXCEPTION 'Estorno bancario exige um par da mesma empresa, de tipo oposto, mesmo valor e ate 7 dias de diferenca';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_extrato_estorno_validar_trg ON proj_extrato_decisoes;
CREATE TRIGGER proj_extrato_estorno_validar_trg BEFORE INSERT ON proj_extrato_decisoes FOR EACH ROW EXECUTE FUNCTION proj_extrato_estorno_validar();

CREATE TEMP TABLE est_ctx ON COMMIT DROP AS
SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') AS master, pp.company_id AS empresa, o.id AS operacao
FROM proj_participacoes pp JOIN proj_papeis pa ON pa.id = pp.papel_id JOIN proj_operacoes o ON o.id = pp.operacao_id
WHERE o.codigo = 'ANCORA' AND pa.codigo = 'RECEBEDORA_FINANCEIRA' AND pp.cancelado_em IS NULL LIMIT 1;
CREATE TEMP TABLE est_pares ON COMMIT DROP AS
SELECT d.id AS debito, c.id AS credito, d.amount AS valor, d.transaction_date::date AS data_debito, c.transaction_date::date AS data_credito
FROM bank_transactions d JOIN est_ctx x ON x.empresa = d.company_id
JOIN proj_anotacoes_extrato ad ON ad.bank_transaction_id = d.id AND trim(split_part(ad.texto, '|', 1)) ILIKE 'estornado'
JOIN bank_transactions c ON c.company_id = d.company_id AND c.type::text = 'CREDIT' AND c.amount = d.amount AND abs(c.transaction_date::date - d.transaction_date::date) <= 7
JOIN proj_anotacoes_extrato ac ON ac.bank_transaction_id = c.id AND trim(split_part(ac.texto, '|', 1)) ILIKE 'estornado'
WHERE d.type::text = 'DEBIT';
SELECT data_debito, data_credito, valor FROM est_pares ORDER BY data_debito;
DO $$ BEGIN
  IF (SELECT count(*) FROM est_pares) <> 5 OR (SELECT count(DISTINCT debito) FROM est_pares) <> 5 OR (SELECT count(DISTINCT credito) FROM est_pares) <> 5 THEN
    RAISE EXCEPTION 'esperados 5 pares unicos; encontrados %', (SELECT count(*) FROM est_pares); END IF;
END $$;
CREATE TEMP TABLE est_mov ON COMMIT DROP AS
SELECT debito AS id, credito AS par FROM est_pares UNION ALL SELECT credito, debito FROM est_pares;
UPDATE proj_extrato_decisoes d SET cancelado_em = now(), cancelado_por_id = (SELECT master FROM est_ctx),
  motivo_cancelamento = 'Substituida por ESTORNO_BANCARIO: o lancamento e um estorno do banco, anulado pelo seu par (06/10/2026).'
WHERE d.cancelado_em IS NULL AND d.bank_transaction_id IN (SELECT id FROM est_mov);
WITH ins AS (
  INSERT INTO proj_extrato_decisoes (operacao_id, bank_transaction_id, decisao, par_bank_transaction_id, motivo, criado_por_id)
  SELECT x.operacao, m.id, 'ESTORNO_BANCARIO', m.par, 'Estorno bancario: lancamento anulado pelo par de mesmo valor e tipo oposto (categoria "estornado" da planilha).', x.master
  FROM est_mov m CROSS JOIN est_ctx x
  RETURNING bank_transaction_id, par_bank_transaction_id)
INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
SELECT gen_random_uuid(), (SELECT master FROM est_ctx), 'PROJ_EXTRATO_MOVIMENTO_DECIDIDO', ins.bank_transaction_id::text,
       jsonb_build_object('decisao', 'ESTORNO_BANCARIO', 'par', ins.par_bank_transaction_id, 'lote', 'estornos-20261006'), now()
FROM ins;
SELECT 'estornos registrados: ' || count(*) || ' lancamentos (' || count(*) / 2 || ' pares)' AS resultado FROM proj_extrato_decisoes WHERE decisao = 'ESTORNO_BANCARIO' AND cancelado_em IS NULL;
SELECT 'circuito Estornos bancarios ainda vigente: ' || count(*) AS conferencia FROM proj_extrato_decisoes WHERE circuito = 'Estornos bancários' AND cancelado_em IS NULL;
COMMIT;