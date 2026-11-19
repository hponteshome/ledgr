-- 2026-11-19_lm_dimob_curitiba_2023.sql
-- DIMOB-B-04 (19/11/2026) - LM: Curitiba (Quatro Ventos/Galvao) ago-dez/2023, pelo informe IR 2023 da imobiliaria (emitido 18/11/2026).
-- North York (40148.001) tinha outro inquilino em 2023: Augusto Araujo de Oms (contrato 15/08/2014) - contrato 40148.001.03 criado.
-- Titulos com aluguel e comissao do informe (comissao inclui a taxa de intermediacao, como em 2024-2025); repasses do extrato rateados
-- pelo liquido do mes entre os dois contratos. Repasse de 10/01/2024 (6.454,00) ligado ao titulo 2024-01 do 40148.002 (mes do repasse).
\set ON_ERROR_STOP on
BEGIN;
SELECT id AS cid FROM companies WHERE tax_id = '17970759000108' \gset

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM rental_contracts WHERE contract_number = '40148.001.03' AND deleted_at IS NULL
             AND company_id = (SELECT id FROM companies WHERE tax_id = '17970759000108')) THEN
    RAISE EXCEPTION 'Contrato 40148.001.03 ja existe (DIMOB-B-04 ja aplicado?) - nada alterado';
  END IF;
  IF (SELECT count(*) FROM fixed_assets WHERE id = 'a8f527e9-0527-498e-8b75-b336c334d483') <> 1 THEN
    RAISE EXCEPTION 'Imovel NorthYork nao encontrado - nada alterado';
  END IF;
END $$;

INSERT INTO rental_contracts (company_id, contract_number, fixed_asset_id, tenant_name, tenant_tax_id,
  instrument_date, start_date, end_date, rent_amount, due_periodicity, due_day, first_due_date,
  has_intermediary, intermediary_name, intermediary_tax_id, intermediary_manages_collection, status, lastro_ressalva, notes, created_by_id)
VALUES (:'cid', '40148.001.03', 'a8f527e9-0527-498e-8b75-b336c334d483', 'AUGUSTO ARAUJO DE OMS', '04346370926',
  DATE '2014-08-15', DATE '2014-08-15', DATE '2024-01-31', 5063.68, 'MENSAL', 10, DATE '2023-08-10',
  true, 'QUATRO VENTOS ADMINISTRACAO DE IMOVEIS LTDA', '76522135000189', true, 'ENCERRADO',
  'Contrato de 15/08/2014 firmado antes da LM; dados (inquilino, CPF, data do contrato, aluguel e comissao de ago-dez/2023) do informe IR 2023 da Quatro Ventos (Galvao Locacoes), emitido em 18/11/2026. Termino nao informado: inquilino substituido por Diogo Gabriel Lovato (40148.001) em 01/02/2024.',
  'Codigo na imobiliaria: 40148.001.03. Vencimento e 1o vencimento sob a LM pelos repasses (dia 10, a partir de ago/2023).',
  '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid);

CREATE TEMP TABLE b4 (contrato varchar, comp char(7), aluguel numeric(15,2), comissao numeric(15,2), je uuid, parcela numeric(15,2)) ON COMMIT DROP;
INSERT INTO b4 VALUES
  ('40148.001.03', '2023-08', 5063.68, 514.31, 'bfcac29d-3966-43d3-9cad-aff9e88c8b8e', 3234.40),
  ('40148.002',    '2023-08', 2878.72, 572.39, 'bfcac29d-3966-43d3-9cad-aff9e88c8b8e', 1639.70),
  ('40148.001.03', '2023-09', 5063.68, 514.31, '120dcd26-55fd-4d76-8bdf-0d23c8451755', 4789.73),
  ('40148.002',    '2023-09', 2878.72, 584.95, '120dcd26-55fd-4d76-8bdf-0d23c8451755', 2414.96),
  ('40148.001.03', '2023-10', 5063.68, 515.05, 'eedb8766-12d6-43e0-82eb-b0e9f91487c4', 4931.73),
  ('40148.002',    '2023-10', 2878.72, 575.96, 'eedb8766-12d6-43e0-82eb-b0e9f91487c4', 2496.70),
  ('40148.001.03', '2023-11', 5063.68, 515.05, '93ce5cad-a60f-4a1c-82af-4a2752468611', 4856.81),
  ('40148.002',    '2023-11', 2878.72, 578.26, '93ce5cad-a60f-4a1c-82af-4a2752468611', 2456.32),
  ('40148.001.03', '2023-12', 5063.68, 515.05, '70da2e92-029a-4497-875c-ab10882c7946', 2201.43),
  ('40148.002',    '2023-12', 3150.00, 1739.53, '70da2e92-029a-4497-875c-ab10882c7946', 682.63);

CREATE TEMP TABLE b4r ON COMMIT DROP AS
SELECT b.*, rc.id AS contrato_id, rc.tenant_name, rc.tenant_tax_id, rc.fixed_asset_id, je.date AS data, i.value AS valor_extrato,
       left(coalesce(nullif(i.description, ''), je.description), 200) AS historico
FROM b4 b
JOIN rental_contracts rc ON rc.company_id = :'cid' AND rc.contract_number = b.contrato AND rc.deleted_at IS NULL
JOIN journal_entries je ON je.id = b.je AND je.company_id = :'cid' AND je.deleted_at IS NULL
JOIN journal_entry_items i ON i.journal_entry_id = je.id AND i.account_id = '90593c1e-495e-4403-91b0-5911df855c86'::uuid AND i.type = 'CREDIT';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM b4r;
  IF n <> 10 THEN RAISE EXCEPTION 'Esperado 10 linhas, encontrado % - nada alterado', n; END IF;
  SELECT count(*) INTO n FROM (SELECT je, max(valor_extrato) v, sum(parcela) s FROM b4r GROUP BY je) x WHERE v <> s;
  IF n > 0 THEN RAISE EXCEPTION '% repasses com rateio diferente do extrato - nada alterado', n; END IF;
  SELECT count(*) INTO n FROM ar_entries a WHERE a.journal_entry_id IN (SELECT je FROM b4) AND a.deleted_at IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'Repasses de 2023 ja ligados a % titulos - nada alterado', n; END IF;
END $$;

INSERT INTO ar_entries (company_id, title, description, origin, issue_date, due_date, received_at, competence_month,
  amount, received_amount, status, bank_account, customer_name, customer_cnpj_cpf, fixed_asset_id, journal_entry_id,
  revenue_account_id, rental_contract_id, commission_amount, commission_payee_type, commission_payee_name, commission_payee_tax_id,
  commission_paid_by, commission_paid_at, notes, created_by_id)
SELECT :'cid'::uuid, 'Aluguel ' || d.contrato || ' - ' || d.comp,
       'DIMOB-B-04 - Curitiba (Quatro Ventos) 2023: aluguel e comissao do informe IR 2023 da imobiliaria; repasse do extrato rateado pelo liquido',
       'ALUGUEL', (d.comp || '-01')::date, (d.comp || '-01')::date, d.data, d.comp, d.aluguel, d.parcela, 'RECEIVED',
       'Bradesco ag 133 c/c 15049-5', d.tenant_name, d.tenant_tax_id, d.fixed_asset_id, d.je,
       '90593c1e-495e-4403-91b0-5911df855c86'::uuid, d.contrato_id, d.comissao, 'PJ', 'QUATRO VENTOS ADMINISTRACAO DE IMOVEIS LTDA', '76522135000189', 'LOCADORA', d.data,
       'Liquido do informe ' || replace(to_char(d.aluguel - d.comissao, 'FM999999990.00'), '.', ',') || '; parte do repasse de ' || to_char(d.data, 'DD/MM/YYYY')
       || ' = ' || replace(to_char(d.parcela, 'FM999999990.00'), '.', ',') || '; diferenca ' || replace(to_char(d.aluguel - d.comissao - d.parcela, 'FM999999990.00'), '.', ',')
       || ' = outros descontos/acrescimos ou defasagem de repasse da imobiliaria, a documentar (ALERTA-DIMOB-03).'
       || CASE WHEN d.contrato = '40148.002' AND d.comp = '2023-12' THEN ' Comissao inclui taxa de intermediacao de 787,50.' ELSE '' END,
       '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM b4r d;

INSERT INTO ar_payments (ar_entry_id, received_at, amount, payment_method, bank_account, receipt_ref, notes, created_by_id)
SELECT a.id, d.data, d.parcela, 'PIX', 'Bradesco ag 133 c/c 15049-5', 'JE ' || d.je,
       'Parte do repasse (' || replace(to_char(d.valor_extrato, 'FM999999990.00'), '.', ',') || ') rateado pelo liquido do informe: ' || d.historico, '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM b4r d JOIN ar_entries a ON a.rental_contract_id = d.contrato_id AND a.competence_month = d.comp AND a.deleted_at IS NULL;

-- Repasse de 10/01/2024 (6.454,00): ligado ao titulo 2024-01 do 40148.002 (DIMOB-B-02), que estava sem repasse
DO $$
DECLARE t uuid; v numeric; dt date; h text; n int;
BEGIN
  SELECT i.value, je.date, left(coalesce(nullif(i.description, ''), je.description), 200) INTO v, dt, h
    FROM journal_entries je JOIN journal_entry_items i ON i.journal_entry_id = je.id AND i.type = 'CREDIT' AND i.account_id = '90593c1e-495e-4403-91b0-5911df855c86'
   WHERE je.id = '721e1fd5-2cbc-40b2-8084-49c4706f97bd' AND je.deleted_at IS NULL;
  IF v IS DISTINCT FROM 6454.00 THEN RAISE EXCEPTION 'Repasse de 10/01/2024 nao encontrado (%) - desfeito', v; END IF;
  SELECT a.id INTO t FROM ar_entries a JOIN rental_contracts rc ON rc.id = a.rental_contract_id
   WHERE rc.contract_number = '40148.002' AND a.competence_month = '2024-01' AND a.deleted_at IS NULL AND a.description LIKE 'DIMOB-B-02%'
     AND coalesce(a.received_amount, 0) = 0 AND a.journal_entry_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Titulo 2024-01 do 40148.002 sem repasse nao encontrado (%) - desfeito', n; END IF;
  UPDATE ar_entries SET received_amount = v, received_at = dt, journal_entry_id = '721e1fd5-2cbc-40b2-8084-49c4706f97bd', bank_account = 'Bradesco ag 133 c/c 15049-5',
         commission_paid_at = dt,
         notes = 'Liquido do comprovante 2.036,74; repasse de 10/01/2024 = 6.454,00 (inclui provavel complemento do repasse de dez/2023, que veio 3.075,04 abaixo do liquido do informe); diferenca -4.417,26 a documentar com a imobiliaria (ALERTA-DIMOB-03). DIMOB-B-04.',
         updated_at = now()
   WHERE id = t;
  INSERT INTO ar_payments (ar_entry_id, received_at, amount, payment_method, bank_account, receipt_ref, notes, created_by_id)
  VALUES (t, dt, v, 'PIX', 'Bradesco ag 133 c/c 15049-5', 'JE 721e1fd5-2cbc-40b2-8084-49c4706f97bd', h, '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid);
END $$;

DO $$
DECLARE al numeric; co numeric; p numeric;
BEGIN
  SELECT sum(amount), sum(commission_amount) INTO al, co FROM ar_entries WHERE description LIKE 'DIMOB-B-04%' AND deleted_at IS NULL;
  SELECT sum(p.amount) INTO p FROM ar_payments p JOIN ar_entries a ON a.id = p.ar_entry_id WHERE a.description LIKE 'DIMOB-B-04%';
  IF al <> 39983.28 OR co <> 6624.86 OR p <> 29704.41 THEN
    RAISE EXCEPTION 'Totais divergentes: aluguel % (39.983,28), comissao % (6.624,86), repasses % (29.704,41) - desfeito', al, co, p;
  END IF;
END $$;

-- Alerta da pendencia de Curitiba 2023: resolvido
UPDATE company_alerts SET resolved_at = now(),
       resolution_note = 'Informe IR 2023 da Quatro Ventos recebido em 19/11/2026: Curitiba ago-dez/2023 lancado (DIMOB-B-04). Aluguel 39.983,28; comissao 6.624,86.'
 WHERE company_id = :'cid' AND resolved_at IS NULL AND title LIKE 'DIMOB 2023: falta Curitiba%';
COMMIT;

\echo == Curitiba 2023 por contrato ==
SELECT rc.contract_number AS contrato, rc.tenant_name, count(*) AS titulos, sum(a.amount) AS aluguel, sum(a.commission_amount) AS comissao,
       sum(a.amount - a.commission_amount) AS liquido_informe, sum(a.received_amount) AS repasses_extrato
FROM ar_entries a JOIN rental_contracts rc ON rc.id = a.rental_contract_id
WHERE a.description LIKE 'DIMOB-B-04%' AND a.deleted_at IS NULL
GROUP BY ROLLUP ((rc.contract_number, rc.tenant_name)) ORDER BY 1 NULLS LAST;
\echo == DIMOB 2023: aluguel e comissao por contrato (titulos recebidos de 2023) ==
SELECT rc.contract_number AS contrato, sum(a.amount) AS aluguel, sum(coalesce(a.commission_amount, 0)) AS comissao
FROM ar_entries a JOIN rental_contracts rc ON rc.id = a.rental_contract_id
WHERE a.company_id = :'cid' AND a.deleted_at IS NULL AND a.status = 'RECEIVED' AND a.origin = 'ALUGUEL' AND a.competence_month LIKE '2023%'
GROUP BY ROLLUP (rc.contract_number) ORDER BY 1 NULLS LAST;
\echo == alertas DIMOB abertos ==
SELECT left(title, 80) AS alerta FROM company_alerts WHERE company_id = :'cid' AND resolved_at IS NULL AND (title ILIKE '%DIMOB%' OR title ILIKE '%ECF%');