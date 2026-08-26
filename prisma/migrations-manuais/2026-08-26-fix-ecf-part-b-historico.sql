-- prisma/migrations-manuais/2026-08-26-fix-ecf-part-b-historico.sql
-- Corrige EcfPartB: faltava period/tipoTributo, so guardava 1 saldo por
-- conta (sobrescrevia a cada import). Achado durante conferencia manual da
-- continuidade do prejuizo fiscal 2017-2024 da Hotelsys.

BEGIN;

ALTER TABLE ecf_part_b
  ADD COLUMN tipo_tributo VARCHAR(1) NOT NULL DEFAULT 'I',
  ADD COLUMN period VARCHAR NOT NULL DEFAULT '0000',
  ADD COLUMN saldo_inicial NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN movimento NUMERIC(18,2) NOT NULL DEFAULT 0;

ALTER TABLE ecf_part_b ALTER COLUMN tipo_tributo DROP DEFAULT;
ALTER TABLE ecf_part_b ALTER COLUMN period DROP DEFAULT;

DROP INDEX IF EXISTS ecf_part_b_company_id_account_code_key;

CREATE UNIQUE INDEX ecf_part_b_company_id_account_code_tipo_tributo_period_key
  ON ecf_part_b (company_id, account_code, tipo_tributo, period);

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ecf_part_b' ORDER BY ordinal_position;

COMMIT;
