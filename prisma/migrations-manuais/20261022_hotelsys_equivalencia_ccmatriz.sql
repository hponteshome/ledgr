-- prisma/migrations-manuais/20261022_hotelsys_equivalencia_ccmatriz.sql
-- 22/10/2026 - Hotelsys:
--  1. Equivalencia sobre a Sunsys refeita com 99,92% (62.750.000,00 de 62.800.000,00 do capital) e com a realizacao do ganho nao
--     realizado da integralizacao de 2018 (56.069.333,03), na proporcao da depreciacao do imovel na Sunsys (ICPC 09):
--     - 31/12/2024 AJ-EQ-SUNSYS-ANT: diferenca de 2018 a 2023 em Ajustes de Exercicios Anteriores
--       D 12201020013 8.605.085,02 / C 12201020003 2.942.047,32 / C 23301020003 5.663.037,70
--     - 31/12/2024 AJ-EQ-SUNSYS-2024: D 42701010001 1.815.446,55 / C 12201020003; D 12201020013 1.588.631,08 / C 32104010001
--     - 31/12/2025 AJ-EQ-SUNSYS-2025: D 42701010001 2.121.807,19 / C 12201020003; D 12201020013 1.588.631,08 / C 32104010001
--     Investimento liquido: 5.436.222,23 em 31/12/2024 e 4.903.046,12 em 31/12/2025.
--  2. Conta Corrente Matriz: as 14 partidas do "Ajuste Saldos 2025" (31/12/2024) passam para 23301020003 Ajustes de Exercicios
--     Anteriores (correcao na origem). A conta volta ao saldo de abertura de 2017 (16.890.513,66 C, espelho do Mutuo Ligadas).
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
DECLARE emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; x uuid; n int; dc numeric; a_cc uuid; a_aea uuid; ids uuid[];
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'equivalencia-ccmatriz-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  -- confere o ponto de partida do investimento
  IF (SELECT COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 0) FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
       WHERE j.company_id = emp AND j.deleted_at IS NULL AND i.account_id IN (pg_temp.acc(emp, '12201020003'), pg_temp.acc(emp, '12201020013'))) <> 0 THEN
    RAISE EXCEPTION 'Investimento liquido na Sunsys nao esta zerado - nada alterado'; END IF;
  x := pg_temp.novo(emp, DATE '2024-12-31', 'AJ-EQ-SUNSYS-ANT',
    U&'Equival\00eancia sobre a Sunsys de 2018 a 2023 refeita: 99,92% e realiza\00e7\00e3o do ganho n\00e3o realizado da integraliza\00e7\00e3o (ICPC 09)',
    ARRAY[ARRAY['12201020013','DEBIT','8605085.02'], ARRAY['12201020003','CREDIT','2942047.32'], ARRAY['23301020003','CREDIT','5663037.70']]);
  x := pg_temp.novo(emp, DATE '2024-12-31', 'AJ-EQ-SUNSYS-2024',
    U&'Equival\00eancia patrimonial sobre a Sunsys de 2024: 99,92% do resultado e realiza\00e7\00e3o do ganho na propor\00e7\00e3o da deprecia\00e7\00e3o do im\00f3vel',
    ARRAY[ARRAY['42701010001','DEBIT','1815446.55'], ARRAY['12201020003','CREDIT','1815446.55'], ARRAY['12201020013','DEBIT','1588631.08'], ARRAY['32104010001','CREDIT','1588631.08']]);
  x := pg_temp.novo(emp, DATE '2025-12-31', 'AJ-EQ-SUNSYS-2025',
    U&'Equival\00eancia patrimonial sobre a Sunsys de 2025: 99,92% do resultado e realiza\00e7\00e3o do ganho na propor\00e7\00e3o da deprecia\00e7\00e3o do im\00f3vel',
    ARRAY[ARRAY['42701010001','DEBIT','2121807.19'], ARRAY['12201020003','CREDIT','2121807.19'], ARRAY['12201020013','DEBIT','1588631.08'], ARRAY['32104010001','CREDIT','1588631.08']]);
  -- Conta Corrente Matriz: partidas do Ajuste Saldos 2025
  a_cc := pg_temp.acc(emp, '22101050002'); a_aea := pg_temp.acc(emp, '23301020003');
  SELECT array_agg(i.id), count(*), sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) INTO ids, n, dc
    FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.date::date = DATE '2024-12-31' AND j.description = 'Ajuste Saldos 2025' AND i.account_id = a_cc;
  IF n <> 14 OR dc <> 6341880.90 THEN RAISE EXCEPTION 'Ajuste Saldos 2025 na Conta Corrente Matriz: esperado 14 partidas / D 6341880.90; encontrado % / % - nada alterado', n, dc; END IF;
  UPDATE journal_entry_items SET account_id = a_aea WHERE id = ANY(ids);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_CORRECAO_ORIGEM', 'equivalencia-ccmatriz-20261022',
    jsonb_build_object('pacote', 'equivalencia-ccmatriz-20261022', 'equivalencia_pct', '99,92', 'ccmatriz_partidas', n, 'ccmatriz_liquido', dc, 'itens', to_jsonb(ids)), now());
  RAISE NOTICE 'Correcao aplicada: equivalencia sobre a Sunsys (3 lancamentos) e % partidas da Conta Corrente Matriz (liquido D %) para Ajustes de Exercicios Anteriores', n, dc;
END $$;
SELECT a.code, a.name, d.dt AS data,
       to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.deleted_at IS NULL AND j.date::date <= d.dt), 0), 'FM999G999G990D00') AS saldo_devedor
  FROM (VALUES (DATE '2024-12-31'), (DATE '2025-12-31')) d(dt)
  CROSS JOIN chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
 WHERE a.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND a.deleted_at IS NULL AND a.code IN ('12201020003', '12201020013', '22101050002', '12101020001')
 GROUP BY a.code, a.name, d.dt ORDER BY 1, 3;
COMMIT;
