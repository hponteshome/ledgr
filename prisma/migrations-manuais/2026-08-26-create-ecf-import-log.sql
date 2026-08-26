-- prisma/migrations-manuais/2026-08-26-create-ecf-import-log.sql
CREATE TABLE ecf_import_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  file_name         VARCHAR NOT NULL,
  layout_version    VARCHAR(10),
  period_start      VARCHAR(8) NOT NULL,
  period_end        VARCHAR(8) NOT NULL,
  period            VARCHAR NOT NULL,
  accounts          INT NOT NULL DEFAULT 0,
  journal_entries   INT NOT NULL DEFAULT 0,
  registros_parte_a INT NOT NULL DEFAULT 0,
  registros_parte_b INT NOT NULL DEFAULT 0,
  status            VARCHAR(20) NOT NULL,
  warnings          JSONB,
  created_by_id     UUID REFERENCES users(id),
  created_at        TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX ecf_import_logs_company_period_idx ON ecf_import_logs (company_id, period);

SELECT table_name FROM information_schema.tables WHERE table_name = 'ecf_import_logs';
