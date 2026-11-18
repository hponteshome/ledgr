-- DIMOB-A-01 (18/11/2026) - ar_entries: comissao do intermediario e IR retido (DIMOB R02)
ALTER TABLE ar_entries
  ADD COLUMN IF NOT EXISTS commission_amount       numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_payee_type   varchar(2),
  ADD COLUMN IF NOT EXISTS commission_payee_id     uuid,
  ADD COLUMN IF NOT EXISTS commission_payee_name   varchar(200),
  ADD COLUMN IF NOT EXISTS commission_payee_tax_id varchar(18),
  ADD COLUMN IF NOT EXISTS commission_paid_by      varchar(10),
  ADD COLUMN IF NOT EXISTS commission_paid_at      date,
  ADD COLUMN IF NOT EXISTS withheld_tax_amount     numeric(15,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ar_entries_commission_payee_type_chk') THEN
    ALTER TABLE ar_entries ADD CONSTRAINT ar_entries_commission_payee_type_chk CHECK (commission_payee_type IN ('PJ', 'PF'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ar_entries_commission_paid_by_chk') THEN
    ALTER TABLE ar_entries ADD CONSTRAINT ar_entries_commission_paid_by_chk CHECK (commission_paid_by IN ('LOCADORA', 'LOCATARIO'));
  END IF;
END $$;
SELECT count(*) AS colunas_novas FROM information_schema.columns
WHERE table_name = 'ar_entries' AND column_name IN ('commission_amount','commission_payee_type','commission_payee_id','commission_payee_name',
  'commission_payee_tax_id','commission_paid_by','commission_paid_at','withheld_tax_amount');