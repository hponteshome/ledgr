-- ARQ-DIMOB-01 (18/11/2026) - LM: DIMOB 2024 e 2025 entregues (recibos) na agenda; documentos da DIMOB com subtipo proprio; alerta atualizado
\set ON_ERROR_STOP on
BEGIN;
SELECT id AS cid FROM companies WHERE tax_id = '17970759000108' \gset

UPDATE fiscal_obligations SET status = 'DONE', done_at = TIMESTAMP '2026-11-18 13:25:56', delivered_at = TIMESTAMP '2026-11-18 13:25:56',
       receipt_number = '06.94.80.85.92-03', done_by_id = '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid, updated_at = now(),
       notes = 'Entregue em 18/11/2026 13:25:56 (original, Receitanet), 6 contratos, aluguel 395.476,08, comissao 19.925,17. '
            || 'Recibo no Arquivo Digital: "Dimob 2024 e 2025 Recibo" (um PDF com os recibos de 2024 e 2025). Multa esperada 5.250,00 (faixa R$ 500, com 50%) - aguardar notificacao.'
 WHERE company_id = :'cid' AND code = 'DIMOB' AND competence = '2024' AND status::text <> 'DONE';
UPDATE fiscal_obligations SET status = 'DONE', done_at = TIMESTAMP '2026-11-18 13:26:33', delivered_at = TIMESTAMP '2026-11-18 13:26:33',
       receipt_number = '01.03.52.74.36-11', done_by_id = '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid, updated_at = now(),
       notes = 'Entregue em 18/11/2026 13:26:33 (original, Receitanet), 12 contratos, aluguel 681.566,68, comissao 56.447,93. '
            || 'Recibo no Arquivo Digital: "Dimob 2024 e 2025 Recibo" (um PDF com os recibos de 2024 e 2025). Multa esperada 2.500,00 (faixa R$ 500, com 50%) - aguardar notificacao.'
 WHERE company_id = :'cid' AND code = 'DIMOB' AND competence = '2025' AND status::text <> 'DONE';

UPDATE documents SET subtipo = 'DIMOB', updated_at = now()
 WHERE company_id = :'cid' AND deleted_at IS NULL AND type::text = 'FISCAL' AND subtipo = 'OBRIGACAO'
   AND (title ILIKE '%dimob%' OR original_file_name ILIKE '%dimob%');

UPDATE company_alerts SET title = 'DIMOB 2023: entregar antes da MIT de out/2026 e de qualquer ECF',
       message = 'DIMOB 2024 (recibo 06.94.80.85.92-03) e 2025 (recibo 01.03.52.74.36-11) entregues em 18/11/2026. Falta a 2023 (Curitiba ago-dez/2023). '
              || 'A ultima declaracao apresentada segue sendo a ECF 2022 (Presumido): nao transmitir ECF nem MIT antes da DIMOB 2023. Multa estimada da 2023 com 50%: 8.250.'
 WHERE company_id = :'cid' AND resolved_at IS NULL AND title = 'DIMOB 2023, 2024 e 2025: entregar antes da MIT de out/2026 e de qualquer ECF';
COMMIT;

\echo == Agenda: DIMOB ==
SELECT competence, status, receipt_number, delivered_at FROM fiscal_obligations WHERE company_id = :'cid' AND code = 'DIMOB' ORDER BY competence;
\echo == Arquivo Digital: documentos da DIMOB ==
SELECT left(title, 45) AS titulo, type, subtipo, left(original_file_name, 45) AS arquivo FROM documents
 WHERE company_id = :'cid' AND deleted_at IS NULL AND (title ILIKE '%dimob%' OR original_file_name ILIKE '%dimob%') ORDER BY created_at;
\echo == Alertas DIMOB abertos ==
SELECT left(title, 80) AS alerta FROM company_alerts WHERE company_id = :'cid' AND resolved_at IS NULL AND title ILIKE '%DIMOB%';