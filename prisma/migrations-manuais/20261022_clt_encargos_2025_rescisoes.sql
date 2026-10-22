-- prisma/migrations-manuais/20261022_clt_encargos_2025_rescisoes.sql
-- 22/10/2026 - Hotelsys: juros, multas e encargos legais s/ CLT de 2025 (31/12/2025, origem ECD-2025, 38 partidas,
-- R$ 161.232,60) corrigidos NA ORIGEM: a partida credora sai de 21101020006 Outras Contas a Pagar e vai para
-- 21101040010 Rescisoes Trabalhistas a Pagar. Debitos (despesas) inalterados. Confere quantidade e soma antes;
-- qualquer divergencia aborta. Reexecutar nao duplica.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; a_de uuid; a_para uuid; n int; s numeric; ids uuid[];
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'clt-2025-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  SELECT id INTO a_de FROM chart_of_accounts WHERE company_id = emp AND code = '21101020006' AND deleted_at IS NULL;
  SELECT id INTO a_para FROM chart_of_accounts WHERE company_id = emp AND code = '21101040010' AND deleted_at IS NULL;
  IF a_de IS NULL OR a_para IS NULL THEN RAISE EXCEPTION 'Conta nao encontrada - nada alterado'; END IF;
  SELECT array_agg(i.id), count(*), COALESCE(sum(i.value), 0) INTO ids, n, s
    FROM journal_entry_items i JOIN journal_entries e ON e.id = i.journal_entry_id
   WHERE e.company_id = emp AND e.deleted_at IS NULL AND e.date::date = DATE '2025-12-31' AND e.reference = 'ECD-2025'
     AND i.account_id = a_de AND i.type::text = 'CREDIT' AND coalesce(i.description, e.description) ILIKE '%CLT%';
  IF n <> 38 OR s <> 161232.60 THEN
    RAISE EXCEPTION 'Esperado 38 partidas / 161232.60; encontrado % / % - nada alterado', n, s; END IF;
  UPDATE journal_entry_items SET account_id = a_para WHERE id = ANY(ids);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
    'CONTABIL_CORRECAO_ORIGEM', 'clt-2025-20261022', jsonb_build_object('pacote', 'clt-2025-20261022', 'de', '21101020006', 'para', '21101040010',
    'partidas', n, 'valor', s, 'itens', to_jsonb(ids)), now());
  RAISE NOTICE 'Encargos CLT 2025: % partidas (%) movidas para Rescisoes Trabalhistas', n, s;
END $$;
SELECT a.code, a.name, to_char(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END), 'FM999G999G990D00') AS saldo_30_09_2026
  FROM journal_entry_items i JOIN journal_entries e ON e.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
 WHERE e.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND e.deleted_at IS NULL AND e.date::date <= DATE '2026-09-30'
   AND a.code IN ('21101010001', '21101020006', '21101040010') GROUP BY a.code, a.name ORDER BY a.code;
COMMIT;
