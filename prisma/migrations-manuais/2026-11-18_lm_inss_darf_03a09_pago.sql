-- 18/11/2026 - LM: DARF numerado 07.16.26322.5075226-0 (INSS 03 a 09/2026, com multa e juros) pago por PIX Bradesco
UPDATE fiscal_obligations fo
SET status = 'DONE',
    delivered_at = TIMESTAMP '2026-11-18 10:20:00',
    receipt_number = '07.16.26322.5075226-0',
    notes = 'DARF numerado 07.16.26322.5075226-0 (R$ 5.309,72 - INSS 03 a 09/2026) pago em 18/11/2026 - PIX Bradesco doc 1020022'
FROM companies c
WHERE c.id = fo.company_id AND c.tax_id = '17970759000108' AND fo.code = 'INSS_DARF'
  AND regexp_replace(fo.competence, '^(\d{2})/(\d{4})$', '\2-\1') BETWEEN '2026-03' AND '2026-09';