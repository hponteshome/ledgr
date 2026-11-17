-- 2026-11-17 - Lastro documental do contrato de locacao (PDF assinado no Arquivo Digital, conferencia, ressalva)
--              e prazo da DCTFWeb/MIT (desde 2025) no ultimo dia util do mes seguinte.
\pset pager off
BEGIN;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS signed_document_id uuid;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS lastro_conferido_em timestamp(6);
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS lastro_conferido_por uuid;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS lastro_ressalva text;
UPDATE fiscal_obligations o
   SET due_date = (y.fim - CASE EXTRACT(ISODOW FROM y.fim) WHEN 6 THEN 1 WHEN 7 THEN 2 ELSE 0 END), updated_at = now()
  FROM (SELECT id, (date_trunc('month', to_date(competence || '-01', 'YYYY-MM-DD') + interval '2 month') - interval '1 day')::date AS fim
          FROM fiscal_obligations
         WHERE code = 'DCTFWEB' AND competence >= '2025-01' AND length(competence) = 7
           AND status = 'PENDING' AND notes IS NULL AND receipt_number IS NULL) y
 WHERE o.id = y.id;
COMMIT;
SELECT c.legal_name, o.competence, o.due_date FROM fiscal_obligations o JOIN companies c ON c.id = o.company_id
 WHERE o.code = 'DCTFWEB' AND o.competence BETWEEN '2026-09' AND '2026-11' ORDER BY 1, 2;