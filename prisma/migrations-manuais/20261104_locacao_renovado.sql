-- prisma/migrations-manuais/20261104_locacao_renovado.sql
-- 04/11/2026 - Locacao: situacao RENOVADO (contrato substituido por um novo) e vinculo com o contrato que o renova.
-- Sem BEGIN: o ADD VALUE do enum precisa estar efetivado antes do UPDATE (cada comando e confirmado em sequencia).
\set ON_ERROR_STOP on
ALTER TYPE rental_contract_status ADD VALUE IF NOT EXISTS 'RENOVADO';
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS renewed_by_contract_id uuid REFERENCES rental_contracts(id);
CREATE INDEX IF NOT EXISTS rental_contracts_renewed_by_idx ON rental_contracts (renewed_by_contract_id);
-- Ecoville: 40148.002 (2020-2026) foi renovado pelo 40148.002/04 (2026-2029)
DO $$
DECLARE lm uuid := 'ea4a443c-a351-4243-ae00-e7d70f126d5a'; usr uuid := '421642c8-e981-49c9-996c-b4bfabc22b52';
  ant uuid := '7e52fe18-4f63-4b25-be61-61b6c5871882'; novo uuid;
BEGIN
  SELECT id INTO novo FROM rental_contracts WHERE company_id = lm AND contract_number = '40148.002/04' AND deleted_at IS NULL;
  IF novo IS NULL THEN RAISE NOTICE 'Ecoville: 40148.002/04 nao encontrado - nada feito'; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM rental_contracts WHERE id = ant AND status::text = 'RENOVADO') THEN RAISE NOTICE 'Ecoville: ja renovado'; RETURN; END IF;
  UPDATE rental_contracts SET status = 'RENOVADO', renewed_by_contract_id = novo,
         notes = replace(notes, 'Encerrado por fim de prazo em 30/10/2026 - renovado pelo contrato 40148.002/04 (01/11/2026 a 30/10/2029).',
                                'Renovado pelo contrato 40148.002/04 (01/11/2026 a 30/10/2029) - fim em 30/10/2026.'),
         updated_by_id = usr, updated_at = now()
   WHERE id = ant AND company_id = lm AND status::text = 'ENCERRADO';
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES
    (gen_random_uuid(), usr, 'LOCACAO_CONTRATO_RENOVADO', ant::text, jsonb_build_object('contrato', '40148.002', 'renovadoPor', '40148.002/04', 'fim', '2026-10-30', 'antes', 'ENCERRADO'), now());
END $$;
SELECT coalesce(c.contract_number, '-') AS numero, c.status, c.start_date, c.end_date, c.rent_amount, coalesce(n.contract_number, '') AS renovado_por
  FROM rental_contracts c LEFT JOIN rental_contracts n ON n.id = c.renewed_by_contract_id
 WHERE c.company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND c.contract_number LIKE '40148.002%' AND c.deleted_at IS NULL ORDER BY c.start_date;