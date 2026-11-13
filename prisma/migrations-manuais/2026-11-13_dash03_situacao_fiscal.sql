-- DASH-03 (13/11/2026): situacao fiscal no Dashboard - status DISPENSED/RECTIFY, recibo/entrega/dependencia nas obrigacoes, alertas da empresa
ALTER TYPE "FiscalObligationStatus" ADD VALUE IF NOT EXISTS 'DISPENSED';
ALTER TYPE "FiscalObligationStatus" ADD VALUE IF NOT EXISTS 'RECTIFY';
ALTER TABLE fiscal_obligations ADD COLUMN IF NOT EXISTS receipt_number varchar(120);
ALTER TABLE fiscal_obligations ADD COLUMN IF NOT EXISTS delivered_at timestamp(6);
ALTER TABLE fiscal_obligations ADD COLUMN IF NOT EXISTS depends_on text;
CREATE TABLE IF NOT EXISTS company_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  severity varchar(10) NOT NULL DEFAULT 'WARNING',
  title varchar(250) NOT NULL,
  message text,
  blocks_action varchar(40),
  locked boolean NOT NULL DEFAULT false,
  created_by_name varchar(150),
  created_at timestamp(6) NOT NULL DEFAULT now(),
  resolved_at timestamp(6),
  resolved_by_id uuid,
  resolution_note text
);
CREATE INDEX IF NOT EXISTS company_alerts_company_id_resolved_at_idx ON company_alerts (company_id, resolved_at);
