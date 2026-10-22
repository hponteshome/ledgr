-- prisma/migrations-manuais/20261022_f5_sunrise_limite_afac.sql
-- 22/10/2026 - Cadeia F5 -> Sunrise, correcoes na origem:
--  1. F5: lancamento de 09/07/2025 (aquisicao da Sunrise por R$ 1,00) - perda de equivalencia limitada ao investimento
--     (CPC 18, itens 38 e 39): D 42701010001 15.354.091,02 -> 1,00; sai a partida C 22102010001 15.354.090,02 (provisao).
--     Historico com a fundamentacao (o anterior fica no audit_logs). Participacao F5 -> Sunrise sem conta de provisao.
--  2. Sunrise: AFAC de 07/2025 (8.485.474,63) e irrevogavel - conta nova no PL 23101020001 Adiantamento para Futuro Aumento de
--     Capital; as partidas de 22501010001 passam para ela.
-- Depois: refazer na tela o encerramento de 2025 da F5. Reexecutar nao altera nada.
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
DECLARE f5 uuid := 'e274dfc0-0a9a-4af1-8141-f35ff73fac93'; sr uuid := 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f';
  je uuid := '6fba558d-f51f-4283-9fa9-b614c34562b5'; antes jsonb; h text := U&'Reconhecimento, na aquisi\00e7\00e3o de 100% das quotas da SUNRISE HOTELS & RESORTS HOLDING LTDA. em 09/07/2025 pelo valor simb\00f3lico de R$ 1,00, da perda de equival\00eancia patrimonial limitada ao valor cont\00e1bil do investimento (R$ 1,00). Fundamenta\00e7\00e3o: CPC 18 (R2), itens 38 e 39 - reduzido a zero o valor cont\00e1bil do investimento, perdas adicionais s\00f3 s\00e3o reconhecidas como passivo na medida em que o investidor tenha incorrido em obriga\00e7\00f5es legais ou construtivas ou feito pagamentos em nome da investida. A F5 responde pela Sunrise, sociedade limitada, apenas pelo valor das quotas (C\00f3digo Civil, art. 1.052), n\00e3o prestou garantia nem aval e n\00e3o assumiu as d\00edvidas pr\00f3prias da Sunrise. A obriga\00e7\00e3o da F5 de quitar os passivos da Hotelsys do Anexo V est\00e1 registrada \00e0 parte (22103010001 Quita\00e7\00e3o dos passivos da Hotelsys), em contrapartida ao cr\00e9dito contra a Real Mouch\00e3o (confiss\00e3o de d\00edvida de 31/10/2025). Perdas n\00e3o reconhecidas ser\00e3o compensadas com lucros futuros da investida antes de se retomar o reconhecimento de ganhos (CPC 18, item 39).'; ha text := U&'Adiantamento para futuro aumento de capital, irrevog\00e1vel, reclassificado do passivo para o patrim\00f4nio l\00edquido (decis\00e3o de 22/10/2026)';
  n int; v numeric; ids uuid[]; nova uuid := gen_random_uuid(); red int;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'f5-sunrise-limite-afac-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  -- 1. F5
  IF NOT EXISTS (SELECT 1 FROM journal_entries WHERE id = je AND company_id = f5 AND deleted_at IS NULL AND date::date = DATE '2025-07-09') THEN
    RAISE EXCEPTION 'Lancamento de equivalencia da F5 de 09/07/2025 nao encontrado - nada alterado'; END IF;
  SELECT jsonb_build_object('descricao', (SELECT description FROM journal_entries WHERE id = je),
         'partidas', jsonb_agg(jsonb_build_object('id', i.id, 'conta', a.code, 'tipo', i.type::text, 'valor', i.value, 'hist', i.description)))
    INTO antes FROM journal_entry_items i JOIN chart_of_accounts a ON a.id = i.account_id WHERE i.journal_entry_id = je;
  IF (SELECT count(*) FROM journal_entry_items WHERE journal_entry_id = je) <> 3
     OR NOT EXISTS (SELECT 1 FROM journal_entry_items WHERE journal_entry_id = je AND account_id = pg_temp.acc(f5, '42701010001') AND type::text = 'DEBIT' AND value = 15354091.02)
     OR NOT EXISTS (SELECT 1 FROM journal_entry_items WHERE journal_entry_id = je AND account_id = pg_temp.acc(f5, '12201020001') AND type::text = 'CREDIT' AND value = 1.00)
     OR NOT EXISTS (SELECT 1 FROM journal_entry_items WHERE journal_entry_id = je AND account_id = pg_temp.acc(f5, '22102010001') AND type::text = 'CREDIT' AND value = 15354090.02) THEN
    RAISE EXCEPTION 'Partidas do lancamento de 09/07/2025 da F5 nao conferem - nada alterado'; END IF;
  DELETE FROM journal_entry_items WHERE journal_entry_id = je AND account_id = pg_temp.acc(f5, '22102010001');
  UPDATE journal_entry_items SET value = 1.00 WHERE journal_entry_id = je AND account_id = pg_temp.acc(f5, '42701010001');
  UPDATE journal_entries SET description = h, updated_at = now() WHERE id = je;
  UPDATE journal_entry_items SET description = h WHERE journal_entry_id = je AND description IS NOT NULL;
  IF pg_temp.saldo(f5, '22102010001') <> 0 THEN RAISE EXCEPTION 'Provisao da F5 (22102010001) nao zerou - nada alterado'; END IF;
  UPDATE equity_method_investments SET provision_account_id = NULL, updated_at = now()
   WHERE investor_company_id = f5 AND investee_company_id = sr AND deleted_at IS NULL;
  -- 2. Sunrise: AFAC no PL
  IF EXISTS (SELECT 1 FROM chart_of_accounts WHERE company_id = sr AND code = '23101020001' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Conta 23101020001 ja existe na Sunrise - nada alterado'; END IF;
  SELECT max(reduced_code::int) + 1 INTO red FROM chart_of_accounts WHERE company_id = sr AND deleted_at IS NULL AND reduced_code ~ '^24[0-9][0-9]$';
  INSERT INTO chart_of_accounts SELECT (jsonb_populate_record(NULL::chart_of_accounts, to_jsonb(m) || jsonb_build_object(
      'id', nova, 'code', '23101020001', 'name', 'Adiantamento para Futuro Aumento de Capital', 'parent_id', pg_temp.acc(sr, '2310102'),
      'reduced_code', red::text, 'sped_code', NULL, 'created_at', now(), 'updated_at', now(),
      'created_by_id', '421642c8-e981-49c9-996c-b4bfabc22b52', 'updated_by_id', NULL))).*
    FROM chart_of_accounts m WHERE m.id = pg_temp.acc(sr, '23101010001');
  SELECT count(*), COALESCE(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END), 0), array_agg(i.id) INTO n, v, ids
    FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
   WHERE j.company_id = sr AND j.deleted_at IS NULL AND i.account_id = pg_temp.acc(sr, '22501010001');
  IF v <> 8485474.63 THEN RAISE EXCEPTION 'AFAC da Sunrise (22501010001): esperado 8.485.474,63 credor, encontrado % (% partidas) - nada alterado', v, n; END IF;
  UPDATE journal_entry_items SET account_id = nova WHERE id = ANY(ids);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
    'CONTABIL_CORRECAO_ORIGEM', je::text, jsonb_build_object('pacote', 'f5-sunrise-limite-afac-20261022', 'f5_antes', antes,
      'afac_partidas', to_jsonb(ids), 'afac_conta', '23101020001', 'afac_reduzido', red, 'afac_obs', ha), now());
  RAISE NOTICE 'Correcao aplicada: F5 com perda limitada a R$ 1,00 (provisao de 15.354.090,02 retirada); AFAC da Sunrise (8.485.474,63) no PL em 23101020001 (reduzido %)', red;
END $$;
SELECT 'F5' AS empresa, a.code, a.name, to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 0), 'FM999G999G990D00') AS saldo
  FROM chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id LEFT JOIN journal_entries j ON j.id = i.journal_entry_id AND j.deleted_at IS NULL
 WHERE a.company_id = 'e274dfc0-0a9a-4af1-8141-f35ff73fac93' AND a.deleted_at IS NULL AND a.code IN ('12201020001','22102010001','42701010001')
   AND (i.id IS NULL OR j.id IS NOT NULL) GROUP BY a.code, a.name
UNION ALL
SELECT 'SUNRISE', a.code, a.name, to_char(COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 0), 'FM999G999G990D00')
  FROM chart_of_accounts a LEFT JOIN journal_entry_items i ON i.account_id = a.id LEFT JOIN journal_entries j ON j.id = i.journal_entry_id AND j.deleted_at IS NULL
 WHERE a.company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f' AND a.deleted_at IS NULL AND a.code IN ('22501010001','23101020001')
   AND (i.id IS NULL OR j.id IS NOT NULL) GROUP BY a.code, a.name ORDER BY 1, 2;
COMMIT;
