-- B-NFSE-LOC-3B - 20261106_lm_tax_regimes.sql
BEGIN;
INSERT INTO company_tax_regimes (id, company_id, dt_ini, dt_fin, forma_tributacao, created_at, updated_at)
SELECT gen_random_uuid(), 'ea4a443c-a351-4243-ae00-e7d70f126d5a', DATE '2013-03-12', DATE '2024-12-31', 'LUCRO_PRESUMIDO', now(), now()
 WHERE NOT EXISTS (SELECT 1 FROM company_tax_regimes WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND dt_ini = DATE '2013-03-12');
INSERT INTO company_tax_regimes (id, company_id, dt_ini, dt_fin, forma_tributacao, created_at, updated_at)
SELECT gen_random_uuid(), 'ea4a443c-a351-4243-ae00-e7d70f126d5a', DATE '2025-01-01', NULL, 'LUCRO_REAL', now(), now()
 WHERE NOT EXISTS (SELECT 1 FROM company_tax_regimes WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND dt_ini = DATE '2025-01-01');
COMMIT;
SELECT dt_ini, dt_fin, forma_tributacao FROM company_tax_regimes
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' ORDER BY dt_ini;