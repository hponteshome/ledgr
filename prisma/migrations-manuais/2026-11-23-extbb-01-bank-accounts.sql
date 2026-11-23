-- prisma/migrations-manuais/2026-11-23-extbb-01-bank-accounts.sql
-- SCHEMA-EXTBB-01 (23/11/2026) - Contas Bancarias + extrato PDF (hash, texto, leiaute, status)
-- + linha do extrato (impressao digital, codigo do historico, destino unico, soft-delete). Idempotente.
BEGIN;

DO $$ BEGIN
  CREATE TYPE "BankStatementStatus" AS ENUM ('IMPORTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BankTxDestination" AS ENUM ('RECONCILE_EXISTING', 'SETTLE_TITLE', 'DIRECT_ENTRY', 'ALREADY_POSTED', 'IGNORE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bank_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES companies(id),
  bank_code             "BankCode" NOT NULL,
  bank_number           varchar(3) NOT NULL,
  agency                varchar(10) NOT NULL,
  agency_digit          varchar(2),
  account               varchar(20) NOT NULL,
  account_digit         varchar(2),
  nickname              varchar(80),
  ledger_account_id     uuid REFERENCES chart_of_accounts(id),
  investment_account_id uuid REFERENCES chart_of_accounts(id),
  opened_at             date,
  is_active             boolean NOT NULL DEFAULT true,
  created_by_id         uuid,
  created_at            timestamp(6) NOT NULL DEFAULT now(),
  updated_at            timestamp(6) NOT NULL DEFAULT now(),
  deleted_at            timestamp(6)
);
CREATE INDEX IF NOT EXISTS bank_accounts_company_id_idx ON bank_accounts (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_company_bank_agency_account_uq
  ON bank_accounts (company_id, bank_number, agency, account) WHERE deleted_at IS NULL;

ALTER TABLE bank_statements
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id),
  ADD COLUMN IF NOT EXISTS file_hash       varchar(64),
  ADD COLUMN IF NOT EXISTS raw_text        text,
  ADD COLUMN IF NOT EXISTS layout          varchar(40),
  ADD COLUMN IF NOT EXISTS issued_at       date,
  ADD COLUMN IF NOT EXISTS status          "BankStatementStatus" NOT NULL DEFAULT 'IMPORTED';
CREATE INDEX IF NOT EXISTS bank_statements_bank_account_id_idx ON bank_statements (bank_account_id);
CREATE INDEX IF NOT EXISTS bank_statements_company_id_file_hash_idx ON bank_statements (company_id, file_hash);
CREATE UNIQUE INDEX IF NOT EXISTS bank_statements_company_file_hash_uq
  ON bank_statements (company_id, file_hash) WHERE deleted_at IS NULL AND file_hash IS NOT NULL;

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS line_no        integer,
  ADD COLUMN IF NOT EXISTS fingerprint    varchar(64),
  ADD COLUMN IF NOT EXISTS bank_hist_code varchar(10),
  ADD COLUMN IF NOT EXISTS destination    "BankTxDestination",
  ADD COLUMN IF NOT EXISTS ignore_reason  varchar(255),
  ADD COLUMN IF NOT EXISTS deleted_at     timestamp(6);
CREATE INDEX IF NOT EXISTS bank_transactions_company_id_fingerprint_idx ON bank_transactions (company_id, fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_company_fingerprint_uq
  ON bank_transactions (company_id, fingerprint) WHERE deleted_at IS NULL AND fingerprint IS NOT NULL;

COMMIT;