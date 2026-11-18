-- DIMOB-B-01 (18/11/2026) - LM: titulos recebidos 2023-2025 por contrato e mes, pagamentos = lancamentos do extrato (diario/ECD)
-- Fora deste bloco: Curitiba (40148.001/002 - bruto x repasse) e LoftSP contrato de 2020 (a cadastrar); Las Piedras, caucoes e reembolsos nao sao aluguel.
\set ON_ERROR_STOP on
BEGIN;
SELECT id AS cid FROM companies WHERE tax_id = '17970759000108' \gset

CREATE TEMP TABLE dimob_map (je uuid, contrato varchar, comp char(7), metodo varchar) ON COMMIT DROP;
INSERT INTO dimob_map VALUES
  ('8e0a9989-20e3-4462-81b6-86fea4aabacf'::uuid, '220002', '2023-02', 'PIX'),
  ('dab81a29-3800-487b-abfc-2f2853adc66c'::uuid, '220002', '2023-03', 'TED'),
  ('a843619c-c713-4b61-8577-9d85f41aef1d'::uuid, '220002', '2023-04', 'TED'),
  ('e82c913c-6252-4940-a1a3-0299cc73caf9'::uuid, '200001', '2023-03', 'PIX'),
  ('8247764e-a350-4157-8d36-92178873384f'::uuid, '200001', '2023-03', 'PIX'),
  ('1cdcb18c-b785-4001-a543-a12789fe7963'::uuid, '200001', '2023-04', 'PIX'),
  ('2f2962f7-9def-4d03-8ff0-8a759bbf68a4'::uuid, '200001', '2023-05', 'PIX'),
  ('da4519f4-3a23-408e-9550-bd2dd846e7a0'::uuid, '200001', '2023-05', 'PIX'),
  ('3fb7e288-a857-45df-acb9-2270745a2c65'::uuid, '200001', '2023-06', 'PIX'),
  ('92d333dc-7f88-478f-99d1-a494b4aa894e'::uuid, '220001', '2023-03', 'TED'),
  ('7c2f68c9-827b-44ed-b8fb-4071be62d0b9'::uuid, '220001', '2023-04', 'TED'),
  ('128fddbd-754f-4a65-b231-dee065e12311'::uuid, '220001', '2023-05', 'TED'),
  ('1100ea6d-6a5e-4080-befa-8fb31ae4d666'::uuid, '220001', '2023-06', 'TED'),
  ('0e2b2a61-8a5b-40fb-b8e3-a6cfda5401b9'::uuid, '220001', '2023-07', 'TED'),
  ('8da66a5d-5b29-4e70-843a-19ece15a391d'::uuid, '220001', '2023-08', 'TED'),
  ('f4a6a9ff-f9be-4e2d-b783-47f26a74e0c7'::uuid, '220001', '2023-09', 'TED'),
  ('15a07fb0-0299-4ede-89fb-e44801d71f6b'::uuid, '220001', '2023-10', 'TED'),
  ('e6bc63c8-da10-4ca0-b8b1-b226baeeb796'::uuid, '220001', '2023-11', 'TED'),
  ('81355bd5-ea64-4675-a5f1-8ca587d54382'::uuid, '220001', '2023-12', 'TED'),
  ('7d588ae7-af61-40d4-8225-64b671273ad5'::uuid, '220001', '2024-01', 'TED'),
  ('2e175f54-d014-421d-92bb-73889851168f'::uuid, '220001', '2024-02', 'TED'),
  ('6f2bbfe8-a23f-49c6-8358-092c2933159a'::uuid, '220001', '2024-03', 'TED'),
  ('1d24c3ac-9529-4668-b3fb-a6484648c9e3'::uuid, '220001', '2024-04', 'TED'),
  ('bf4004bc-5c05-44cd-95ed-6f2825d90b13'::uuid, '220001', '2024-05', 'TED'),
  ('55aa0b92-9966-456a-95ca-4ec55b7ca48d'::uuid, '220001', '2024-06', 'TED'),
  ('e385cc2c-90ef-4251-9a4d-e05807310cd1'::uuid, '220001', '2024-07', 'TED'),
  ('5c9f82dc-a618-41f7-896c-a2a7a24d0221'::uuid, '220001', '2024-08', 'TED'),
  ('4a98429c-f06c-4d6e-b8e9-4fc2992119f6'::uuid, '220001', '2024-09', 'TED'),
  ('f3242039-001c-4fe3-b72c-0a8a24d0c494'::uuid, '220001', '2024-10', 'TED'),
  ('740161cc-305d-4800-bf66-20d68b67936a'::uuid, '220001', '2024-11', 'TED'),
  ('073051d6-e81b-439d-9c62-2cb7ba5998a0'::uuid, '220001', '2024-12', 'TED'),
  ('a4260013-2135-4c9c-9beb-f4604aac768c'::uuid, '220001', '2025-01', 'TED'),
  ('2586811f-45c8-4506-a891-1b0fe93be964'::uuid, '220001', '2025-02', 'TED'),
  ('e456796a-04af-4134-917c-89854783c0b0'::uuid, '220001', '2025-03', 'TED'),
  ('7af57d7c-4d9a-4f7e-986f-07717ce6d048'::uuid, '220001', '2025-04', 'TED'),
  ('a8821b68-57d4-4ae3-a938-19494c088a07'::uuid, '220001', '2025-05', 'TED'),
  ('e9848a37-548f-4f2d-9cae-0d8e0e56f2c3'::uuid, '220001', '2025-06', 'TED'),
  ('2a9ddb0a-745c-41f2-98c2-90ec4c0e0539'::uuid, '250003', '2025-07', 'TED'),
  ('ca0cf57a-315d-493b-88c8-efffa71edf2d'::uuid, '250003', '2025-08', 'TED'),
  ('575524d2-164a-45be-a0aa-98ad0a6abc9b'::uuid, '250003', '2025-09', 'TED'),
  ('8292686e-31f2-4770-8025-b7e865d10c6f'::uuid, '250003', '2025-10', 'TED'),
  ('6e86332e-d7cc-4709-be94-07cef67c60d8'::uuid, '250003', '2025-11', 'TED'),
  ('0fa212a2-89d8-4b38-909b-e1c965c4947c'::uuid, '250003', '2025-12', 'TED'),
  ('1073f708-5618-473c-bfa8-eba05b66fc4b'::uuid, '230001', '2023-10', 'PIX'),
  ('8fbaef2e-39e1-451e-944b-a2ad005a22d0'::uuid, '230001', '2023-11', 'PIX'),
  ('204d9ebd-9b0b-4d6f-9054-a1ed9d8b9711'::uuid, '230001', '2023-12', 'PIX'),
  ('42eaeeac-2691-4a4d-931c-0eadf3606015'::uuid, '230001', '2024-01', 'PIX'),
  ('0e68a453-7a7c-468e-8d88-042844344180'::uuid, '230001', '2024-02', 'PIX'),
  ('72a55eb4-78fe-475b-9606-a29f41554ff7'::uuid, '230001', '2024-03', 'PIX'),
  ('02b8dce3-d90c-4d94-8dd2-b25a8ebfb960'::uuid, '240001', '2024-06', 'PIX'),
  ('6ed1af36-685f-44dc-8478-aea9ace97f8a'::uuid, '240001', '2024-06', 'PIX'),
  ('6b82df3f-7294-4a55-9585-a6182bcc3058'::uuid, '240001', '2024-07', 'PIX'),
  ('743e1190-28f1-4fa3-b84e-f2b8be08fcc2'::uuid, '240001', '2024-08', 'PIX'),
  ('6864dc3c-1089-4ce5-8976-9803092fa1c7'::uuid, '240001', '2024-09', 'PIX'),
  ('e2a07b6b-1c4b-413b-8070-2c3d9a2ce78d'::uuid, '240001', '2024-10', 'PIX'),
  ('b563cdfd-bbd5-42d9-8315-bf8925f3f06a'::uuid, '240001', '2024-11', 'PIX'),
  ('19157703-e7c4-49de-8ef2-253fddfa782d'::uuid, '240001', '2024-12', 'PIX'),
  ('71e0debb-8e9e-4545-a8e0-8aa7ff35f8d4'::uuid, '240001', '2025-01', 'PIX'),
  ('83f4ef0d-152f-4e1f-aed3-0688a62fad60'::uuid, '240001', '2025-02', 'PIX'),
  ('b9f3205b-7608-401e-a83e-db7eb339d22d'::uuid, '240001', '2025-03', 'PIX'),
  ('56055dce-9304-4839-bbc3-0be910458195'::uuid, '240001', '2025-04', 'PIX'),
  ('dba1a11f-b47d-4a42-9c91-d6d4c5338d4f'::uuid, '240001', '2025-05', 'PIX'),
  ('f7513f25-53e7-484b-80e7-d418e7672925'::uuid, '240001', '2025-06', 'PIX'),
  ('b19d06cf-50c7-495b-b13a-d54b2365e25c'::uuid, '240001', '2025-07', 'PIX'),
  ('99dd33c4-0127-4b3c-8873-1e308a00c2c6'::uuid, '240001', '2025-08', 'PIX'),
  ('abde36e9-c814-4a66-ad25-79e9976869de'::uuid, '240001', '2025-09', 'PIX'),
  ('6628fda0-5f8a-4a85-a3eb-d4c19027273c'::uuid, '240001', '2025-11', 'PIX'),
  ('73b65cd8-1336-4dfd-829f-c6654d6912cc'::uuid, '240002', '2025-01', 'PIX'),
  ('d4b74a04-45da-437a-b6eb-930885195200'::uuid, '240002', '2025-01', 'PIX'),
  ('61d18e05-b4b5-49e8-923d-3a759403f376'::uuid, '250004', '2025-02', 'TED'),
  ('6029c349-4302-41cf-810a-1cdb485c78d5'::uuid, '250002', '2025-11', 'TED'),
  ('0a6139c7-2a89-4415-9866-907cddd475bd'::uuid, '250002', '2025-11', 'TED'),
  ('aa0ba945-af71-4d07-9750-543d68b8a92b'::uuid, '250002', '2025-12', 'PIX'),
  ('4efcdb62-071f-4b64-9ace-61f45d4d5f82'::uuid, '250001', '2025-06', 'PIX'),
  ('b042ad3b-60ec-49ce-ab3f-e406b2cecbb9'::uuid, '250001', '2025-07', 'PIX'),
  ('95438a43-0180-48e8-85c4-b2c54b815605'::uuid, '250001', '2025-08', 'PIX'),
  ('d457d59e-7d03-4446-81eb-f4cfa5b41133'::uuid, '250001', '2025-09', 'PIX'),
  ('95857772-1b45-4ea3-a730-b4767ad9a3d7'::uuid, '250001', '2025-10', 'PIX'),
  ('7b464857-baa6-428f-a78a-a6aa73ba8b56'::uuid, '250001', '2025-11', 'PIX'),
  ('a8f3693c-ef07-4ad6-b760-2b7bcac53fe8'::uuid, '250001', '2025-12', 'PIX'),
  ('ec5a02d8-0180-447f-a3e9-d11601e2eb16'::uuid, 'Landmark-2025', '2025-10', 'PIX'),
  ('e420a00a-f62b-446a-97d5-e0b99d7ec82d'::uuid, 'Landmark-2025', '2025-11', 'PIX');

CREATE TEMP TABLE dimob_rec ON COMMIT DROP AS
SELECT m.*, je.date AS data, i.value AS valor, left(coalesce(nullif(i.description, ''), je.description), 200) AS historico,
       rc.id AS contrato_id, rc.tenant_name, rc.tenant_tax_id, rc.fixed_asset_id
FROM dimob_map m
JOIN journal_entries je ON je.id = m.je AND je.company_id = :'cid' AND je.deleted_at IS NULL
JOIN journal_entry_items i ON i.journal_entry_id = je.id AND i.account_id = '90593c1e-495e-4403-91b0-5911df855c86'::uuid AND i.type = 'CREDIT'
JOIN rental_contracts rc ON rc.company_id = :'cid' AND rc.contract_number = m.contrato AND rc.deleted_at IS NULL;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM dimob_rec;
  IF n <> 82 THEN RAISE EXCEPTION 'Esperado 82 lancamentos casados, encontrado % - nada alterado', n; END IF;
  SELECT count(*) INTO n FROM ar_entries WHERE description LIKE 'DIMOB-B-01%' AND deleted_at IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'DIMOB-B-01 ja aplicado (% titulos) - nada alterado', n; END IF;
  SELECT count(*) INTO n FROM ar_entries a JOIN (SELECT DISTINCT contrato_id, comp FROM dimob_rec) d
    ON a.rental_contract_id = d.contrato_id AND a.competence_month = d.comp WHERE a.deleted_at IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'Ja existem % titulos nas mesmas competencias - nada alterado', n; END IF;
END $$;

-- 1) Um titulo por contrato e mes do recebimento
INSERT INTO ar_entries (company_id, title, description, origin, issue_date, due_date, received_at, competence_month,
  amount, received_amount, status, bank_account, customer_name, customer_cnpj_cpf, fixed_asset_id, journal_entry_id,
  revenue_account_id, rental_contract_id, created_by_id)
SELECT :'cid'::uuid, 'Aluguel ' || d.contrato || ' - ' || d.comp,
       'DIMOB-B-01 - reconstrucao 2023-2025 pelo extrato Bradesco (diario = ECD); competencia = mes do recebimento',
       'ALUGUEL', min(d.data), min(d.data), max(d.data), d.comp, sum(d.valor), sum(d.valor), 'RECEIVED', 'Bradesco ag 133 c/c 15049-5',
       min(d.tenant_name), min(d.tenant_tax_id), (array_agg(d.fixed_asset_id))[1], (array_agg(d.je ORDER BY d.data))[1],
       '90593c1e-495e-4403-91b0-5911df855c86'::uuid, d.contrato_id, '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM dimob_rec d GROUP BY d.contrato_id, d.contrato, d.comp;

-- 2) Um pagamento por lancamento do extrato (valor e data identicos)
INSERT INTO ar_payments (ar_entry_id, received_at, amount, payment_method, bank_account, receipt_ref, notes, created_by_id)
SELECT a.id, d.data, d.valor, 'PIX', 'Bradesco ag 133 c/c 15049-5', 'JE ' || d.je, d.historico, '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM dimob_rec d JOIN ar_entries a ON a.rental_contract_id = d.contrato_id AND a.competence_month = d.comp AND a.deleted_at IS NULL
WHERE d.metodo = 'PIX';
INSERT INTO ar_payments (ar_entry_id, received_at, amount, payment_method, bank_account, receipt_ref, notes, created_by_id)
SELECT a.id, d.data, d.valor, 'TED', 'Bradesco ag 133 c/c 15049-5', 'JE ' || d.je, d.historico, '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM dimob_rec d JOIN ar_entries a ON a.rental_contract_id = d.contrato_id AND a.competence_month = d.comp AND a.deleted_at IS NULL
WHERE d.metodo = 'TED';

-- 3) 1o aluguel quitado pela comissao paga pelo locatario a imobiliaria (fora do extrato)
-- Vortex: soma ao titulo de 2025-10 (o extrato de out/2025 tem 10.641,03)
UPDATE ar_entries a SET amount = amount + 21500, received_amount = received_amount + 21500,
       commission_amount = 21500, commission_payee_type = 'PJ', commission_payee_name = 'FL BROKERS',
       commission_payee_tax_id = '08752053000170', commission_paid_by = 'LOCATARIO', commission_paid_at = DATE '2025-10-02',
       notes = '1o aluguel (21.500,00) quitado pela comissao paga pelo locatario a FL Brokers na assinatura (02/10/2025) - fora do extrato.'
FROM rental_contracts rc
WHERE a.rental_contract_id = rc.id AND rc.company_id = :'cid' AND rc.contract_number = 'Landmark-2025' AND a.competence_month = '2025-10'
  AND a.description LIKE 'DIMOB-B-01%';
-- Commodities: titulo proprio de 2025-10 (cl. VI.I: comissao de 12.000,00 a SJR na assinatura quita o periodo 13/10 a 12/11/2025)
INSERT INTO ar_entries (company_id, title, description, origin, issue_date, due_date, received_at, competence_month,
  amount, received_amount, status, customer_name, customer_cnpj_cpf, fixed_asset_id, revenue_account_id, rental_contract_id,
  commission_amount, commission_payee_type, commission_payee_name, commission_payee_tax_id, commission_paid_by, commission_paid_at, notes, created_by_id)
SELECT :'cid'::uuid, 'Aluguel Conj32-2025 - 2025-10',
       'DIMOB-B-01 - reconstrucao 2023-2025; 1o aluguel quitado pela comissao (fora do extrato)',
       'ALUGUEL', rc.instrument_date, rc.instrument_date, rc.instrument_date, '2025-10', 12000, 12000, 'RECEIVED',
       rc.tenant_name, rc.tenant_tax_id, rc.fixed_asset_id, '90593c1e-495e-4403-91b0-5911df855c86'::uuid, rc.id,
       12000, 'PJ', 'SJR IMOVEIS', '33927528000160', 'LOCATARIO', rc.instrument_date,
       'Cl. VI.I: comissao de intermediacao (1 aluguel) paga pelo locatario a SJR Imoveis no ato da assinatura, quitando o aluguel de 13/10 a 12/11/2025 - fora do extrato.', '421642c8-e981-49c9-996c-b4bfabc22b52'::uuid
FROM rental_contracts rc WHERE rc.company_id = :'cid' AND rc.contract_number = 'Conj32-2025' AND rc.deleted_at IS NULL;

-- 4) Comissao do Eliseu (PF, paga pela LM em 01/07/2025) no titulo de jul/2025 do Mare 88
UPDATE ar_entries a SET commission_amount = 5000, commission_payee_type = 'PF', commission_payee_name = 'ELISEU RODRIGUES DA S (nome completo e CPF a cadastrar)',
       commission_paid_by = 'LOCADORA', commission_paid_at = DATE '2025-07-01',
       notes = 'Comissao de 5.000,00 paga pela LM a pessoa fisica (PIX 01/07/2025, lancamento 18a49220-81c7-465b-852c-aa2973ead8e5). PENDENTE: eSocial S-1200 (cat. 701), INSS 11% + 20% e IRRF de 07/2025.'
FROM rental_contracts rc
WHERE a.rental_contract_id = rc.id AND rc.company_id = :'cid' AND rc.contract_number = '250001' AND a.competence_month = '2025-07'
  AND a.description LIKE 'DIMOB-B-01%';

-- Conferencia antes do COMMIT
DO $$
DECLARE t23 numeric; t24 numeric; t25 numeric; np int; vp numeric; ve numeric;
BEGIN
  SELECT coalesce(sum(amount) FILTER (WHERE competence_month LIKE '2023%'), 0), coalesce(sum(amount) FILTER (WHERE competence_month LIKE '2024%'), 0),
         coalesce(sum(amount) FILTER (WHERE competence_month LIKE '2025%'), 0)
    INTO t23, t24, t25 FROM ar_entries WHERE description LIKE 'DIMOB-B-01%' AND deleted_at IS NULL;
  IF t23 <> 198676.40 OR t24 <> 266500.00 OR t25 <> 473870.62 THEN
    RAISE EXCEPTION 'Totais divergentes: 2023 % (esperado 198676.40), 2024 % (266500.00), 2025 % (473870.62) - desfeito', t23, t24, t25;
  END IF;
  SELECT count(*), sum(p.amount) INTO np, vp FROM ar_payments p JOIN ar_entries a ON a.id = p.ar_entry_id WHERE a.description LIKE 'DIMOB-B-01%';
  SELECT sum(valor) INTO ve FROM dimob_rec;
  IF np <> 82 OR vp <> ve THEN RAISE EXCEPTION 'Pagamentos (% / %) nao coincidem com o extrato (82 / %) - desfeito', np, vp, ve; END IF;
END $$;
COMMIT;

\echo == Conferencia por ano e contrato ==
WITH t AS (
  SELECT left(a.competence_month, 4) AS ano, rc.contract_number AS contrato, left(rc.tenant_name, 32) AS locatario,
         a.amount, a.commission_amount, (SELECT count(*) FROM ar_payments p WHERE p.ar_entry_id = a.id) AS np,
         (SELECT coalesce(sum(p.amount), 0) FROM ar_payments p WHERE p.ar_entry_id = a.id) AS vp
  FROM ar_entries a JOIN rental_contracts rc ON rc.id = a.rental_contract_id
  WHERE a.description LIKE 'DIMOB-B-01%' AND a.deleted_at IS NULL)
SELECT ano, contrato, locatario, count(*) AS titulos, sum(amount) AS aluguel, sum(commission_amount) AS comissao,
       sum(np) AS pagtos_extrato, sum(vp) AS valor_extrato
FROM t GROUP BY ROLLUP (ano, (contrato, locatario)) ORDER BY ano NULLS LAST, contrato NULLS LAST;