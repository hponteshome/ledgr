-- prisma/migrations-manuais/2026-08-26-create-lalur-part-b-nativo.sql
CREATE TABLE lalur_part_b_nativo (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  ano            VARCHAR(4) NOT NULL,
  tipo_tributo   VARCHAR(1) NOT NULL,
  saldo_inicial  NUMERIC(18,2) NOT NULL DEFAULT 0,
  novo_prejuizo  NUMERIC(18,2) NOT NULL DEFAULT 0,
  compensacao    NUMERIC(18,2) NOT NULL DEFAULT 0,
  saldo_final    NUMERIC(18,2) NOT NULL DEFAULT 0,
  lucro_real_ano NUMERIC(18,2),
  created_by_id  UUID REFERENCES users(id),
  created_at     TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lalur_part_b_nativo_company_ano_tributo_key
  ON lalur_part_b_nativo (company_id, ano, tipo_tributo);
CREATE INDEX lalur_part_b_nativo_company_ano_idx ON lalur_part_b_nativo (company_id, ano);

SELECT table_name FROM information_schema.tables WHERE table_name = 'lalur_part_b_nativo';
