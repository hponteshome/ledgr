-- 18/11/2026 - LM: sem remuneracao antes de 03/2026 (pro-labore desde 03/2026; sem folha)
UPDATE fiscal_obligations fo
SET status = 'DISPENSED', notes = 'Sem remuneracao no periodo (pro-labore desde 03/2026; sem folha) - dispensada em 18/11/2026'
FROM companies c
WHERE c.id = fo.company_id AND c.tax_id = '17970759000108'
  AND fo.code IN ('ESOCIAL', 'DCTFWEB', 'INSS_DARF') AND fo.status IN ('PENDING', 'OVERDUE')
  AND regexp_replace(fo.competence, '^(\d{2})/(\d{4})$', '\2-\1') < '2026-03'
  AND NOT (fo.code IN ('ESOCIAL', 'DCTFWEB') AND regexp_replace(fo.competence, '^(\d{2})/(\d{4})$', '\2-\1') IN ('2023-01', '2024-01', '2025-01', '2026-01'));
UPDATE fiscal_obligations fo
SET notes = 'Sem movimento: o eSocial pede S-1299 sem movimento no 1o mes (01/2023, inicio do S-1000) e em cada janeiro - conferir no portal se foi enviado'
FROM companies c
WHERE c.id = fo.company_id AND c.tax_id = '17970759000108'
  AND fo.code IN ('ESOCIAL', 'DCTFWEB') AND fo.status IN ('PENDING', 'OVERDUE')
  AND regexp_replace(fo.competence, '^(\d{2})/(\d{4})$', '\2-\1') IN ('2023-01', '2024-01', '2025-01', '2026-01');