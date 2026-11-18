-- DIMOB-B-03 (18/11/2026) - LM: contrato LoftSP de 26/06/2020 (Rafael Tonelli Guaspari) e seus recebimentos de out/2023 a abr/2025
-- Instrumento: locador Jose Rozinei da Silva; prazo 26/06/2020 a 25/12/2022, prorrogado por prazo indeterminado ate o contrato 250002
-- (efeitos desde 26/06/2025). Receita da LM pelo Termo de Cessao de 30/03/2020 (decisao do Hpontes, 18/11/2026) - LM como locadora na DIMOB.
\set ON_ERROR_STOP on
BEGIN;
SELECT id AS cid FROM companies WHERE tax_id = '17970759000108' \gset

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM rental_contracts WHERE contract_number = '200002' AND deleted_at IS NULL
             AND company_id = (SELECT id FROM companies WHERE tax_id = '17970759000108')) THEN
    RAISE EXCEPTION 'Contrato 200002 ja existe (DIMOB-B-03 ja aplicado?) - nada alterado';
  END IF;
  IF (SELECT count(*) FROM fixed_assets WHERE id = '747bf218-5144-435f-bcbd-71d5fadebeba') <> 1 THEN
    RAISE EXCEPTION 'Imovel LoftSP nao encontrado - nada alterado';
  END IF;
END $$;

INSERT INTO rental_contracts (company_id, contract_number, fixed_asset_id, tenant_name, tenant_tax_id, tenant_rg, tenant_profession,
  tenant_marital_status, tenant_gender, tenant_nationality, tenant_street, tenant_number, tenant_neighborhood, tenant_city, tenant_state, tenant_zip_code,
  instrument_date, start_date, end_date, rent_amount, due_periodicity, due_day, first_due_date, guarantee_type, guarantee_description,
  readjustment_period_months, readjustment_index, has_intermediary, status, notes, created_by_id)
VALUES (:'cid', '200002', '747bf218-5144-435f-bcbd-71d5fadebeba', 'Rafael Tonelli Guaspari', '44803518840', '32.324.454-3 SSP/SP', 'empresario',
  'SOLTEIRO', 'M', 'Brasileira', 'Rua Aracitaba', '57', 'Morumbi', 'Sao Paulo', 'SP', '05613090',
  DATE '2020-06-26', DATE '2020-06-26', DATE '2025-06-25', 5697.44, 'MENSAL', 26, DATE '2020-08-26', 'FIANCA',
  'Fiadora: Simone Braga Tonelli Guaspari', 12, 'IGPM', false, 'ENCERRADO',
  'Instrumento de 26/06/2020 com Jose Rozinei da Silva como locador (procurador Helenilto A. Pontes); prazo 26/06/2020 a 25/12/2022, '
  || 'prorrogado por prazo indeterminado ate 25/06/2025 (substituido pelo 250002, efeitos desde 26/06/2025). Receita da LM pelo Termo de Cessao '
  || 'de 30/03/2020 (inclui o LoftSP) - ressalva registrada na conciliacao da DIMOB. 1o aluguel pago a corretora (Samira Alves de Oliveira).',
  '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid);

CREATE TEMP TABLE b3 (je uuid, comp char(7), metodo varchar) ON COMMIT DROP;
INSERT INTO b3 VALUES
  ('bd7c6b8e-98e7-4839-b232-e329cd30cff6', '2023-10', 'TED'),
  ('4378ef4b-128e-4fa8-8c2d-4d2bacffea4c', '2023-11', 'TED'),
  ('7bd2faec-f5a6-4ea7-9e5a-16982285bc45', '2023-12', 'TED'),
  ('79f3e10d-a996-41cf-bab7-46e3a28671fb', '2024-01', 'TED'),
  ('3ab1681f-cbcb-4ce4-b15c-a1adcb2184fe', '2025-04', 'PIX'),
  ('7898a3ea-c761-43b3-bef8-89b267f9a129', '2025-04', 'PIX'),
  ('3d46e439-edb7-4974-aef5-6f2df423ae98', '2025-04', 'PIX');

CREATE TEMP TABLE b3r ON COMMIT DROP AS
SELECT b.*, je.date AS data, i.value AS valor, left(coalesce(nullif(i.description, ''), je.description), 200) AS historico, rc.id AS contrato_id, rc.fixed_asset_id
FROM b3 b
JOIN journal_entries je ON je.id = b.je AND je.company_id = :'cid' AND je.deleted_at IS NULL
JOIN journal_entry_items i ON i.journal_entry_id = je.id AND i.account_id = '90593c1e-495e-4403-91b0-5911df855c86'::uuid AND i.type = 'CREDIT'
JOIN rental_contracts rc ON rc.company_id = :'cid' AND rc.contract_number = '200002' AND rc.deleted_at IS NULL;

DO $$ BEGIN
  IF (SELECT count(*) FROM b3r) <> 7 THEN RAISE EXCEPTION 'Esperado 7 lancamentos do LoftSP - nada alterado'; END IF;
END $$;

INSERT INTO ar_entries (company_id, title, description, origin, issue_date, due_date, received_at, competence_month,
  amount, received_amount, status, bank_account, customer_name, customer_cnpj_cpf, fixed_asset_id, journal_entry_id,
  revenue_account_id, rental_contract_id, notes, created_by_id)
SELECT :'cid'::uuid, 'Aluguel 200002 - ' || d.comp,
       'DIMOB-B-03 - reconstrucao 2023-2025 pelo extrato Bradesco (diario = ECD); competencia = mes do recebimento',
       'ALUGUEL', min(d.data), min(d.data), max(d.data), d.comp, sum(d.valor), sum(d.valor), 'RECEIVED', 'Bradesco ag 133 c/c 15049-5',
       'Rafael Tonelli Guaspari', '44803518840', (array_agg(d.fixed_asset_id))[1], (array_agg(d.je ORDER BY d.data))[1],
       '90593c1e-495e-4403-91b0-5911df855c86'::uuid, d.contrato_id,
       CASE WHEN d.comp = '2025-04' THEN 'Pagamentos de abr/2025 relativos a alugueis do contrato de 2020 (prorrogado) antes do 250002.' END,
       '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM b3r d GROUP BY d.contrato_id, d.comp;

INSERT INTO ar_payments (ar_entry_id, received_at, amount, payment_method, bank_account, receipt_ref, notes, created_by_id)
SELECT a.id, d.data, d.valor, 'TED', 'Bradesco ag 133 c/c 15049-5', 'JE ' || d.je, d.historico, '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM b3r d JOIN ar_entries a ON a.rental_contract_id = d.contrato_id AND a.competence_month = d.comp AND a.deleted_at IS NULL WHERE d.metodo = 'TED';
INSERT INTO ar_payments (ar_entry_id, received_at, amount, payment_method, bank_account, receipt_ref, notes, created_by_id)
SELECT a.id, d.data, d.valor, 'PIX', 'Bradesco ag 133 c/c 15049-5', 'JE ' || d.je, d.historico, '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM b3r d JOIN ar_entries a ON a.rental_contract_id = d.contrato_id AND a.competence_month = d.comp AND a.deleted_at IS NULL WHERE d.metodo = 'PIX';

DO $$
DECLARE t23 numeric; t24 numeric; t25 numeric; np int; vp numeric;
BEGIN
  SELECT sum(amount) FILTER (WHERE competence_month LIKE '2023%'), sum(amount) FILTER (WHERE competence_month LIKE '2024%'), sum(amount) FILTER (WHERE competence_month LIKE '2025%')
    INTO t23, t24, t25 FROM ar_entries WHERE description LIKE 'DIMOB-B-03%' AND deleted_at IS NULL;
  SELECT count(*), sum(p.amount) INTO np, vp FROM ar_payments p JOIN ar_entries a ON a.id = p.ar_entry_id WHERE a.description LIKE 'DIMOB-B-03%';
  IF t23 <> 130000 OR t24 <> 36000 OR t25 <> 98040 OR np <> 7 OR vp <> 264040 THEN
    RAISE EXCEPTION 'Conferencia divergente: % / % / %, pagamentos % = % - desfeito', t23, t24, t25, np, vp;
  END IF;
END $$;
COMMIT;

\echo == Conferencia ==
SELECT rc.contract_number, rc.instrument_date, rc.start_date, rc.end_date, rc.rent_amount, rc.status,
       a.competence_month, a.amount, (SELECT count(*) FROM ar_payments p WHERE p.ar_entry_id = a.id) AS pagamentos
FROM rental_contracts rc JOIN ar_entries a ON a.rental_contract_id = rc.id
WHERE rc.company_id = :'cid' AND rc.contract_number = '200002' AND a.deleted_at IS NULL ORDER BY a.competence_month;
\echo == Total dos alugueis por ano (todos os titulos DIMOB) ==
SELECT left(competence_month, 4) AS ano, sum(amount) AS aluguel, sum(commission_amount) AS comissao
FROM ar_entries WHERE company_id = :'cid' AND deleted_at IS NULL AND origin::text = 'ALUGUEL' AND status::text = 'RECEIVED'
  AND rental_contract_id IS NOT NULL AND competence_month BETWEEN '2023-01' AND '2025-12' GROUP BY 1 ORDER BY 1;