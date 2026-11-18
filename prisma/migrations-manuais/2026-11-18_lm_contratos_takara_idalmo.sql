-- DIMOB-CONTRATOS-01 (18/11/2026) - LM
-- 1) Takara (220002, Mare 88): rescindido em 25/04/2023 (antes: fim 31/07/2023, ENCERRADO)
-- 2) Idalmo (240002, Mare 88, temporada 12 a 22/01/2025): 1o vencimento e data do documento estavam em 2024
BEGIN;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM rental_contracts WHERE id = '75694ace-936b-4244-b48c-837b37710055' AND contract_number = '220002' AND deleted_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'Takara 220002 nao encontrado - nada alterado'; END IF;
  SELECT count(*) INTO n FROM rental_contracts WHERE id = '478ba22f-1cf6-407c-9770-b796fdaf2620' AND contract_number = '240002' AND deleted_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'Idalmo 240002 nao encontrado - nada alterado'; END IF;
  SELECT count(*) INTO n FROM documents WHERE id = '29eff95f-4b1f-44e8-8690-04b20900f5ba' AND deleted_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'Documento do Idalmo nao encontrado - nada alterado'; END IF;
END $$;

UPDATE rental_contracts
   SET end_date = DATE '2023-04-25', status = 'RESCINDIDO',
       notes = 'Rescindido em 25/04/2023 (caucao de R$ 12.000,00 restituida em 26/04/2023).',
       specific_clauses = NULL, updated_at = now()
 WHERE id = '75694ace-936b-4244-b48c-837b37710055' AND end_date <> DATE '2023-04-25';

UPDATE rental_contracts SET first_due_date = DATE '2025-01-12', updated_at = now()
 WHERE id = '478ba22f-1cf6-407c-9770-b796fdaf2620' AND first_due_date = DATE '2024-01-12';

UPDATE documents SET date = DATE '2025-01-12', updated_at = now()
 WHERE id = '29eff95f-4b1f-44e8-8690-04b20900f5ba' AND date = DATE '2024-01-12';
COMMIT;

\echo == Conferencia ==
SELECT r.contract_number, left(r.tenant_name, 30) AS locatario, r.start_date, r.end_date, r.first_due_date, r.status, left(r.notes, 60) AS notas, d.date AS data_documento
FROM rental_contracts r LEFT JOIN documents d ON d.id = coalesce(r.signed_document_id, r.document_id)
WHERE r.id IN ('75694ace-936b-4244-b48c-837b37710055', '478ba22f-1cf6-407c-9770-b796fdaf2620');