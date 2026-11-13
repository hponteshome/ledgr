-- 20261109_lm_tax_regimes_ecf.sql - Regime da LM conforme ECF 2024 e 2025 (0010 FORMA_TRIB=1, Lucro Real anual) e Y720 (2023 presumido)
BEGIN;
UPDATE company_tax_regimes SET dt_fin = '2023-12-31', updated_at = now() WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND dt_fin = '2024-12-31';
UPDATE company_tax_regimes SET dt_ini = '2024-01-01', updated_at = now() WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND dt_ini = '2025-01-01';
COMMIT;