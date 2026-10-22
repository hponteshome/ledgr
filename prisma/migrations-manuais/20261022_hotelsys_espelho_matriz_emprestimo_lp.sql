-- prisma/migrations-manuais/20261022_hotelsys_espelho_matriz_emprestimo_lp.sql
-- 22/10/2026 - Hotelsys, correcoes na origem:
--  1. Espelho Conta Corrente Filial x Matriz: na ABERTURA-2018 (31/12/2017) saem as duas partidas espelhadas
--     D 12101020001 Mutuo Ligadas 16.890.513,66 / C 22101050002 Conta Corrente Matriz 16.890.513,66 (mesma empresa).
--  2. Os dois creditos de 2018 do "Mutuo Diretor - operacao de cambio" em 12101020001 (125.505,00 e 431.511,31) passam para
--     22101050001 Socios e Diretores (divida com o diretor). Mutuo Ligadas e Conta Corrente Matriz zeram.
--  3. Emprestimo com garantia de 08/2024 (150.000,00): conta nova de longo prazo 22101060004 Emprestimos de Terceiros;
--     a partida de 21101030008 passa para ela.
-- Ativo -16.333.497,35; passivo -16.333.497,35; PL inalterado. Reexecutar nao altera nada.
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
DO $$
DECLARE emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; ab uuid; esp jsonb; n int; v numeric; ids uuid[]; nova uuid := gen_random_uuid(); red int;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'espelho-matriz-emprestimo-lp-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  -- 1. partidas espelhadas da abertura de 2018
  SELECT id INTO ab FROM journal_entries WHERE company_id = emp AND deleted_at IS NULL AND reference = 'ABERTURA-2018' AND date::date = DATE '2017-12-31';
  IF ab IS NULL THEN RAISE EXCEPTION 'ABERTURA-2018 nao encontrada - nada alterado'; END IF;
  SELECT jsonb_agg(to_jsonb(i)), count(*), array_agg(i.id) INTO esp, n, ids FROM journal_entry_items i
   WHERE i.journal_entry_id = ab AND i.value = 16890513.66
     AND ((i.account_id = pg_temp.acc(emp, '12101020001') AND i.type::text = 'DEBIT') OR (i.account_id = pg_temp.acc(emp, '22101050002') AND i.type::text = 'CREDIT'));
  IF n <> 2 THEN RAISE EXCEPTION 'Partidas espelhadas na ABERTURA-2018: esperadas 2, encontradas % - nada alterado', n; END IF;
  DELETE FROM journal_entry_items WHERE id = ANY(ids);
  -- 2. creditos de 2018 do Mutuo Diretor
  SELECT count(*), COALESCE(sum(i.value), 0), array_agg(i.id) INTO n, v, ids FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND i.account_id = pg_temp.acc(emp, '12101020001') AND i.type::text = 'CREDIT'
     AND j.date::date BETWEEN DATE '2018-01-01' AND DATE '2018-12-31';
  IF n <> 2 OR v <> 557016.31 THEN RAISE EXCEPTION 'Creditos de 2018 em Mutuo Ligadas: esperado 2 / 557.016,31, encontrado % / % - nada alterado', n, v; END IF;
  UPDATE journal_entry_items SET account_id = pg_temp.acc(emp, '22101050001') WHERE id = ANY(ids);
  IF pg_temp.saldo(emp, '12101020001') <> 0 OR pg_temp.saldo(emp, '22101050002') <> 0 THEN
    RAISE EXCEPTION 'Mutuo Ligadas / Conta Corrente Matriz nao zeraram (% / %) - nada alterado', pg_temp.saldo(emp, '12101020001'), pg_temp.saldo(emp, '22101050002'); END IF;
  -- 3. conta de longo prazo para o emprestimo de 08/2024
  IF EXISTS (SELECT 1 FROM chart_of_accounts WHERE company_id = emp AND code = '22101060004' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Conta 22101060004 ja existe - nada alterado'; END IF;
  SELECT max(reduced_code::int) + 1 INTO red FROM chart_of_accounts WHERE company_id = emp AND deleted_at IS NULL AND reduced_code ~ '^23[0-9][0-9]$';
  INSERT INTO chart_of_accounts SELECT (jsonb_populate_record(NULL::chart_of_accounts, to_jsonb(m) || jsonb_build_object(
      'id', nova, 'code', '22101060004', 'name', U&'Empr\00e9stimos de Terceiros', 'reduced_code', red::text, 'sped_code', NULL,
      'created_at', now(), 'updated_at', now(), 'created_by_id', '421642c8-e981-49c9-996c-b4bfabc22b52', 'updated_by_id', NULL))).*
    FROM chart_of_accounts m WHERE m.id = pg_temp.acc(emp, '22101060001');
  SELECT count(*), COALESCE(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END), 0), array_agg(i.id) INTO n, v, ids
    FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND i.account_id = pg_temp.acc(emp, '21101030008');
  IF v <> 150000.00 THEN RAISE EXCEPTION 'Emprestimo de Terceiros (21101030008): esperado saldo credor 150.000,00, encontrado % (% partidas) - nada alterado', v, n; END IF;
  UPDATE journal_entry_items SET account_id = nova WHERE id = ANY(ids);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
    'CONTABIL_CORRECAO_ORIGEM', ab::text, jsonb_build_object('pacote', 'espelho-matriz-emprestimo-lp-20261022', 'partidas_excluidas', esp,
      'mutuo_diretor_para', '22101050001', 'emprestimo_conta', '22101060004', 'emprestimo_partidas', n, 'emprestimo_reduzido', red), now());
  RAISE NOTICE 'Correcao aplicada: espelho de 16.890.513,66 eliminado; 557.016,31 em Socios e Diretores; emprestimo de 150.000,00 em 22101060004 (reduzido %)', red;
END $$;
SELECT a.code, a.reduced_code AS red, a.name,
       to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.deleted_at IS NULL AND j.date::date <= DATE '2025-10-31'), 0), 'FM999G999G990D00') AS saldo_31_10_2025
  FROM chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
 WHERE a.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND a.deleted_at IS NULL
   AND a.code IN ('12101020001','22101050002','22101050001','21101030008','22101060004')
 GROUP BY a.code, a.reduced_code, a.name ORDER BY 1;
COMMIT;
