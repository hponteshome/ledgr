-- 2026-11-18_lm_loftsp_aditivo_2022.sql
-- LOFT-ADITIVO-01: LoftSP (Rafael Tonelli Guaspari). O instrumento de 2022 (nº 220003) e aditivo de reajuste do
-- contrato 200002 (26/06/2020), nao contrato novo - preserva as DIMOBs 2024 e 2025 entregues (sem retificacao).
-- 200002: RENOVADO pelo 250002, reajuste em 26/06/2022, PDF do aditivo ligado (aparece na aba Locacao).
-- 220003: excluido (sem titulos, sem referencias). Documento do aditivo renomeado.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rental_contracts WHERE id = '1db1708e-76cf-47f7-8e18-e81cad46ba8d' AND contract_number = '220003' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'contrato 220003 nao encontrado ou ja excluido';
  END IF;
  IF EXISTS (SELECT 1 FROM ar_entries a WHERE to_jsonb(a)::text LIKE '%1db1708e-76cf-47f7-8e18-e81cad46ba8d%') THEN
    RAISE EXCEPTION 'contrato 220003 tem titulos a receber - abortado';
  END IF;
  IF EXISTS (SELECT 1 FROM rental_contracts WHERE document_id = 'f5bf8ca6-f274-407a-9030-e6654f837de6' AND id <> '1db1708e-76cf-47f7-8e18-e81cad46ba8d' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'documento do aditivo ja ligado a outro contrato - abortado';
  END IF;

  UPDATE rental_contracts
     SET status = 'RENOVADO', renewed_by_contract_id = '74f96526-3904-4ab0-a35c-50347baa5d7c',
         last_readjustment_date = DATE '2022-06-26', document_id = 'f5bf8ca6-f274-407a-9030-e6654f837de6', updated_at = now()
   WHERE id = '04acd6bc-e764-4fa1-9c51-227de4ba57e2' AND contract_number = '200002' AND deleted_at IS NULL AND document_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION '200002: % linhas', n; END IF;

  UPDATE rental_contracts SET deleted_at = now(), updated_at = now()
   WHERE id = '1db1708e-76cf-47f7-8e18-e81cad46ba8d';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION '220003: % linhas', n; END IF;

  UPDATE documents SET title = 'Aditivo de reajuste 2022 - LoftSP - contrato 200002 - Rafael Tonelli Guaspari'
   WHERE id = 'f5bf8ca6-f274-407a-9030-e6654f837de6';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'documento: % linhas', n; END IF;
END $$;

SELECT contract_number, status, start_date, end_date, last_readjustment_date, (document_id IS NOT NULL) AS tem_pdf,
       (SELECT contract_number FROM rental_contracts r2 WHERE r2.id = rc.renewed_by_contract_id) AS renovado_por,
       (deleted_at IS NOT NULL) AS excluido
  FROM rental_contracts rc
 WHERE id IN ('04acd6bc-e764-4fa1-9c51-227de4ba57e2','1db1708e-76cf-47f7-8e18-e81cad46ba8d','74f96526-3904-4ab0-a35c-50347baa5d7c')
 ORDER BY start_date;
COMMIT;