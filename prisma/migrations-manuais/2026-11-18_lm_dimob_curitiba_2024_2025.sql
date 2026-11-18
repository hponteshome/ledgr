-- DIMOB-B-02 (18/11/2026) - LM: Curitiba (Quatro Ventos) 2024-2025 - titulos por contrato e mes do comprovante da imobiliaria
-- (aluguel bruto e comissao = DIMOB da imobiliaria); cada repasse do extrato rateado entre North York e Ecoville pelo liquido do mes,
-- partes somando exatamente o lancamento do extrato. Repasse de jan/2024 (6.454,00) e 2023 aguardam o demonstrativo de 2023.
\set ON_ERROR_STOP on
BEGIN;
SELECT id AS cid FROM companies WHERE tax_id = '17970759000108' \gset

CREATE TEMP TABLE b2 (contrato varchar, comp char(7), aluguel numeric(15,2), comissao numeric(15,2), je uuid, parcela numeric(15,2)) ON COMMIT DROP;
INSERT INTO b2 VALUES
  ('40148.002', '2024-01', 3150, 1113.26, NULL::uuid, 0),
  ('40148.002', '2024-02', 3150, 593.41, NULL::uuid, 0),
  ('40148.001', '2024-03', 5500, 3181.25, '98419be9-dbfc-4ab3-b099-56b138642ce4'::uuid, 460.66),
  ('40148.002', '2024-03', 3150, 552.15, '98419be9-dbfc-4ab3-b099-56b138642ce4'::uuid, 516.10),
  ('40148.001', '2024-04', 5500, 3181.25, 'f6fd8254-b4a9-45e2-b080-2b5d7e40b9c3'::uuid, 2717.03),
  ('40148.002', '2024-04', 3150, 583.19, 'f6fd8254-b4a9-45e2-b080-2b5d7e40b9c3'::uuid, 3007.70),
  ('40148.001', '2024-05', 5500, 706.25, '4fe4216a-9e7c-4ad4-8ef7-275fba1d9979'::uuid, 4807.25),
  ('40148.002', '2024-05', 3150, 590.52, '4fe4216a-9e7c-4ad4-8ef7-275fba1d9979'::uuid, 2566.69),
  ('40148.001', '2024-06', 5500, 706.25, 'ba38e58c-17b5-4898-aaa1-9c7f492260ec'::uuid, 4788.31),
  ('40148.002', '2024-06', 3150, 623.90, 'ba38e58c-17b5-4898-aaa1-9c7f492260ec'::uuid, 2523.23),
  ('40148.001', '2024-07', 5500, 727.43, 'e7d681c5-f430-440b-b42f-8b511b8ae62f'::uuid, 4837.61),
  ('40148.002', '2024-07', 3150, 625.33, 'e7d681c5-f430-440b-b42f-8b511b8ae62f'::uuid, 2559.07),
  ('40148.001', '2024-08', 5500, 706.25, 'b42722e1-16e8-4952-88c4-e54edfc9e88c'::uuid, 3791.77),
  ('40148.002', '2024-08', 3150, 580.95, 'b42722e1-16e8-4952-88c4-e54edfc9e88c'::uuid, 2032.08),
  ('40148.001', '2024-09', 5500, 756.47, 'c26c8a47-7f76-465e-8041-579f8130b8d4'::uuid, 4427.12),
  ('40148.002', '2024-09', 3150, 612.29, 'c26c8a47-7f76-465e-8041-579f8130b8d4'::uuid, 2368.44),
  ('40148.001', '2024-10', 5500, 757.25, '8fcda754-4b27-4742-951f-3ebc06a67cb5'::uuid, 4786.12),
  ('40148.002', '2024-10', 3150, 588.16, '8fcda754-4b27-4742-951f-3ebc06a67cb5'::uuid, 2585.27),
  ('40148.001', '2024-11', 5500, 757.25, 'b7022060-438e-4266-b5ee-e84a456c2991'::uuid, 4530.52),
  ('40148.002', '2024-11', 3150, 603.33, 'b7022060-438e-4266-b5ee-e84a456c2991'::uuid, 2432.71),
  ('40148.001', '2024-12', 5500, 757.25, 'd289cee8-6607-4edf-b6ed-ddac7a7a1d57'::uuid, 4619.78),
  ('40148.002', '2024-12', 3326.08, 621.78, 'd289cee8-6607-4edf-b6ed-ddac7a7a1d57'::uuid, 2634.19),
  ('40148.001', '2025-01', 5500, 757.25, '16a57053-4a59-478f-aebe-1566e72362d7'::uuid, 3994.49),
  ('40148.002', '2025-01', 3326.08, 638.13, '16a57053-4a59-478f-aebe-1566e72362d7'::uuid, 2263.88),
  ('40148.001', '2025-02', 5500, 738.88, 'bdf1a8c2-6ade-4671-b4ea-5456dfc6be0f'::uuid, 4553.35),
  ('40148.002', '2025-02', 3326.08, 588.34, 'bdf1a8c2-6ade-4671-b4ea-5456dfc6be0f'::uuid, 2618.27),
  ('40148.001', '2025-03', 5871.25, 762.49, '1134f99c-5d7a-451b-af67-4afe080a9e76'::uuid, 5280.90),
  ('40148.002', '2025-03', 3326.08, 616.31, '1134f99c-5d7a-451b-af67-4afe080a9e76'::uuid, 2801.07),
  ('40148.001', '2025-04', 5871.25, 784.09, '1543563e-af2d-4a10-820f-05df57ed9644'::uuid, 5419.65),
  ('40148.002', '2025-04', 3326.08, 581.50, '1543563e-af2d-4a10-820f-05df57ed9644'::uuid, 2923.96),
  ('40148.001', '2025-05', 5871.25, 872.27, '07e62977-d2c0-4eca-96d5-a3f87438fc67'::uuid, 3144.01),
  ('40148.002', '2025-05', 3326.08, 800.51, '07e62977-d2c0-4eca-96d5-a3f87438fc67'::uuid, 1588.41),
  ('40148.001', '2025-06', 5871.25, 825.17, 'fb9f2eff-f90e-4e2b-987e-c8c5f73f4d8e'::uuid, 4313.73),
  ('40148.002', '2025-06', 3326.08, 711.79, 'fb9f2eff-f90e-4e2b-987e-c8c5f73f4d8e'::uuid, 2234.87),
  ('40148.001', '2025-07', 5871.25, 825.17, '03aba22a-c705-4658-803c-d1cd744d4239'::uuid, 4941.88),
  ('40148.002', '2025-07', 3326.08, 668.80, '03aba22a-c705-4658-803c-d1cd744d4239'::uuid, 2602.41),
  ('40148.001', '2025-08', 5871.25, 817.53, 'b103e706-bcdc-42dd-9782-25cc0058c358'::uuid, 2942.91),
  ('40148.002', '2025-08', 3326.08, 742.13, 'b103e706-bcdc-42dd-9782-25cc0058c358'::uuid, 1504.70),
  ('40148.001', '2025-09', 5871.25, 819.92, '58aa1cd5-0faa-4031-bd51-68b2a4a86bfb'::uuid, 4634.28),
  ('40148.002', '2025-09', 3326.08, 733.05, '58aa1cd5-0faa-4031-bd51-68b2a4a86bfb'::uuid, 2378.94),
  ('40148.001', '2025-10', 5871.25, 809.69, 'a9f019f0-b9f0-43a9-afd1-c206ca3d8e48'::uuid, 4761.43),
  ('40148.002', '2025-10', 3326.08, 735.10, 'a9f019f0-b9f0-43a9-afd1-c206ca3d8e48'::uuid, 2437.35),
  ('40148.001', '2025-11', 5871.25, 809.69, '8d342ed8-7820-4d40-80a7-7b88a6e8d31a'::uuid, 4706.87),
  ('40148.002', '2025-11', 3326.08, 717.92, '8d342ed8-7820-4d40-80a7-7b88a6e8d31a'::uuid, 2425.39),
  ('40148.001', '2025-12', 5871.25, 825.62, '35b40905-c0bf-4551-a3b7-904d465abdf5'::uuid, 4355.37),
  ('40148.002', '2025-12', 3356.68, 766.58, '35b40905-c0bf-4551-a3b7-904d465abdf5'::uuid, 2235.76);

CREATE TEMP TABLE b2r ON COMMIT DROP AS
SELECT b.*, rc.id AS contrato_id, rc.tenant_name, rc.tenant_tax_id, rc.fixed_asset_id, je.date AS data, i.value AS valor_extrato,
       left(coalesce(nullif(i.description, ''), je.description), 200) AS historico
FROM b2 b
JOIN rental_contracts rc ON rc.company_id = :'cid' AND rc.contract_number = b.contrato AND rc.deleted_at IS NULL
LEFT JOIN journal_entries je ON je.id = b.je AND je.company_id = :'cid' AND je.deleted_at IS NULL
LEFT JOIN journal_entry_items i ON i.journal_entry_id = je.id AND i.account_id = '90593c1e-495e-4403-91b0-5911df855c86'::uuid AND i.type = 'CREDIT';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM b2r;
  IF n <> 46 THEN RAISE EXCEPTION 'Esperado 46 linhas, encontrado % - nada alterado', n; END IF;
  SELECT count(*) INTO n FROM b2r WHERE je IS NOT NULL AND valor_extrato IS NULL;
  IF n > 0 THEN RAISE EXCEPTION '% repasses nao encontrados no diario - nada alterado', n; END IF;
  SELECT count(*) INTO n FROM (SELECT je, max(valor_extrato) v, sum(parcela) s FROM b2r WHERE je IS NOT NULL GROUP BY je) x WHERE v <> s;
  IF n > 0 THEN RAISE EXCEPTION '% repasses com rateio diferente do extrato - nada alterado', n; END IF;
  SELECT count(*) INTO n FROM ar_entries a JOIN b2r d ON a.rental_contract_id = d.contrato_id AND a.competence_month = d.comp WHERE a.deleted_at IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'Ja existem % titulos nas mesmas competencias (DIMOB-B-02 ja aplicado?) - nada alterado', n; END IF;
END $$;

INSERT INTO ar_entries (company_id, title, description, origin, issue_date, due_date, received_at, competence_month,
  amount, received_amount, status, bank_account, customer_name, customer_cnpj_cpf, fixed_asset_id, journal_entry_id,
  revenue_account_id, rental_contract_id, commission_amount, commission_payee_type, commission_payee_name, commission_payee_tax_id,
  commission_paid_by, commission_paid_at, notes, created_by_id)
SELECT :'cid'::uuid, 'Aluguel ' || d.contrato || ' - ' || d.comp,
       'DIMOB-B-02 - Curitiba (Quatro Ventos): aluguel e comissao do comprovante anual da imobiliaria; repasse do extrato rateado pelo liquido',
       'ALUGUEL', (d.comp || '-01')::date, (d.comp || '-01')::date, d.data, d.comp, d.aluguel, d.parcela, 'RECEIVED',
       CASE WHEN d.je IS NOT NULL THEN 'Bradesco ag 133 c/c 15049-5' END, d.tenant_name, d.tenant_tax_id, d.fixed_asset_id, d.je,
       '90593c1e-495e-4403-91b0-5911df855c86'::uuid, d.contrato_id, d.comissao, 'PJ', 'QUATRO VENTOS ADMINISTRACAO DE IMOVEIS LTDA', '76522135000189', 'LOCADORA', d.data,
       CASE WHEN d.je IS NULL THEN
         'Liquido do comprovante ' || replace(to_char(d.aluguel - d.comissao, 'FM999999990.00'), '.', ',') || '; sem repasse ligado neste mes'
         || CASE WHEN d.comp = '2024-01' THEN ' (repasse de 10/01/2024, 6.454,00, aguarda o demonstrativo de 2023)' ELSE ' (nao ha repasse no extrato em ' || d.comp || ')' END
         || ' - ALERTA-DIMOB-03.'
       ELSE
         'Liquido do comprovante ' || replace(to_char(d.aluguel - d.comissao, 'FM999999990.00'), '.', ',') || '; parte do repasse de ' || to_char(d.data, 'DD/MM/YYYY')
         || ' = ' || replace(to_char(d.parcela, 'FM999999990.00'), '.', ',') || '; diferenca ' || replace(to_char(d.aluguel - d.comissao - d.parcela, 'FM999999990.00'), '.', ',')
         || ' = outros descontos/acrescimos da imobiliaria, a documentar (ALERTA-DIMOB-03).'
       END,
       '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM b2r d;

INSERT INTO ar_payments (ar_entry_id, received_at, amount, payment_method, bank_account, receipt_ref, notes, created_by_id)
SELECT a.id, d.data, d.parcela, 'PIX', 'Bradesco ag 133 c/c 15049-5', 'JE ' || d.je,
       'Parte do repasse (' || replace(to_char(d.valor_extrato, 'FM999999990.00'), '.', ',') || ') rateado pelo liquido do comprovante: ' || d.historico, '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM b2r d JOIN ar_entries a ON a.rental_contract_id = d.contrato_id AND a.competence_month = d.comp AND a.deleted_at IS NULL
WHERE d.je IS NOT NULL;

DO $$
DECLARE a24 numeric; a25 numeric; c24 numeric; c25 numeric; p numeric; e numeric;
BEGIN
  SELECT sum(amount) FILTER (WHERE competence_month LIKE '2024%'), sum(amount) FILTER (WHERE competence_month LIKE '2025%'),
         sum(commission_amount) FILTER (WHERE competence_month LIKE '2024%'), sum(commission_amount) FILTER (WHERE competence_month LIKE '2025%')
    INTO a24, a25, c24, c25 FROM ar_entries WHERE description LIKE 'DIMOB-B-02%' AND deleted_at IS NULL;
  IF a24 <> 92976.08 OR a25 <> 109656.06 OR c24 <> 19925.17 OR c25 <> 17947.93 THEN
    RAISE EXCEPTION 'Totais divergentes do comprovante: aluguel % / %, comissao % / % - desfeito', a24, a25, c24, c25;
  END IF;
  SELECT sum(p.amount) INTO p FROM ar_payments p JOIN ar_entries a ON a.id = p.ar_entry_id WHERE a.description LIKE 'DIMOB-B-02%';
  SELECT sum(x.v) INTO e FROM (SELECT DISTINCT je, valor_extrato v FROM b2r WHERE je IS NOT NULL) x;
  IF p <> e OR p <> 144055.53 THEN RAISE EXCEPTION 'Pagamentos % diferentes do extrato % - desfeito', p, e; END IF;
END $$;
COMMIT;

\echo == Curitiba por ano e contrato ==
SELECT left(a.competence_month, 4) AS ano, rc.contract_number AS contrato, count(*) AS titulos, sum(a.amount) AS aluguel,
       sum(a.commission_amount) AS comissao, sum(a.amount - a.commission_amount) AS liquido_comprovante, sum(a.received_amount) AS repasses_extrato,
       sum(a.amount - a.commission_amount - a.received_amount) AS diferenca
FROM ar_entries a JOIN rental_contracts rc ON rc.id = a.rental_contract_id
WHERE a.description LIKE 'DIMOB-B-02%' AND a.deleted_at IS NULL
GROUP BY ROLLUP (1, 2) ORDER BY 1 NULLS LAST, 2 NULLS LAST;