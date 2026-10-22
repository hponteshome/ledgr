-- prisma/migrations-manuais/20261022_hotelsys_equivalencia_out2025.sql
-- 22/10/2026 - Hotelsys: equivalencia de 2025 sobre a Sunsys dividida em 31/10/2025 (abertura do contador) e 31/12/2025.
--   - 31/10/2025 AJ-EQ-SUNSYS-2025-10 (novo): jan-out/2025
--       D 42701010001 1.734.556,53 / C 12201020003  (99,92% do prejuizo da Sunsys de jan-out: 1.735.938,65)
--       D 12201020013 1.323.859,23 / C 32104010001  (realizacao do ganho: 10/12 da depreciacao do imovel no ano)
--   - 31/12/2025 AJ-EQ-SUNSYS-2025 (existente, valores corrigidos na origem): nov-dez/2025
--       D 42701010001 387.250,66 / C 12201020003 ; D 12201020013 264.771,85 / C 32104010001
--   Total de 2025 inalterado (2.121.807,19 e 1.588.631,08). Saldo em 31/12/2025 inalterado.
-- Reexecutar nao duplica. Depois: refazer na tela os encerramentos de 2024 e 2025 da Hotelsys.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
CREATE FUNCTION pg_temp.acc(emp uuid, c text) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE r uuid; BEGIN SELECT id INTO r FROM chart_of_accounts WHERE company_id = emp AND code = c AND deleted_at IS NULL;
  IF r IS NULL THEN RAISE EXCEPTION 'Conta % nao encontrada', c; END IF; RETURN r; END $f$;
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
DECLARE emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; je uuid; n int; x uuid; t numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'equivalencia-out2025-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  SELECT id INTO je FROM journal_entries WHERE company_id = emp AND deleted_at IS NULL AND reference = 'AJ-EQ-SUNSYS-2025' AND date::date = DATE '2025-12-31';
  IF je IS NULL THEN RAISE EXCEPTION 'AJ-EQ-SUNSYS-2025 em 31/12/2025 nao encontrado - nada alterado'; END IF;
  SELECT count(*), sum(value) INTO n, t FROM journal_entry_items WHERE journal_entry_id = je;
  IF n <> 4 OR t <> 7420876.54 THEN RAISE EXCEPTION 'AJ-EQ-SUNSYS-2025: esperado 4 partidas / soma 7420876.54; encontrado % / % - nada alterado', n, t; END IF;
  UPDATE journal_entry_items SET value = 387250.66 WHERE journal_entry_id = je AND value = 2121807.19 AND account_id IN (pg_temp.acc(emp, '42701010001'), pg_temp.acc(emp, '12201020003'));
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 2 THEN RAISE EXCEPTION 'Partidas de equivalencia: esperado 2, alterado %', n; END IF;
  UPDATE journal_entry_items SET value = 264771.85 WHERE journal_entry_id = je AND value = 1588631.08 AND account_id IN (pg_temp.acc(emp, '12201020013'), pg_temp.acc(emp, '32104010001'));
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 2 THEN RAISE EXCEPTION 'Partidas de realizacao: esperado 2, alterado %', n; END IF;
  UPDATE journal_entries SET description = U&'Equival\00eancia patrimonial sobre a Sunsys de nov-dez/2025: 99,92% do resultado e realiza\00e7\00e3o do ganho na propor\00e7\00e3o da deprecia\00e7\00e3o do im\00f3vel', updated_at = now() WHERE id = je;
  x := pg_temp.novo(emp, DATE '2025-10-31', 'AJ-EQ-SUNSYS-2025-10',
    U&'Equival\00eancia patrimonial sobre a Sunsys de jan-out/2025: 99,92% do resultado e realiza\00e7\00e3o do ganho na propor\00e7\00e3o da deprecia\00e7\00e3o do im\00f3vel',
    ARRAY[ARRAY['42701010001','DEBIT','1734556.53'], ARRAY['12201020003','CREDIT','1734556.53'], ARRAY['12201020013','DEBIT','1323859.23'], ARRAY['32104010001','CREDIT','1323859.23']]);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_CORRECAO_ORIGEM', 'equivalencia-out2025-20261022',
    jsonb_build_object('pacote', 'equivalencia-out2025-20261022', 'lancamento_dez', je, 'lancamento_out', x), now());
  RAISE NOTICE 'Correcao aplicada: equivalencia de 2025 dividida em 31/10/2025 e 31/12/2025';
END $$;
SELECT a.code, a.name, d.dt AS data,
       to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.deleted_at IS NULL AND j.date::date <= d.dt), 0), 'FM999G999G990D00') AS saldo_devedor
  FROM (VALUES (DATE '2025-10-31'), (DATE '2025-12-31')) d(dt)
  CROSS JOIN chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
 WHERE a.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND a.deleted_at IS NULL AND a.code IN ('12201020003', '12201020013')
 GROUP BY a.code, a.name, d.dt ORDER BY 1, 3;
COMMIT;
