-- prisma/migrations-manuais/20261021_hotelsys_ajuste_passivo_anexo_v.sql
-- 21/10/2026 - Hotelsys: ajuste do passivo a relacao de credores do Anexo V (R$ 67.258.658,64), lancado em 31/12/2024
-- contra Ajustes de Exercicios Anteriores, para que os saldos de 31/10/2025 fiquem iguais a relacao. Um lancamento, sem estorno.
-- Itens 1 e 3 (Crefipar e Banco Maxima) ficam juntos em 22101060001 Emprestimos Bancarios; provisoes de IRPJ e CSLL preservadas.
-- Guarda: so lanca se os saldos em 31/10/2025 forem os da previa; reexecutar nao duplica.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
CREATE TEMP TABLE x_lin (conta text, tipo text, valor numeric(18,2), hist text, ordem serial) ON COMMIT DROP;
INSERT INTO x_lin (conta, tipo, valor, hist) VALUES
    ('22101060001', 'CREDIT', 786670.77, U&'D\00edvidas banc\00e1rias (Crefipar e Banco M\00e1xima) atualizadas ao valor da rela\00e7\00e3o de credores (itens 1 e 3 do Anexo V)'),
    ('21101040010', 'DEBIT', 1778310.00, U&'Exclus\00e3o do item 2 do Anexo V (a\00e7\00e3o trabalhista) da rela\00e7\00e3o de credores'),
    ('21101050001', 'CREDIT', 10465532.79, U&'Tributos federais ajustados ao valor da rela\00e7\00e3o de credores (item 5 do Anexo V), sem as provis\00f5es de IRPJ e CSLL'),
    ('21101060008', 'DEBIT', 7366329.60, U&'Tributos municipais ajustados \00e0 rela\00e7\00e3o de credores (item 6 do Anexo V): ISS pr\00f3prio'),
    ('21101060009', 'DEBIT', 51272.41, U&'Tributos municipais ajustados \00e0 rela\00e7\00e3o de credores (item 6 do Anexo V): ISS retido'),
    ('21101060012', 'CREDIT', 941523.80, U&'Tributos municipais ajustados \00e0 rela\00e7\00e3o de credores (item 6 do Anexo V): IPTU'),
    ('21101040001', 'DEBIT', 934080.00, U&'Reclassifica\00e7\00e3o para Rescis\00f5es a Pagar (item 8 do Anexo V)'),
    ('21101040005', 'CREDIT', 934080.00, U&'Rescis\00f5es a pagar - item 8 do Anexo V (07/2019 a 04/2024)'),
    ('21101010001', 'DEBIT', 1200000.00, U&'Exclus\00e3o do item 18 do Anexo V (Fornecedores Diversos) da rela\00e7\00e3o de credores'),
    ('23301020003', 'DEBIT', 1797815.35, U&'Contrapartida do ajuste do passivo \00e0 rela\00e7\00e3o de credores do Anexo V (posi\00e7\00e3o de 31/10/2025)');
CREATE TEMP TABLE x_exp (conta text, saldo numeric(18,2)) ON COMMIT DROP;
INSERT INTO x_exp VALUES
    ('21101010001', 1200000.00),
    ('21101040001', 934080.00),
    ('21101040005', 0.00),
    ('21101040010', 8050751.00),
    ('21101050001', 6579893.92),
    ('21101060008', 7366329.60),
    ('21101060009', 51272.41),
    ('21101060012', 10772701.56),
    ('22101060001', 19800000.00),
    ('23301020003', -16751807.57);
DO $$
DECLARE
  emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc';
  usr uuid := '421642c8-e981-49c9-996c-b4bfabc22b52';
  grupo uuid[] := ARRAY['6a13e876-7056-4076-a403-9610f7dc37b1','c2d48edc-28b7-4fd8-9272-b486449ab2cc','ad8ad459-40b4-47f5-8a9a-7e4688487b4f','e274dfc0-0a9a-4af1-8141-f35ff73fac93']::uuid[];
  r record; v_max uuid; v_irmao uuid; v_cod text; v_red text; v_ref text; v_je uuid; v_udt text; n int; v_d numeric; v_c numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM journal_entries WHERE company_id = emp AND deleted_at IS NULL AND description = U&'Ajuste do passivo da Hotelsys \00e0 rela\00e7\00e3o de credores do Anexo V (R$ 67.258.658,64 em 31/10/2025)') THEN
    RAISE NOTICE 'Ajuste ja lancado - nada feito'; RETURN; END IF;
  -- conferencia dos saldos de 31/10/2025 (credor positivo)
  FOR r IN SELECT e.conta, e.saldo,
      COALESCE((SELECT sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END) FROM journal_entry_items i
        JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
        WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.date::date <= DATE '2025-10-31' AND a.code = e.conta AND a.company_id = emp AND a.deleted_at IS NULL), 0) AS atual
    FROM x_exp e LOOP
    IF abs(r.atual - r.saldo) > 0.005 THEN
      RAISE EXCEPTION 'Saldo de % em 31/10/2025 mudou (previa %, agora %) - nada lancado', r.conta, r.saldo, r.atual; END IF;
  END LOOP;
  -- lancamento
  SELECT 'MANUAL-2024-' || lpad((COALESCE(max(NULLIF(regexp_replace(reference, '^MANUAL-2024-', ''), '')::int), 0) + 1)::text, 4, '0') INTO v_ref
    FROM journal_entries WHERE company_id = emp AND reference ~ '^MANUAL-2024-[0-9]+$';
  v_je := gen_random_uuid();
  INSERT INTO journal_entries (id, company_id, date, description, reference, source_module, created_by_id, created_at, updated_at)
    VALUES (v_je, emp, TIMESTAMP '2024-12-31 00:00:00', U&'Ajuste do passivo da Hotelsys \00e0 rela\00e7\00e3o de credores do Anexo V (R$ 67.258.658,64 em 31/10/2025)', v_ref, 'ACCOUNTING'::source_module, usr, now(), now());
  SELECT udt_name INTO v_udt FROM information_schema.columns WHERE table_name = 'journal_entry_items' AND column_name = 'type' AND table_schema = 'public';
  FOR r IN SELECT l.*, (SELECT id FROM chart_of_accounts a WHERE a.company_id = emp AND a.code = l.conta AND a.deleted_at IS NULL) AS acc
    FROM x_lin l ORDER BY l.ordem LOOP
    IF r.acc IS NULL THEN RAISE EXCEPTION 'Conta % nao encontrada', r.conta; END IF;
    EXECUTE format('INSERT INTO journal_entry_items (id, journal_entry_id, account_id, value, type, description, created_at) VALUES (gen_random_uuid(), $1, $2, $3, %L::%I, $4, now())', r.tipo, v_udt)
      USING v_je, r.acc, r.valor, r.hist;
  END LOOP;
  SELECT sum(value) FILTER (WHERE type::text = 'DEBIT'), sum(value) FILTER (WHERE type::text = 'CREDIT'), count(*) INTO v_d, v_c, n FROM journal_entry_items WHERE journal_entry_id = v_je;
  IF v_d <> v_c THEN RAISE EXCEPTION 'Lancamento desbalanceado: D % C %', v_d, v_c; END IF;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
    VALUES (gen_random_uuid(), usr, 'CONTABIL_LANCAMENTO_MANUAL', v_je::text, jsonb_build_object('ref', v_ref, 'empresa', 'HOTELSYS', 'data', '2024-12-31', 'partidas', n, 'total', v_d, 'motivo', 'Ajuste do passivo a relacao de credores do Anexo V'), now());
  RAISE NOTICE 'Lancado % em 31/12/2024: % partidas, D = C = %', v_ref, n, v_d;
END $$;
-- conferencia: saldos em 31/10/2025 depois do ajuste
SELECT a.code, a.name, to_char(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END), 'FM999G999G990D00') AS saldo_credor_31_10_2025
FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
WHERE j.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND j.deleted_at IS NULL AND j.date::date <= DATE '2025-10-31'
  AND (a.code IN ('22101060001','21101040010','21101040005','21101040001','21101050001','21101060008','21101060009','21101060012','21101010001','21101020006','21101020007','21101020008','22101010002')
       OR a.code IN ('21101090001','21101090002'))
GROUP BY a.code, a.name ORDER BY a.code;
COMMIT;
