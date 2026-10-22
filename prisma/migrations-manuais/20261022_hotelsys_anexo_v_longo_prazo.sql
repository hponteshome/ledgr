-- prisma/migrations-manuais/20261022_hotelsys_anexo_v_longo_prazo.sql
-- 22/10/2026 - Hotelsys: passivos do Anexo V para o Exigivel a Longo Prazo a partir da confissao de divida de 31/10/2025.
--  1. Plano de contas: grupo 223 "Confissao de Divida - Anexo V (31/10/2025)" com 13 contas analiticas (22301010001 a 0013).
--  2. 31/10/2025 AJ-ANEXOV-LP: reclassificacao dos saldos de 31/10/2025 das 23 contas de curto prazo do Anexo V
--     (D curto prazo / C longo prazo); honorarios (itens 11 a 17) por credor. Total esperado 41.098.105,59.
--  3. Lancamentos posteriores a 31/10/2025: as partidas a DEBITO (pagamentos do Anexo V) nessas 23 contas passam para a conta
--     de longo prazo correspondente (correcao na origem). Esperado 1.214.275,29. Creditos posteriores (provisoes e encargos
--     de 31/12/2025, encargos CLT) ficam no curto prazo.
-- Reexecutar nao duplica.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
CREATE FUNCTION pg_temp.acc(emp uuid, c text) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE r uuid; BEGIN SELECT id INTO r FROM chart_of_accounts WHERE company_id = emp AND code = c AND deleted_at IS NULL;
  IF r IS NULL THEN RAISE EXCEPTION 'Conta % nao encontrada', c; END IF; RETURN r; END $f$;
-- cria conta copiando os demais campos de uma conta modelo
CREATE FUNCTION pg_temp.conta(emp uuid, modelo text, cod text, nome text, pai text, red text) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE novo uuid := gen_random_uuid();
BEGIN
  IF EXISTS (SELECT 1 FROM chart_of_accounts WHERE company_id = emp AND code = cod AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Conta % ja existe - nada alterado', cod; END IF;
  IF red IS NOT NULL AND EXISTS (SELECT 1 FROM chart_of_accounts WHERE company_id = emp AND reduced_code = red AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Reduzido % ja usado - nada alterado', red; END IF;
  INSERT INTO chart_of_accounts SELECT (jsonb_populate_record(NULL::chart_of_accounts, to_jsonb(m) || jsonb_build_object(
      'id', novo, 'code', cod, 'name', nome, 'parent_id', pg_temp.acc(emp, pai), 'reduced_code', red, 'sped_code', NULL,
      'created_at', now(), 'updated_at', now(), 'created_by_id', '421642c8-e981-49c9-996c-b4bfabc22b52', 'updated_by_id', NULL))).*
    FROM chart_of_accounts m WHERE m.id = pg_temp.acc(emp, modelo);
  RETURN novo; END $f$;
CREATE FUNCTION pg_temp.novo(emp uuid, dt date, ref text, h text, itens text[][]) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE novo uuid := gen_random_uuid(); tmpl uuid; u text; i int; d numeric := 0; c numeric := 0;
BEGIN
  SELECT id INTO tmpl FROM journal_entries WHERE company_id = emp AND deleted_at IS NULL AND source_module::text = 'ACCOUNTING' ORDER BY date DESC LIMIT 1;
  INSERT INTO journal_entries SELECT (jsonb_populate_record(NULL::journal_entries, to_jsonb(e) || jsonb_build_object(
      'id', novo, 'date', dt::text || 'T00:00:00', 'reference', ref, 'description', h, 'source_module', 'ACCOUNTING',
      'deleted_at', NULL, 'import_lote_id', NULL, 'is_closing_entry', false, 'created_at', now(), 'updated_at', now()))).* FROM journal_entries e WHERE e.id = tmpl;
  SELECT udt_name INTO u FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entry_items' AND column_name = 'type';
  FOR i IN 1 .. array_length(itens, 1) LOOP
    EXECUTE format('INSERT INTO journal_entry_items (id, journal_entry_id, account_id, value, type, description, created_at) VALUES (gen_random_uuid(), $1, $2, $3, %L::%I, $4, now())', itens[i][2], u)
      USING novo, pg_temp.acc(emp, itens[i][1]), itens[i][3]::numeric, h;
    IF itens[i][2] = 'DEBIT' THEN d := d + itens[i][3]::numeric; ELSE c := c + itens[i][3]::numeric; END IF;
  END LOOP;
  IF d <> c THEN RAISE EXCEPTION 'Lancamento % desbalanceado (D % C %)', ref, d, c; END IF;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_LANCAMENTO_CRIADO', novo::text,
    jsonb_build_object('ref', ref, 'valor', d), now());
  RETURN novo; END $f$;
DO $$
DECLARE
  emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; x uuid; r record; itens text[][] := ARRAY[]::text[][]; tot numeric := 0; s numeric;
  n int; v numeric; ids uuid[]; red0 int;
  -- conta de curto prazo -> conta de longo prazo
  mp jsonb := '{"21101040010":"22301010001","21101050002":"22301010001","21101140002":"22301010001","21101140003":"22301010001",
    "21101040005":"22301010002",
    "21101050001":"22301010003","21101060001":"22301010003","21101060002":"22301010003","21101060003":"22301010003","21101060004":"22301010003",
    "21101060006":"22301010003","21101060007":"22301010003","21101060016":"22301010003","21101060013":"22301010003","21101060014":"22301010003",
    "21101090001":"22301010003","21101090002":"22301010003",
    "21101060012":"22301010004","21101060008":"22301010004","21101060009":"22301010004",
    "21101020007":"22301010005","21101020008":"22301010006","21101020006":"SPLIT"}';
  hon text[][] := ARRAY[['22301010007','70000.00'],['22301010008','18000.00'],['22301010009','289000.00'],['22301010010','50000.00'],
                        ['22301010011','15000.00'],['22301010012','250000.00'],['22301010013','100000.00']];
  h text := U&'Reclassifica\00e7\00e3o para o longo prazo - confiss\00e3o de d\00edvida de 31/10/2025 (Anexo V)';
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'anexo-v-longo-prazo-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  -- 1. plano de contas (reduzidos livres a partir de 2320)
  SELECT max(reduced_code::int) INTO red0 FROM chart_of_accounts WHERE company_id = emp AND deleted_at IS NULL AND reduced_code ~ '^23[0-9][0-9]$';
  red0 := greatest(coalesce(red0, 2319), 2319) + 1;
  x := pg_temp.conta(emp, '221', '223', U&'CONFISS\00c3O DE D\00cdVIDA - ANEXO V (31/10/2025)', '22', NULL);
  x := pg_temp.conta(emp, '22101', '22301', U&'Confiss\00e3o de D\00edvida - Anexo V', '223', NULL);
  x := pg_temp.conta(emp, '2210101', '2230101', U&'Credores do Anexo V', '22301', NULL);
  x := pg_temp.conta(emp, '22101010002', '22301010001', U&'A\00e7\00f5es Trabalhistas (itens 2 e 4)', '2230101', (red0)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010002', U&'Sal\00e1rios Pendentes 07/2019 a 04/2024 (item 8)', '2230101', (red0+1)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010003', U&'Impostos Federais (item 5)', '2230101', (red0+2)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010004', U&'IPTU (item 6)', '2230101', (red0+3)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010005', U&'Confiss\00e3o de D\00edvida Fernando Galv\00e3o (item 7)', '2230101', (red0+4)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010006', U&'A\00e7\00e3o Natal - Escandinavos (item 10)', '2230101', (red0+5)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010007', U&'Escrit\00f3rio de Contabilidade (item 11)', '2230101', (red0+6)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010008', U&'Contador Diego (item 12)', '2230101', (red0+7)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010009', U&'Lauro, Advogado (item 13)', '2230101', (red0+8)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010010', U&'Paulo Gouveia (item 14)', '2230101', (red0+9)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010011', U&'Prime Yeld - Avalia\00e7\00e3o (item 15)', '2230101', (red0+10)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010012', U&'Paulo Bonadie (item 16)', '2230101', (red0+11)::text);
  x := pg_temp.conta(emp, '22101010002', '22301010013', U&'Victor Paes Barreto (item 17)', '2230101', (red0+12)::text);
  -- 2. reclassificacao em 31/10/2025 pelos saldos da data
  FOR r IN SELECT a.code, COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 0) AS sd
             FROM chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id
             LEFT JOIN journal_entries j ON j.id = i.journal_entry_id AND j.deleted_at IS NULL AND j.date::date <= DATE '2025-10-31'
            WHERE a.company_id = emp AND a.deleted_at IS NULL AND a.code IN (SELECT jsonb_object_keys(mp))
              AND (i.id IS NULL OR j.id IS NOT NULL)
            GROUP BY a.code ORDER BY a.code LOOP
    IF r.sd = 0 THEN CONTINUE; END IF;
    IF r.sd > 0 THEN RAISE EXCEPTION 'Conta % com saldo devedor em 31/10/2025 (%) - nada alterado', r.code, r.sd; END IF;
    itens := itens || ARRAY[[r.code, 'DEBIT', (-r.sd)::text]];
    tot := tot - r.sd;
    IF mp->>r.code = 'SPLIT' THEN
      IF -r.sd <> 792000.00 THEN RAISE EXCEPTION 'Honorarios (21101020006) em 31/10/2025: esperado 792.000,00, encontrado % - nada alterado', -r.sd; END IF;
      FOR n IN 1 .. 7 LOOP itens := itens || ARRAY[[hon[n][1], 'CREDIT', hon[n][2]]]; END LOOP;
    ELSE
      itens := itens || ARRAY[[mp->>r.code, 'CREDIT', (-r.sd)::text]];
    END IF;
  END LOOP;
  IF tot <> 41098105.59 THEN RAISE EXCEPTION 'Total a reclassificar: esperado 41.098.105,59, encontrado % - nada alterado', tot; END IF;
  x := pg_temp.novo(emp, DATE '2025-10-31', 'AJ-ANEXOV-LP', h, itens);
  -- 3. pagamentos posteriores a 31/10/2025 (partidas a debito) passam para o longo prazo
  SELECT array_agg(i.id), count(*), COALESCE(sum(i.value), 0) INTO ids, n, v
    FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.date::date > DATE '2025-10-31' AND NOT j.is_closing_entry
     AND i.type::text = 'DEBIT' AND a.code IN (SELECT jsonb_object_keys(mp));
  IF v <> 1214275.29 THEN RAISE EXCEPTION 'Pagamentos posteriores: esperado 1.214.275,29, encontrado % (% partidas) - nada alterado', v, n; END IF;
  IF EXISTS (SELECT 1 FROM journal_entry_items i JOIN chart_of_accounts a ON a.id = i.account_id WHERE i.id = ANY(ids) AND a.code = '21101020006') THEN
    RAISE EXCEPTION 'Pagamento posterior em honorarios (21101020006): definir credor - nada alterado'; END IF;
  UPDATE journal_entry_items i SET account_id = pg_temp.acc(emp, mp->>a.code)
    FROM chart_of_accounts a WHERE a.id = i.account_id AND i.id = ANY(ids);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
    'CONTABIL_CORRECAO_ORIGEM', x::text, jsonb_build_object('pacote', 'anexo-v-longo-prazo-20261022', 'lancamento', x, 'reclassificado', tot,
      'pagamentos_partidas', n, 'pagamentos_valor', v, 'itens', to_jsonb(ids), 'reduzido_inicial', red0), now());
  RAISE NOTICE 'Correcao aplicada: % reclassificados em 31/10/2025; % partidas posteriores (%) no longo prazo; reduzidos % a %', tot, n, v, red0, red0 + 12;
END $$;
SELECT a.code, a.reduced_code AS red, a.name,
       to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.deleted_at IS NULL AND j.date::date <= DATE '2025-10-31'), 0), 'FM999G999G990D00') AS saldo_31_10_2025,
       to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.deleted_at IS NULL AND j.date::date <= DATE '2026-09-30'), 0), 'FM999G999G990D00') AS saldo_30_09_2026
  FROM chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
 WHERE a.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND a.deleted_at IS NULL AND a.code LIKE '22301010%'
 GROUP BY a.code, a.reduced_code, a.name ORDER BY 1;
COMMIT;
