-- 2026-11-19_dimob_numero_contrato.sql
-- DIMOB-NUM-01: numero interno da DIMOB fixo por contrato (contratos com numero de mais de 6 posicoes), igual em todos os anos.
-- LM: numeros ja entregues nas DIMOBs 2024 e 2025 (18/11/2026) preservados; 40148.001.03 (Augusto, so 2023) recebe 900005.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS dimob_numero varchar(6);
CREATE UNIQUE INDEX IF NOT EXISTS rental_contracts_dimob_numero_uq ON rental_contracts (company_id, dimob_numero) WHERE dimob_numero IS NOT NULL;
DO $$
DECLARE lm uuid; r record; n int;
BEGIN
  SELECT id INTO lm FROM companies WHERE tax_id = '17970759000108';
  FOR r IN SELECT * FROM (VALUES ('40148.002', '900001'), ('40148.001', '900002'), ('Landmark-2025', '900003'), ('Conj32-2025', '900004'), ('40148.001.03', '900005')) v(c, num) LOOP
    UPDATE rental_contracts SET dimob_numero = r.num WHERE company_id = lm AND contract_number = r.c AND deleted_at IS NULL AND dimob_numero IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'Contrato % (%): % linhas - desfeito', r.c, r.num, n; END IF;
  END LOOP;
END $$;
COMMIT;
\echo == numeros internos da DIMOB ==
SELECT (SELECT legal_name FROM companies c WHERE c.id = rc.company_id) AS empresa, contract_number, dimob_numero, tenant_name
  FROM rental_contracts rc WHERE dimob_numero IS NOT NULL ORDER BY 1, dimob_numero;