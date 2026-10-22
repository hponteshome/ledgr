-- prisma/migrations-manuais/20261022_hotelsys_iptu2025_emprestimo.sql
-- 22/10/2026 - Hotelsys, correcoes na origem (sem estorno):
--  1. IPTU do exercicio de 2025 pelo fato gerador (1o de janeiro): novo lancamento em 02/01/2025, D 42103010020 IPTU, ITR e Incra /
--     C 21101060012 IPTU a Pagar, R$ 513.823,45 (extrato da Prefeitura de 21/10/2026, IPTU + TLP + CIM 2025 com encargos).
--     Os 7 lancamentos de 31/12/2025 do contador anterior (ECD, R$ 486.394,07: IPTU, TLP, CIM, juros e multas de 2025), que o
--     extrato ja contem, sao excluidos (soft delete). IPTU a Pagar em 31/10/2025 = 11.714.225,36, igual a relacao de credores.
--  2. Emprestimo com garantia (Carlos e Eliane, 08/2024, R$ 150.000,00): obrigacao da Hotelsys. Exclui (soft delete) o lancamento
--     do lote de 31/12/2024 que baixou Emprestimos de Terceiros (21101030008) contra Ajustes de Exercicios Anteriores.
-- Confere cada lancamento antes; qualquer divergencia aborta tudo. Reexecutar nao duplica.
-- Depois: refazer na tela os encerramentos de 2024 e 2025 da Hotelsys.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; usr uuid := '421642c8-e981-49c9-996c-b4bfabc22b52';
  a_iptu uuid; a_desp uuid; a_emp uuid; a_aea uuid; ids uuid[]; n int; s numeric; r record; tmpl uuid; novo uuid; u text; emp_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'iptu2025-emprestimo-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  SELECT id INTO a_iptu FROM chart_of_accounts WHERE company_id = emp AND code = '21101060012' AND deleted_at IS NULL;
  SELECT id INTO a_desp FROM chart_of_accounts WHERE company_id = emp AND code = '42103010020' AND deleted_at IS NULL;
  SELECT id INTO a_emp FROM chart_of_accounts WHERE company_id = emp AND code = '21101030008' AND deleted_at IS NULL;
  SELECT id INTO a_aea FROM chart_of_accounts WHERE company_id = emp AND code = '23301020003' AND deleted_at IS NULL;
  IF a_iptu IS NULL OR a_desp IS NULL OR a_emp IS NULL OR a_aea IS NULL THEN RAISE EXCEPTION 'Conta nao encontrada - nada alterado'; END IF;

  -- 1a. os 7 lancamentos de 31/12/2025 que creditam IPTU a Pagar
  SELECT array_agg(DISTINCT e.id), count(DISTINCT e.id), sum(i.value) INTO ids, n, s
    FROM journal_entries e JOIN journal_entry_items i ON i.journal_entry_id = e.id
   WHERE e.company_id = emp AND e.deleted_at IS NULL AND e.date::date = DATE '2025-12-31' AND i.account_id = a_iptu AND i.type::text = 'CREDIT';
  IF n <> 7 OR s <> 486394.07 THEN RAISE EXCEPTION 'IPTU 31/12/2025: esperado 7 lancamentos / 486394.07; encontrado % / % - nada alterado', n, s; END IF;
  FOR r IN SELECT e.id, e.reference, (SELECT count(*) FROM journal_entry_items x WHERE x.journal_entry_id = e.id) AS k,
                  (SELECT sum(value) FROM journal_entry_items x WHERE x.journal_entry_id = e.id AND x.type::text = 'CREDIT' AND x.account_id <> a_iptu) AS outros_cred
             FROM journal_entries e WHERE e.id = ANY(ids) LOOP
    IF r.k <> 2 OR COALESCE(r.outros_cred, 0) <> 0 THEN
      RAISE EXCEPTION 'Lancamento % de 31/12/2025 tem % partidas ou credito em outra conta - nada alterado', r.reference, r.k; END IF;
  END LOOP;
  tmpl := ids[1];
  UPDATE journal_entries SET deleted_at = now(), updated_at = now() WHERE id = ANY(ids);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
    SELECT gen_random_uuid(), usr, 'CONTABIL_LANCAMENTO_EXCLUIDO', x::text,
           jsonb_build_object('motivo', 'IPTU 2025 do contador anterior em 31/12/2025: substituido pelo lancamento de 02/01/2025 pelo extrato (fato gerador)'), now()
      FROM unnest(ids) x;

  -- 1b. novo lancamento de 02/01/2025 (copia a estrutura de um lancamento existente da empresa)
  novo := gen_random_uuid();
  INSERT INTO journal_entries SELECT (jsonb_populate_record(NULL::journal_entries, to_jsonb(e) || jsonb_build_object(
      'id', novo, 'date', '2025-01-02T00:00:00', 'reference', 'AJ-IPTU-2025',
      'description', U&'IPTU, TLP e CIM do exerc\00edcio de 2025 (fato gerador 01/01/2025), pelo extrato da Prefeitura do Jaboat\00e3o de 21/10/2026, com encargos',
      'source_module', 'ACCOUNTING', 'deleted_at', NULL, 'import_lote_id', NULL, 'is_closing_entry', false,
      'created_at', now(), 'updated_at', now()))).* FROM journal_entries e WHERE e.id = tmpl;
  SELECT udt_name INTO u FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entry_items' AND column_name = 'type';
  EXECUTE format('INSERT INTO journal_entry_items (id, journal_entry_id, account_id, value, type, description, created_at) VALUES
      (gen_random_uuid(), $1, $2, 513823.45, %L::%I, $4, now()), (gen_random_uuid(), $1, $3, 513823.45, %L::%I, $4, now())', 'DEBIT', u, 'CREDIT', u)
    USING novo, a_desp, a_iptu, U&'IPTU, TLP e CIM do exerc\00edcio de 2025 - extrato da Prefeitura';
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), usr, 'CONTABIL_LANCAMENTO_CRIADO', novo::text,
    jsonb_build_object('ref', 'AJ-IPTU-2025', 'valor', 513823.45, 'motivo', 'IPTU 2025 pelo fato gerador'), now());

  -- 2. lancamento do lote que baixou o emprestimo
  SELECT array_agg(e.id), count(*) INTO ids, n FROM journal_entries e
   WHERE e.company_id = emp AND e.deleted_at IS NULL AND e.date::date = DATE '2024-12-31'
     AND EXISTS (SELECT 1 FROM journal_entry_items i WHERE i.journal_entry_id = e.id AND i.account_id = a_emp AND i.type::text = 'DEBIT' AND i.value = 150000.00)
     AND EXISTS (SELECT 1 FROM journal_entry_items i WHERE i.journal_entry_id = e.id AND i.account_id = a_aea AND i.type::text = 'CREDIT' AND i.value = 150000.00)
     AND (SELECT count(*) FROM journal_entry_items i WHERE i.journal_entry_id = e.id) = 2;
  IF n <> 1 THEN RAISE EXCEPTION 'Baixa do emprestimo em 31/12/2024: esperado 1 lancamento, encontrado % - nada alterado', n; END IF;
  UPDATE journal_entries SET deleted_at = now(), updated_at = now() WHERE id = ids[1];
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), usr, 'CONTABIL_LANCAMENTO_EXCLUIDO', ids[1]::text,
    jsonb_build_object('motivo', 'Emprestimo com garantia (08/2024) e obrigacao da Hotelsys: nao se baixa'), now());

  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), usr, 'CONTABIL_CORRECAO_ORIGEM', 'iptu2025-emprestimo-20261022',
    jsonb_build_object('pacote', 'iptu2025-emprestimo-20261022', 'iptu_2025', 513823.45, 'excluidos_31122025', 7, 'emprestimo', 150000.00), now());
  RAISE NOTICE 'Correcao aplicada: IPTU 2025 em 02/01/2025 (513823.45), 7 lancamentos de 31/12/2025 excluidos, emprestimo de 150000.00 restabelecido';
END $$;
SELECT a.code, a.name, d.dt AS data,
       to_char(COALESCE(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.deleted_at IS NULL AND j.date::date <= d.dt), 0), 'FM999G999G990D00') AS saldo_credor
  FROM (VALUES (DATE '2024-12-31'), (DATE '2025-10-31'), (DATE '2025-12-31'), (DATE '2026-09-30')) d(dt)
  CROSS JOIN chart_of_accounts a
  LEFT JOIN journal_entry_items i ON i.account_id = a.id
  LEFT JOIN journal_entries j ON j.id = i.journal_entry_id
 WHERE a.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND a.code IN ('21101060012', '21101030008') AND a.deleted_at IS NULL
 GROUP BY a.code, a.name, d.dt ORDER BY 1, 3;
COMMIT;
