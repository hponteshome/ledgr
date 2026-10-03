-- prisma/migrations-manuais/20261003_bancos_contraparte.sql
-- Fase 1.7 - contraparte (nome e CPF/CNPJ) da transacao bancaria, quando o extrato traz o dado (Itau Empresas).
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS counterparty_name varchar(200);
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS counterparty_doc varchar(14);
CREATE INDEX IF NOT EXISTS bank_transactions_company_counterparty_doc_idx ON bank_transactions (company_id, counterparty_doc);
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bank_transactions' AND column_name LIKE 'counterparty%';