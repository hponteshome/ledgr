-- prisma/migrations-manuais/20261022_sunrise_pl_prejuizos_acumulados.sql
-- 22/10/2026 - Sunrise, PL na origem:
--  1. Configuracao do encerramento: "Prejuizos Acumulados" apontava para a conta legada da ECD 23501002 (sem reduzido);
--     passa para 23301020001 Prejuizos Acumulados.
--  2. Partidas de encerramento (2019-2025) em 23501002 (22.400.584,97 D) passam para 23301020001.
--  3. Prejuizo acumulado da abertura de 2018 lancado em 23301010001 Lucros Acumulados (25.248.344,65 D) passa para 23301020001.
-- PL total inalterado. Lucros Acumulados e 23501002 zeram. Reexecutar nao altera nada.
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
DECLARE emp uuid := 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f'; cfg_antes uuid; n1 int; v1 numeric; ids1 uuid[]; n2 int; v2 numeric; ids2 uuid[];
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'sunrise-pl-prejuizos-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  -- 1. configuracao do encerramento
  SELECT encerramento_conta_prejuizos_acumulados_id INTO cfg_antes FROM company_accounting_configs WHERE company_id = emp;
  UPDATE company_accounting_configs SET encerramento_conta_prejuizos_acumulados_id = pg_temp.acc(emp, '23301020001'), updated_at = now()
   WHERE company_id = emp;
  -- 2. partidas em 23501002
  SELECT count(*), COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 0), array_agg(i.id) INTO n1, v1, ids1
    FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND i.account_id = pg_temp.acc(emp, '23501002');
  IF v1 <> 22400584.97 THEN RAISE EXCEPTION 'Conta 23501002: esperado 22.400.584,97 D, encontrado % (% partidas) - nada alterado', v1, n1; END IF;
  UPDATE journal_entry_items SET account_id = pg_temp.acc(emp, '23301020001') WHERE id = ANY(ids1);
  -- 3. Lucros Acumulados devedor (abertura de 2018)
  SELECT count(*), COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 0), array_agg(i.id) INTO n2, v2, ids2
    FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND i.account_id = pg_temp.acc(emp, '23301010001');
  IF v2 <> 25248344.65 OR EXISTS (SELECT 1 FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
       WHERE i.id = ANY(ids2) AND j.date::date > DATE '2017-12-31') THEN
    RAISE EXCEPTION 'Lucros Acumulados: esperado 25.248.344,65 D so na abertura, encontrado % (% partidas) - nada alterado', v2, n2; END IF;
  UPDATE journal_entry_items SET account_id = pg_temp.acc(emp, '23301020001') WHERE id = ANY(ids2);
  IF pg_temp.saldo(emp, '23501002') <> 0 OR pg_temp.saldo(emp, '23301010001') <> 0 THEN RAISE EXCEPTION 'Contas nao zeraram - nada alterado'; END IF;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
    'CONTABIL_CORRECAO_ORIGEM', emp::text, jsonb_build_object('pacote', 'sunrise-pl-prejuizos-20261022', 'config_prejuizos_antes', cfg_antes,
      'itens_23501002', to_jsonb(ids1), 'itens_lucros_acumulados', to_jsonb(ids2)), now());
  RAISE NOTICE 'Correcao aplicada: % partidas de 23501002 e % de Lucros Acumulados em Prejuizos Acumulados; configuracao do encerramento corrigida', n1, n2;
END $$;
SELECT a.code, a.name, to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.deleted_at IS NULL), 0), 'FM999G999G990D00') AS saldo
  FROM chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
 WHERE a.company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f' AND a.deleted_at IS NULL
   AND a.code IN ('23301010001','23501002','23301020001','23301020002','23301020003','23101010001','23101020001')
 GROUP BY a.code, a.name ORDER BY 1;
COMMIT;
