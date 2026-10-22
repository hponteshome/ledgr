-- prisma/migrations-manuais/20261022_operacao_ancora_3c_sunrise_f5.sql
-- 22/10/2026 - Operacao Ancora, caso 3c (item do Anexo V pago depois de 31/10/2025 com recursos da VAL):
-- a Hotelsys ja registra cada pagamento a credito de 22101020002 Conta corrente Sunrise - Anexo V (total 1.214.275,29).
-- Este script cria as pernas que faltam, um lancamento por pagamento, com a mesma data e valor:
--   Sunrise: D 12101020025 Conta corrente Hotelsys - Anexo V / C 12101020024 A receber da F5 - Anexo V por conta da RM
--   F5:      D 22103010001 Quitacao dos passivos da Hotelsys (obrigacao do Anexo V por conta da RM) / C 12101020024 Conta corrente Sunsys
-- Lote exclusivo da Operacao Ancora: um lote de importacao por empresa e ano (import_lotes), com todos os lancamentos deste script.
-- Reexecutar nao duplica.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
CREATE FUNCTION pg_temp.acc(emp uuid, c text) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE r uuid; BEGIN SELECT id INTO r FROM chart_of_accounts WHERE company_id = emp AND code = c AND deleted_at IS NULL;
  IF r IS NULL THEN RAISE EXCEPTION 'Conta % nao encontrada', c; END IF; RETURN r; END $f$;
CREATE FUNCTION pg_temp.saldo(emp uuid, c text) RETURNS numeric LANGUAGE sql AS $f$
  SELECT COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 0)
    FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND i.account_id = pg_temp.acc(emp, c) $f$;
CREATE TEMP TABLE x_lote (emp uuid, ano int, id uuid);
CREATE FUNCTION pg_temp.lote(emp uuid, a int) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE r uuid; num int;
BEGIN
  SELECT id INTO r FROM x_lote WHERE x_lote.emp = lote.emp AND x_lote.ano = a;
  IF r IS NOT NULL THEN RETURN r; END IF;
  r := gen_random_uuid();
  SELECT COALESCE(max(numero), 0) + 1 INTO num FROM import_lotes WHERE company_id = emp AND ano = a;
  INSERT INTO import_lotes (id, company_id, ano, numero, nome_arquivo, tipo, quantidade_lancamentos, total_debito, total_credito, created_by_id, created_at)
  VALUES (r, emp, a, num, U&'Opera\00e7\00e3o \00c2ncora - Anexo V pago com recursos da VAL (caso 3c)', 'MANUAL', 0, 0, 0, '421642c8-e981-49c9-996c-b4bfabc22b52', now());
  INSERT INTO x_lote VALUES (emp, a, r);
  RETURN r; END $f$;
CREATE FUNCTION pg_temp.novo(emp uuid, dt date, ref text, h text, itens text[][]) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE novo uuid := gen_random_uuid(); tmpl uuid; u text; i int; d numeric := 0; c numeric := 0;
BEGIN
  SELECT id INTO tmpl FROM journal_entries WHERE company_id = emp AND deleted_at IS NULL AND source_module::text = 'ACCOUNTING' ORDER BY date DESC LIMIT 1;
  INSERT INTO journal_entries SELECT (jsonb_populate_record(NULL::journal_entries, to_jsonb(e) || jsonb_build_object(
      'id', novo, 'date', dt::text || 'T00:00:00', 'reference', ref, 'description', h, 'source_module', 'ACCOUNTING',
      'deleted_at', NULL, 'import_lote_id', pg_temp.lote(emp, extract(year FROM dt)::int), 'is_closing_entry', false, 'created_at', now(), 'updated_at', now()))).* FROM journal_entries e WHERE e.id = tmpl;
  SELECT udt_name INTO u FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entry_items' AND column_name = 'type';
  FOR i IN 1 .. array_length(itens, 1) LOOP
    EXECUTE format('INSERT INTO journal_entry_items (id, journal_entry_id, account_id, value, type, description, created_at) VALUES (gen_random_uuid(), $1, $2, $3, %L::%I, $4, now())', itens[i][2], u)
      USING novo, pg_temp.acc(emp, itens[i][1]), itens[i][3]::numeric, h;
    IF itens[i][2] = 'DEBIT' THEN d := d + itens[i][3]::numeric; ELSE c := c + itens[i][3]::numeric; END IF;
  END LOOP;
  IF d <> c THEN RAISE EXCEPTION 'Lancamento % desbalanceado (D % C %)', ref, d, c; END IF;
  RETURN novo; END $f$;
DO $$
DECLARE hs uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; sr uuid := 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f'; f5 uuid := 'e274dfc0-0a9a-4af1-8141-f35ff73fac93';
  r record; xs uuid; xf uuid; tot numeric := 0; n int := 0; mapa jsonb := '[]'; h text; ref text;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'operacao-ancora-3c-sunrise-f5-20261022') THEN
    RAISE NOTICE 'Ja aplicado - nada feito'; RETURN; END IF;
  FOR r IN SELECT j.id, j.date::date AS dt, j.reference, j.description,
                  sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END) AS v
             FROM journal_entries j JOIN journal_entry_items i ON i.journal_entry_id = j.id
            WHERE j.company_id = hs AND j.deleted_at IS NULL AND j.date::date > DATE '2025-10-31' AND i.account_id = pg_temp.acc(hs, '22101020002')
            GROUP BY j.id, j.date, j.reference, j.description ORDER BY j.date, j.reference LOOP
    IF r.v <= 0 THEN RAISE EXCEPTION 'Lancamento % da Hotelsys com saldo devedor em 22101020002 (%) - nada alterado', r.reference, r.v; END IF;
    n := n + 1; tot := tot + r.v;
    ref := 'OA-3C-' || to_char(r.dt, 'YYYYMMDD') || '-' || lpad(n::text, 2, '0');
    h := U&'Opera\00e7\00e3o \00c2ncora - item do Anexo V pago depois de 31/10/2025 com recursos da VAL (caso 3c), Hotelsys '
         || COALESCE(r.reference, '') || ': ' || left(regexp_replace(COALESCE(r.description, ''), '\s+', ' ', 'g'), 300);
    xs := pg_temp.novo(sr, r.dt, ref, h, ARRAY[ARRAY['12101020025','DEBIT',r.v::text], ARRAY['12101020024','CREDIT',r.v::text]]);
    xf := pg_temp.novo(f5, r.dt, ref, h, ARRAY[ARRAY['22103010001','DEBIT',r.v::text], ARRAY['12101020024','CREDIT',r.v::text]]);
    mapa := mapa || jsonb_build_object('hotelsys', r.id, 'sunrise', xs, 'f5', xf, 'data', r.dt, 'valor', r.v);
  END LOOP;
  IF tot <> 1214275.29 THEN RAISE EXCEPTION 'Total dos pagamentos 3c: esperado 1.214.275,29, encontrado % (% lancamentos) - nada alterado', tot, n; END IF;
  IF pg_temp.saldo(sr, '12101020025') <> -pg_temp.saldo(hs, '22101020002') THEN
    RAISE EXCEPTION 'Conta corrente Sunrise x Hotelsys nao bate - nada alterado'; END IF;
  UPDATE import_lotes l SET quantidade_lancamentos = t.n, total_debito = t.v, total_credito = t.v
    FROM (SELECT j.import_lote_id AS id, count(DISTINCT j.id) AS n, sum(i.value) FILTER (WHERE i.type::text = 'DEBIT') AS v
            FROM journal_entries j JOIN journal_entry_items i ON i.journal_entry_id = j.id
           WHERE j.import_lote_id IN (SELECT id FROM x_lote) GROUP BY j.import_lote_id) t
   WHERE l.id = t.id;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
    'CONTABIL_CORRECAO_ORIGEM', 'operacao-ancora-3c', jsonb_build_object('pacote', 'operacao-ancora-3c-sunrise-f5-20261022', 'total', tot, 'lotes', (SELECT jsonb_agg(to_jsonb(x)) FROM x_lote x), 'lancamentos', mapa), now());
  RAISE NOTICE 'Aplicado: % pagamentos (%) com as pernas da Sunrise e da F5', n, tot;
END $$;
SELECT 'HOTELSYS' AS empresa, '22101020002' AS conta, to_char(-sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 'FM999G999G990D00') AS saldo_credor
  FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
 WHERE j.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND j.deleted_at IS NULL AND a.code = '22101020002'
UNION ALL
SELECT x.emp, a.code, to_char(-sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 'FM999G999G990D00')
  FROM (VALUES ('SUNRISE', 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f'::uuid), ('F5', 'e274dfc0-0a9a-4af1-8141-f35ff73fac93'::uuid)) x(emp, id)
  JOIN journal_entries j ON j.company_id = x.id AND j.deleted_at IS NULL JOIN journal_entry_items i ON i.journal_entry_id = j.id
  JOIN chart_of_accounts a ON a.id = i.account_id AND a.code IN ('12101020024','12101020025','22103010001')
 GROUP BY x.emp, a.code ORDER BY 1, 2;
SELECT c.legal_name AS empresa, l.ano, l.numero AS lote, l.quantidade_lancamentos AS lancamentos, l.total_debito AS total
  FROM import_lotes l JOIN companies c ON c.id = l.company_id WHERE l.id IN (SELECT id FROM x_lote) ORDER BY 1, 2;
COMMIT;
