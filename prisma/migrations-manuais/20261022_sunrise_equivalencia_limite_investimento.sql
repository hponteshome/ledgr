-- prisma/migrations-manuais/20261022_sunrise_equivalencia_limite_investimento.sql
-- 22/10/2026 - Sunrise x Hotelsys (99%): perdas de equivalencia limitadas ao valor do investimento (CPC 18, itens 38 e 39) -
-- a Sunrise nao tem obrigacao de cobrir passivos da Hotelsys; a provisao para perdas (22102010001) deixa de existir.
--  1. Apuracoes de 31/12/2024 (2.402.615,90) e 31/12/2025 (3.049.981,43) do modulo de equivalencia: lancamentos excluidos
--     (soft delete) e linhas da demonstracao removidas (copia no audit_logs).
--  2. 31/12/2024 AJ-EQ-HOTELSYS-LIMITE: provisao acumulada ate 2023 (36.489.480,45, inclusive a abertura de 2018) revertida
--     contra Ajustes de Exercicios Anteriores (23301020003).
--  3. Participacao Sunrise -> Hotelsys sem conta de provisao (perdas futuras param no investimento zerado).
-- Depois: refazer na tela os encerramentos de 2024 e 2025 da Sunrise. Reexecutar nao duplica.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
CREATE FUNCTION pg_temp.acc(emp uuid, c text) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE r uuid; BEGIN SELECT id INTO r FROM chart_of_accounts WHERE company_id = emp AND code = c AND deleted_at IS NULL;
  IF r IS NULL THEN RAISE EXCEPTION 'Conta % nao encontrada', c; END IF; RETURN r; END $f$;
CREATE FUNCTION pg_temp.saldo(emp uuid, c text, ate date) RETURNS numeric LANGUAGE sql AS $f$
  SELECT COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 0)
    FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.date::date <= ate AND i.account_id = pg_temp.acc(emp, c) $f$;
CREATE FUNCTION pg_temp.novo(emp uuid, dt date, ref text, h text, itens text[][]) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE novo uuid := gen_random_uuid(); tmpl uuid; u text; i int; d numeric := 0; c numeric := 0;
BEGIN
  SELECT id INTO tmpl FROM journal_entries WHERE company_id = emp AND deleted_at IS NULL AND source_module::text = 'ACCOUNTING' ORDER BY date DESC LIMIT 1;
  IF tmpl IS NULL THEN SELECT id INTO tmpl FROM journal_entries WHERE company_id = emp AND deleted_at IS NULL ORDER BY date DESC LIMIT 1; END IF;
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
DECLARE emp uuid := 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f'; hs uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc';
  inv uuid; calc record; calcs jsonb := '[]'; n int; v numeric; x uuid; prov numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'sunrise-equivalencia-limite-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  SELECT id INTO inv FROM equity_method_investments WHERE investor_company_id = emp AND investee_company_id = hs AND deleted_at IS NULL;
  IF inv IS NULL THEN RAISE EXCEPTION 'Participacao Sunrise -> Hotelsys nao encontrada - nada alterado'; END IF;
  -- 1. apuracoes de 2024 e 2025
  FOR calc IN SELECT * FROM equity_method_calculations WHERE investment_id = inv AND reference_date IN (DATE '2024-12-31', DATE '2025-12-31') ORDER BY reference_date LOOP
    SELECT count(*), sum(i.value) INTO n, v FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
     WHERE j.id = calc.journal_entry_id AND j.deleted_at IS NULL
       AND ((i.account_id = pg_temp.acc(emp, '42701010001') AND i.type::text = 'DEBIT') OR (i.account_id = pg_temp.acc(emp, '22102010001') AND i.type::text = 'CREDIT'))
       AND i.value = abs(calc.adjustment);
    IF n <> 2 OR (SELECT count(*) FROM journal_entry_items WHERE journal_entry_id = calc.journal_entry_id) <> 2 THEN
      RAISE EXCEPTION 'Apuracao de % nao confere com o lancamento (D perda / C provisao %) - nada alterado', calc.reference_date, abs(calc.adjustment); END IF;
    UPDATE journal_entries SET deleted_at = now(), updated_at = now() WHERE id = calc.journal_entry_id;
    calcs := calcs || to_jsonb(calc);
    DELETE FROM equity_method_calculations WHERE id = calc.id;
  END LOOP;
  IF jsonb_array_length(calcs) <> 2 THEN RAISE EXCEPTION 'Esperadas 2 apuracoes (2024 e 2025), encontradas % - nada alterado', jsonb_array_length(calcs); END IF;
  -- 2. provisao acumulada ate 2023 contra Ajustes de Exercicios Anteriores
  prov := -pg_temp.saldo(emp, '22102010001', DATE '2099-12-31');
  IF prov <> 36489480.45 OR -pg_temp.saldo(emp, '22102010001', DATE '2024-12-31') <> 36489480.45 THEN
    RAISE EXCEPTION 'Provisao (22102010001): esperado 36.489.480,45 credor, encontrado % - nada alterado', prov; END IF;
  x := pg_temp.novo(emp, DATE '2024-12-31', 'AJ-EQ-HOTELSYS-LIMITE',
    U&'Revers\00e3o da provis\00e3o para perdas no investimento na Hotelsys (99%) acumulada at\00e9 31/12/2023, R$ 36.489.480,45 (inclusive o saldo de abertura de 2018), contra Ajustes de Exerc\00edcios Anteriores. Fundamenta\00e7\00e3o: CPC 18 (R2), itens 38 e 39 - reduzido a zero o valor cont\00e1bil do investimento, perdas adicionais s\00f3 s\00e3o reconhecidas como passivo na medida em que o investidor tenha incorrido em obriga\00e7\00f5es legais ou construtivas ou feito pagamentos em nome da investida. A Sunrise, sociedade limitada, responde apenas pelo valor de suas quotas (C\00f3digo Civil, art. 1.052), n\00e3o prestou garantia nem aval e n\00e3o assumiu compromisso de cobrir passivos da Hotelsys; os passivos do Anexo V foram assumidos pela Real Mouch\00e3o na confiss\00e3o de d\00edvida de 31/10/2025. Perdas n\00e3o reconhecidas ser\00e3o compensadas com lucros futuros da investida antes de se retomar o reconhecimento de ganhos (CPC 18, item 39). Apura\00e7\00f5es de 2024 e 2025 exclu\00eddas pelo mesmo crit\00e9rio.',
    ARRAY[ARRAY['22102010001','DEBIT','36489480.45'], ARRAY['23301020003','CREDIT','36489480.45']]);
  IF pg_temp.saldo(emp, '22102010001', DATE '2099-12-31') <> 0 THEN RAISE EXCEPTION 'Provisao nao zerou - nada alterado'; END IF;
  -- 3. participacao sem conta de provisao
  UPDATE equity_method_investments SET provision_account_id = NULL, updated_at = now() WHERE id = inv;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
    'CONTABIL_CORRECAO_ORIGEM', x::text, jsonb_build_object('pacote', 'sunrise-equivalencia-limite-20261022', 'lancamento', x,
      'apuracoes_removidas', calcs, 'provisao_revertida', prov), now());
  RAISE NOTICE 'Correcao aplicada: apuracoes de 2024 e 2025 excluidas; provisao de % revertida em 31/12/2024 contra AEA', prov;
END $$;
SELECT a.code, a.name, d.dt AS data,
       to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.deleted_at IS NULL AND j.date::date <= d.dt), 0), 'FM999G999G990D00') AS saldo
  FROM (VALUES (DATE '2023-12-31'), (DATE '2024-12-31'), (DATE '2025-12-31')) d(dt)
  CROSS JOIN chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
 WHERE a.company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f' AND a.deleted_at IS NULL AND a.code IN ('12201020002', '22102010001', '23301020003')
 GROUP BY a.code, a.name, d.dt ORDER BY 1, 3;
COMMIT;
