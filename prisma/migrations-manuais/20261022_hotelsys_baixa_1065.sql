-- prisma/migrations-manuais/20261022_hotelsys_baixa_1065.sql
-- 22/10/2026 - Hotelsys: pagamentos de antes de 31/10/2025 que estavam em 11304010009 (Passivos quitados pela Operacao Ancora - a
-- reclassificar, por falta de comprovante) corrigidos NA ORIGEM (sem estorno). A lista do Anexo V em 31/10/2025 ja considerava as baixas.
--  - federais (3 pagamentos, 667.735,00) -> 21101050001; trabalhistas (9, 381.364,00) -> 21101040010; Fernando Galvao (5.000,00) -> 21101020007
--  - nao sao passivo: Solsys 415.000,00 e taxas municipais 400,74 -> Taxas Diversas; cartorio 845,97; custas 10.484,95; arbitragem
--    67.288,26 -> Despesas Legais e Judiciais; devolucoes AV por ordem do Intermediario 316.753,71 -> Indenizacoes e Sinistros.
--  - lote de 31/12/2024: a linha dos federais deixa de repor as baixas dos DARFs (799.061,28): passa de D 23301020003 / C 21101050001
--    68.786,43 para D 21101050001 / C 23301020003 730.274,85. Federais em 31/10/2025 = 17.371.723,23.
-- Total movido: 1,864,872.63. Confere cada lancamento antes; qualquer divergencia aborta tudo. Reexecutar nao duplica.
-- Depois: refazer na tela os encerramentos de 2024 e 2025 da Hotelsys.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
CREATE FUNCTION pg_temp.acc(emp uuid, c text) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE r uuid; BEGIN SELECT id INTO r FROM chart_of_accounts WHERE company_id = emp AND code = c AND deleted_at IS NULL;
  IF r IS NULL THEN RAISE EXCEPTION 'Conta % nao encontrada', c; END IF; RETURN r; END $f$;
CREATE FUNCTION pg_temp.je(emp uuid, ref text, dt date, n int) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE r uuid; k int; BEGIN SELECT count(*) INTO k FROM journal_entries WHERE company_id = emp AND reference = ref AND date::date = dt AND deleted_at IS NULL;
  IF k <> 1 THEN RAISE EXCEPTION 'Lancamento % de % nao encontrado (ou repetido: %) - nada alterado', ref, dt, k; END IF;
  SELECT id INTO r FROM journal_entries WHERE company_id = emp AND reference = ref AND date::date = dt AND deleted_at IS NULL;
  SELECT count(*) INTO k FROM journal_entry_items WHERE journal_entry_id = r;
  IF k <> n THEN RAISE EXCEPTION 'Lancamento % tem % partidas (esperado %) - nada alterado', ref, k, n; END IF;
  RETURN r; END $f$;
CREATE FUNCTION pg_temp.item(je uuid, emp uuid, c text, tipo text, v numeric) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE r uuid; k int; a uuid; BEGIN a := pg_temp.acc(emp, c);
  SELECT count(*) INTO k FROM journal_entry_items i WHERE i.journal_entry_id = je AND i.account_id = a AND i.type::text = tipo AND i.value = v;
  IF k <> 1 THEN RAISE EXCEPTION 'Partida % % % nao encontrada no lancamento % - nada alterado', tipo, c, v, (SELECT reference FROM journal_entries WHERE id = je); END IF;
  SELECT i.id INTO r FROM journal_entry_items i WHERE i.journal_entry_id = je AND i.account_id = a AND i.type::text = tipo AND i.value = v; RETURN r; END $f$;
CREATE FUNCTION pg_temp.setv(je uuid, emp uuid, c text, tipo text, v0 numeric, v1 numeric) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE x uuid; BEGIN x := pg_temp.item(je, emp, c, tipo, v0); UPDATE journal_entry_items SET value = v1 WHERE id = x; END $f$;
CREATE FUNCTION pg_temp.setacc(je uuid, emp uuid, c text, tipo text, v numeric, c1 text, h text) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE x uuid; a1 uuid; BEGIN x := pg_temp.item(je, emp, c, tipo, v); a1 := pg_temp.acc(emp, c1); UPDATE journal_entry_items SET account_id = a1, description = h WHERE id = x; END $f$;
CREATE FUNCTION pg_temp.add(je uuid, emp uuid, c text, tipo text, v numeric, h text) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE u text; BEGIN SELECT udt_name INTO u FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entry_items' AND column_name = 'type';
  EXECUTE format('INSERT INTO journal_entry_items (id, journal_entry_id, account_id, value, type, description, created_at) VALUES (gen_random_uuid(), $1, $2, $3, %L::%I, $4, now())', tipo, u)
    USING je, pg_temp.acc(emp, c), v, h; END $f$;
DO $$
DECLARE x uuid; y uuid; je uuid; hj uuid[] := '{}'; d numeric; c numeric; n int; ids uuid[];
  emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; a_aea uuid; a_inss uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'baixa-1065-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0020', DATE '2024-08-30', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 250000.00, '21101050001', 'Parcelamento federal (1a parcela) - baixa dos debitos federais (item 5 do Anexo V)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0010', DATE '2025-02-13', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 208905.00, '21101050001', 'Acordo PGFN - baixa dos debitos federais (item 5 do Anexo V)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0011', DATE '2025-03-10', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 208830.00, '21101050001', 'Receita Federal - baixa dos debitos federais (item 5 do Anexo V)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0021', DATE '2024-08-30', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 110000.00, '21101040010', 'Acordo trabalhista Genilson Honorio - baixa (itens 2 e 4 do Anexo V)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0029', DATE '2024-10-29', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 94000.00, '21101040010', 'Reembolso de bloqueio judicial em processo trabalhista - baixa (itens 2 e 4)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0034', DATE '2024-12-13', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 67000.00, '21101040010', 'Acordo trabalhista Cintia Nere (custodia) - baixa (itens 2 e 4)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0031', DATE '2024-12-16', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 33000.00, '21101040010', 'Acordo trabalhista Cintia Nere - baixa (itens 2 e 4)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0046', DATE '2025-01-10', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 11104.00, '21101040010', 'Processo trabalhista JP Bonfim (custodia) - baixa (itens 2 e 4)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0008', DATE '2025-01-15', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 48600.00, '21101040010', 'Acordo trabalhista: custas Cintia Nere e JP Bonfim e sinal do acordo JP - baixa (itens 2 e 4)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0047', DATE '2025-06-02', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 9500.00, '21101040010', 'Processo trabalhista Neilson (custodia) - baixa (itens 2 e 4)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0021', DATE '2025-06-05', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 4000.00, '21101040010', 'Reembolso processo Neilson/Kleydson - baixa (itens 2 e 4)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0024', DATE '2025-06-30', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 4160.00, '21101040010', 'Reembolso processo Neilson/Kleydson - baixa (itens 2 e 4)'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0015', DATE '2025-05-05', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 5000.00, '21101020007', 'Pagamento ao Dr. Fernando Galvao - amortizacao do item 7 do Anexo V'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0001', DATE '2025-01-06', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 208000.00, '42103010034', 'Transacao PGFN Solsys (debito de terceiro, liberacao das unidades) - despesa da Hotelsys'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0048', DATE '2025-07-30', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 207000.00, '42103010034', 'Transacao PGFN Solsys (custodia) - despesa da Hotelsys'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0003', DATE '2025-01-13', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 95.94, '42103010034', 'Taxas municipais - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0004', DATE '2025-01-13', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 104.43, '42103010034', 'Taxas municipais - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0005', DATE '2025-01-13', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 95.94, '42103010034', 'Taxas municipais - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0006', DATE '2025-01-13', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 104.43, '42103010034', 'Taxas municipais - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0007', DATE '2025-01-13', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 845.97, '42103010010', 'Custas de cartorio (contratos) - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0012', DATE '2025-04-22', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 1100.00, '42103010008', 'Custas do processo Nobile - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0014', DATE '2025-04-29', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 9384.95, '42103010008', 'Custas do processo Banco Maxima - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0027', DATE '2025-07-10', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 1288.26, '42103010011', 'Taxa de arbitragem - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0028', DATE '2025-07-11', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 63000.00, '42103010011', 'Devolucao A. Vieira - custas de arbitragem - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0029', DATE '2025-07-11', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 3000.00, '42103010011', 'Devolucao A. Vieira - custas de arbitragem - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0023', DATE '2024-10-14', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 30000.00, '42501010012', 'Devolucao de credito AV (Manuela) por ordem do Intermediario - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0024', DATE '2024-10-16', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 30000.00, '42501010012', 'Devolucao de credito AV (Manuela) por ordem do Intermediario - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0025', DATE '2024-10-17', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 29827.00, '42501010012', 'Devolucao de credito AV (Manuela) por ordem do Intermediario - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0026', DATE '2024-10-22', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 113229.00, '42501010012', 'Devolucao de credito AV (Manuela) por ordem do Intermediario - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0027', DATE '2024-10-24', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 45000.00, '42501010012', 'Devolucao de credito AV (Rafael Mesquita) por ordem do Intermediario - despesa'); hj := hj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0028', DATE '2024-10-25', 2); PERFORM pg_temp.setacc(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '11304010009', 'DEBIT', 68697.71, '42501010012', 'Devolucao de credito AV (Celso Ramalho) por ordem do Intermediario - despesa'); hj := hj || x;
  -- lote de 31/12/2024: linha dos federais
  a_aea := pg_temp.acc(emp, '23301020003'); a_inss := pg_temp.acc(emp, '21101050001');
  SELECT array_agg(e.id), count(*) INTO ids, n FROM journal_entries e
   WHERE e.company_id = emp AND e.deleted_at IS NULL AND e.date::date = DATE '2024-12-31'
     AND EXISTS (SELECT 1 FROM journal_entry_items i WHERE i.journal_entry_id = e.id AND i.account_id = a_aea AND i.type::text = 'DEBIT' AND i.value = 68786.43)
     AND EXISTS (SELECT 1 FROM journal_entry_items i WHERE i.journal_entry_id = e.id AND i.account_id = a_inss AND i.type::text = 'CREDIT' AND i.value = 68786.43)
     AND (SELECT count(*) FROM journal_entry_items i WHERE i.journal_entry_id = e.id) = 2;
  IF n <> 1 THEN RAISE EXCEPTION 'Linha dos federais do lote de 31/12/2024: esperado 1 lancamento, encontrado % - nada alterado', n; END IF;
  je := ids[1];
  x := pg_temp.item(je, emp, '23301020003', 'DEBIT', 68786.43); y := pg_temp.item(je, emp, '21101050001', 'CREDIT', 68786.43);
  UPDATE journal_entry_items SET account_id = a_inss, value = 730274.85 WHERE id = x;
  UPDATE journal_entry_items SET account_id = a_aea, value = 730274.85 WHERE id = y;
  UPDATE journal_entries SET description = 'Debitos federais ajustados ao Regularize de 15/04/2024 (item 5 do Anexo V), liquidos dos DARFs pagos antes de 31/10/2025' WHERE id = je;
  hj := hj || je;
  FOREACH je IN ARRAY hj LOOP
    SELECT sum(value) FILTER (WHERE type::text = 'DEBIT'), sum(value) FILTER (WHERE type::text = 'CREDIT') INTO d, c FROM journal_entry_items WHERE journal_entry_id = je;
    IF d <> c THEN RAISE EXCEPTION 'Lancamento % ficou desbalanceado - nada alterado', (SELECT reference FROM journal_entries WHERE id = je); END IF;
    UPDATE journal_entries SET updated_at = now() WHERE id = je;
  END LOOP;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_CORRECAO_ORIGEM', 'baixa-1065-20261022',
    jsonb_build_object('pacote', 'baixa-1065-20261022', 'lancamentos', 31, 'valor', 1864872.63, 'lote_federais', 730274.85, 'motivo', 'Pagamentos antes de 31/10/2025 baixam o passivo ou viram despesa'), now());
  RAISE NOTICE 'Correcao aplicada: 31 pagamentos (1864872.63) saem da 11304010009; linha dos federais do lote ajustada';
END $$;
-- Projeto: o pagamento ao Fernando Galvao de 05/05/2025 passa a amortizar o item 7 do Anexo V
DO $$
DECLARE usr uuid := '421642c8-e981-49c9-996c-b4bfabc22b52'; v record;
BEGIN
  SELECT * INTO v FROM proj_aplicacao_anexo_v WHERE id = '2ed74616-7c73-4567-9bbb-6b52777a50b7' AND cancelado_em IS NULL AND fora_anexo;
  IF v.id IS NULL THEN RAISE NOTICE 'Projeto: vinculo do Fernando Galvao ja reclassificado'; RETURN; END IF;
  UPDATE proj_aplicacao_anexo_v SET cancelado_em = now(), cancelado_por_id = usr,
    motivo_cancelamento = 'Pagamento ao Dr. Fernando Galvao de 05/05/2025 amortiza o item 7 (decisao de 22/10/2026)' WHERE id = v.id;
  INSERT INTO proj_aplicacao_anexo_v (id, aplicacao_id, custodia_lancamento_id, item_id, fora_anexo, consta_reconciliacao, motivo, criado_em, criado_por_id)
    VALUES (gen_random_uuid(), v.aplicacao_id, NULL, 'e4ce5238-6e7e-4175-b875-1d32df8dc9f2', false, NULL, 'Amortizacao do item 7 - Confissao de divida Fernando Galvao', now(), usr);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), usr, 'PROJ_ANEXO_V_RECLASSIFICADO', v.id::text,
    jsonb_build_object('de', 'FORA', 'para', 'ITEM_7', 'valor', 5000.00), now());
  RAISE NOTICE 'Projeto: Fernando Galvao 05/05/2025 (5.000,00) no item 7';
END $$;
-- conferencia em 31/10/2025 (credor positivo no passivo, devedor positivo no ativo)
SELECT g.grupo, to_char(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END) * CASE WHEN g.grupo LIKE '1%' THEN -1 ELSE 1 END, 'FM999G999G990D00') AS saldo_31_10_2025
  FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
  JOIN (VALUES ('11304010009', '1065 a reclassificar'), ('21101050001', '5 federais'), ('21101060001', '5 federais'), ('21101060002', '5 federais'), ('21101060003', '5 federais'),
               ('21101060004', '5 federais'), ('21101060006', '5 federais'), ('21101060007', '5 federais'), ('21101060016', '5 federais'), ('21101060013', '5 federais'),
               ('21101060014', '5 federais'), ('21101090001', '5 federais'), ('21101090002', '5 federais'), ('21101040010', '2,4,8 trabalhistas'), ('21101050002', '2,4,8 trabalhistas'),
               ('21101140002', '2,4,8 trabalhistas'), ('21101140003', '2,4,8 trabalhistas'), ('21101040005', '2,4,8 trabalhistas'), ('21101020007', '7 Fernando Galvao')) g(code, grupo) ON g.code = a.code
 WHERE j.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND j.deleted_at IS NULL AND j.date::date <= DATE '2025-10-31' AND a.deleted_at IS NULL
 GROUP BY g.grupo ORDER BY 1;
COMMIT;
