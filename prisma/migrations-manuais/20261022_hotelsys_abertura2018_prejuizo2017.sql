-- prisma/migrations-manuais/20261022_hotelsys_abertura2018_prejuizo2017.sql
-- 22/10/2026 - Hotelsys: na abertura de 2018 (ABERTURA-2018, 31/12/2017) o prejuizo de 2017 (3.421.552,46 D) estava em
-- 23301010002 Lucro do Exercicio; o encerramento de 2018 o levou a 23301010001 Lucros Acumulados (saldo devedor).
-- Correcao na origem: a partida passa para 23301020002 Prejuizo do Exercicio. Ao refazer os encerramentos (2018 em diante)
-- o valor vai para 23301020001 Prejuizos Acumulados. PL total inalterado.
-- Reexecutar nao altera nada.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; a_de uuid; a_para uuid; it uuid; n int;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'abertura2018-prejuizo2017-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  SELECT id INTO a_de FROM chart_of_accounts WHERE company_id = emp AND code = '23301010002' AND deleted_at IS NULL;
  SELECT id INTO a_para FROM chart_of_accounts WHERE company_id = emp AND code = '23301020002' AND deleted_at IS NULL;
  IF a_de IS NULL OR a_para IS NULL THEN RAISE EXCEPTION 'Contas 23301010002/23301020002 nao encontradas - nada alterado'; END IF;
  SELECT count(*), min(i.id::text)::uuid INTO n, it FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.reference = 'ABERTURA-2018' AND j.date::date = DATE '2017-12-31'
     AND i.account_id = a_de AND i.type::text = 'DEBIT' AND i.value = 3421552.46;
  IF n <> 1 THEN RAISE EXCEPTION 'Partida da abertura de 2018 (23301010002 D 3.421.552,46): esperada 1, encontradas % - nada alterado', n; END IF;
  UPDATE journal_entry_items SET account_id = a_para WHERE id = it;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
    'CONTABIL_CORRECAO_ORIGEM', it::text, jsonb_build_object('pacote', 'abertura2018-prejuizo2017-20261022', 'item', it,
      'de', '23301010002', 'para', '23301020002', 'valor', 3421552.46), now());
  RAISE NOTICE 'Correcao aplicada: prejuizo de 2017 (3.421.552,46) na abertura de 2018 passa para Prejuizo do Exercicio';
END $$;
SELECT a.code, a.name,
       to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.deleted_at IS NULL AND j.date::date <= DATE '2017-12-31'), 0), 'FM999G999G990D00') AS saldo_31_12_2017
  FROM chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
 WHERE a.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND a.deleted_at IS NULL AND a.code IN ('23301010001','23301010002','23301020001','23301020002')
 GROUP BY a.code, a.name ORDER BY 1;
COMMIT;
