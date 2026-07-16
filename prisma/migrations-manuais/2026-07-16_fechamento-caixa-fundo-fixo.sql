BEGIN;

ALTER TABLE petty_cash_entries
  ADD COLUMN IF NOT EXISTS account_id UUID NULL,
  ADD COLUMN IF NOT EXISTS closure_id UUID NULL;

CREATE TABLE IF NOT EXISTS petty_cash_category_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id),
  category    "PettyCashCategory" NOT NULL,
  account_id  UUID NOT NULL REFERENCES chart_of_accounts(id),
  created_at  TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP(6) NOT NULL DEFAULT now(),
  UNIQUE (company_id, category)
);

CREATE TABLE IF NOT EXISTS petty_cash_closures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id),
  petty_cash_id    UUID NOT NULL REFERENCES petty_cash(id),
  period_start     TIMESTAMP(6) NOT NULL,
  period_end       TIMESTAMP(6) NOT NULL,
  total_expenses   DECIMAL(15,2) NOT NULL,
  journal_entry_id UUID NULL REFERENCES journal_entries(id),
  closed_by_id     UUID NOT NULL,
  created_at       TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_petty_cash_closures_fund ON petty_cash_closures(petty_cash_id);

ALTER TABLE petty_cash_entries
  DROP CONSTRAINT IF EXISTS fk_petty_cash_entries_account,
  DROP CONSTRAINT IF EXISTS fk_petty_cash_entries_closure;
ALTER TABLE petty_cash_entries
  ADD CONSTRAINT fk_petty_cash_entries_account FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
  ADD CONSTRAINT fk_petty_cash_entries_closure FOREIGN KEY (closure_id) REFERENCES petty_cash_closures(id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_closure ON petty_cash_entries(closure_id);

COMMIT;
