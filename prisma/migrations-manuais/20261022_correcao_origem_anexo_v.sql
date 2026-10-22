-- prisma/migrations-manuais/20261022_correcao_origem_anexo_v.sql
-- 22/10/2026 - Hotelsys e Sunsys: pagamentos depois de 31/10/2025 corrigidos NA ORIGEM (sem estorno), para o Anexo V pago
-- na contabilidade (conta corrente Sunrise) ficar igual ao projeto: honorarios contabeis, reembolso e 13o/cestas saem do Anexo V
-- e vao ao mutuo (Sunsys 12101020022 x Hotelsys 22101020001, despesa 42103010041); R$ 22.000,00 do item 7 saem dos Escandinavos;
-- o bloqueio de 23/12/2025 vai para Rescisoes Trabalhistas; os estornos de 10.000,00 (0049 Hotelsys e 0464 Sunsys) sao excluidos
-- (soft delete). Cada lancamento e conferido antes (valores e contas); qualquer divergencia aborta tudo. Reexecutar nao duplica.
-- Os encargos de CLT de 31/12/2025 em Outras Contas a Pagar NAO sao tocados.
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
DECLARE r uuid; k int; BEGIN
  SELECT count(*) INTO k FROM journal_entry_items i WHERE i.journal_entry_id = je AND i.account_id = pg_temp.acc(emp, c) AND i.type::text = tipo AND i.value = v;
  IF k <> 1 THEN RAISE EXCEPTION 'Partida % % % nao encontrada no lancamento % - nada alterado', tipo, c, v, (SELECT reference FROM journal_entries WHERE id = je); END IF;
  SELECT i.id INTO r FROM journal_entry_items i WHERE i.journal_entry_id = je AND i.account_id = pg_temp.acc(emp, c) AND i.type::text = tipo AND i.value = v; RETURN r; END $f$;
CREATE FUNCTION pg_temp.setv(je uuid, emp uuid, c text, tipo text, v0 numeric, v1 numeric) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE x uuid; BEGIN x := pg_temp.item(je, emp, c, tipo, v0); UPDATE journal_entry_items SET value = v1 WHERE id = x; END $f$;
CREATE FUNCTION pg_temp.setacc(je uuid, emp uuid, c text, tipo text, v numeric, c1 text, h text) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE x uuid; a1 uuid; BEGIN x := pg_temp.item(je, emp, c, tipo, v); a1 := pg_temp.acc(emp, c1); UPDATE journal_entry_items SET account_id = a1, description = h WHERE id = x; END $f$;
CREATE FUNCTION pg_temp.add(je uuid, emp uuid, c text, tipo text, v numeric, h text) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE u text; BEGIN SELECT udt_name INTO u FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entry_items' AND column_name = 'type';
  EXECUTE format('INSERT INTO journal_entry_items (id, journal_entry_id, account_id, value, type, description, created_at) VALUES (gen_random_uuid(), $1, $2, $3, %L::%I, $4, now())', tipo, u)
    USING je, pg_temp.acc(emp, c), v, h; END $f$;
CREATE FUNCTION pg_temp.del(emp uuid, ref text, dt date, lk text, mot text) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE r record; k int; BEGIN
  SELECT count(*) INTO k FROM journal_entries WHERE company_id = emp AND reference = ref AND date::date = dt AND deleted_at IS NULL AND description LIKE lk;
  IF k <> 1 THEN RAISE EXCEPTION 'Estorno % nao encontrado (%) - nada alterado', ref, k; END IF;
  SELECT id, reference INTO r FROM journal_entries WHERE company_id = emp AND reference = ref AND date::date = dt AND deleted_at IS NULL AND description LIKE lk;
  UPDATE journal_entries SET deleted_at = now(), updated_at = now() WHERE id = r.id;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_LANCAMENTO_EXCLUIDO', r.id::text, jsonb_build_object('ref', r.reference, 'motivo', mot), now()); END $f$;
DO $$
DECLARE h1 uuid; h2 uuid; h3 uuid; h4 uuid; h5 uuid; h6 uuid; s1 uuid; s2 uuid; s3 uuid; s5 uuid; s6 uuid; je uuid; d numeric; c numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'anexo-v-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  h1 := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0036', DATE '2025-11-18', 2);
  PERFORM pg_temp.setv(h1, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '21101040010', 'DEBIT', 60945.00, 50945.00);
  PERFORM pg_temp.setv(h1, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '22101020002', 'CREDIT', 60945.00, 50945.00);
  PERFORM pg_temp.del('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0049', DATE '2025-11-18', 'Estorno parcial do pgto de 60.945%', 'Correcao na origem: MANUAL-2025-0036 desmembrado (50.945,00 Anexo V; 10.000,00 Visao Contabil em MANUAL-2025-0050)');
  s1 := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0405', DATE '2025-11-18', 2);
  PERFORM pg_temp.setv(s1, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '22101050005', 'DEBIT', 60945.00, 50945.00);
  PERFORM pg_temp.add(s1, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 10000.00, U&'Sinal contrato Vis\00e3o Cont\00e1bil - pago por conta da Hotelsys (m\00fatuo)');
  PERFORM pg_temp.del('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0464', DATE '2025-11-18', 'Rateio do extrato de 60.945%', 'Correcao na origem: MANUAL-2025-0405 desmembrado (50.945,00 Adiantamentos; 10.000,00 Mutuo Hotelsys)');
  h2 := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0040', DATE '2025-12-05', 2);
  PERFORM pg_temp.setv(h2, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '21101040010', 'DEBIT', 73931.80, 73200.00);
  PERFORM pg_temp.setv(h2, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '22101020002', 'CREDIT', 73931.80, 73200.00);
  PERFORM pg_temp.add(h2, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '42103010041', 'DEBIT', 731.80, U&'JS Teixeira Cont\00e1bil (650,00) e reembolso de despesas (81,80) - fora do Anexo V');
  PERFORM pg_temp.add(h2, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '22101020001', 'CREDIT', 731.80, U&'JS Teixeira Cont\00e1bil (650,00) e reembolso de despesas (81,80) - fora do Anexo V');
  s2 := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0432', DATE '2025-12-05', 2);
  PERFORM pg_temp.setv(s2, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '22101050005', 'DEBIT', 73931.80, 73200.00);
  PERFORM pg_temp.add(s2, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 731.80, U&'JS Teixeira Cont\00e1bil e reembolso de despesas - pago por conta da Hotelsys (m\00fatuo)');
  h3 := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0044', DATE '2025-12-19', 2);
  PERFORM pg_temp.setacc(h3, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '21101040010', 'DEBIT', 9461.00, '42103010041', U&'Saldo do 13\00ba sal\00e1rio (7.761,00) e cestas de Natal (1.700,00) - manuten\00e7\00e3o da opera\00e7\00e3o, fora do Anexo V');
  PERFORM pg_temp.setacc(h3, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '22101020002', 'CREDIT', 9461.00, '22101020001', U&'Saldo do 13\00ba sal\00e1rio (7.761,00) e cestas de Natal (1.700,00) - manuten\00e7\00e3o da opera\00e7\00e3o, fora do Anexo V');
  s3 := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0446', DATE '2025-12-19', 2);
  PERFORM pg_temp.setacc(s3, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '22101050005', 'DEBIT', 9461.00, '12101020022', U&'Saldo do 13\00ba sal\00e1rio e cestas de Natal - pago por conta da Hotelsys (m\00fatuo)');
  h4 := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0051', DATE '2025-12-23', 2);
  PERFORM pg_temp.setacc(h4, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '21101020006', 'DEBIT', 45000.00, '21101040010', U&'Reembolso de bloqueio judicial (a\00e7\00e3o trabalhista) pago pela cust\00f3dia - Anexo V item 4');
  h5 := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0015', DATE '2026-05-05', 2);
  PERFORM pg_temp.setv(h5, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '21101020008', 'DEBIT', 172404.66, 140000.00);
  PERFORM pg_temp.setv(h5, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '22101020002', 'CREDIT', 172404.66, 162000.00);
  PERFORM pg_temp.add(h5, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '21101020007', 'DEBIT', 22000.00, U&'Pagamento parcial - Confiss\00e3o de d\00edvida Fernando Galv\00e3o (Anexo V item 7)');
  PERFORM pg_temp.add(h5, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '42103010041', 'DEBIT', 10404.66, U&'Honor\00e1rios cont\00e1beis Vis\00e3o (5.000,00) e Teixeira (5.404,66) - fora do Anexo V');
  PERFORM pg_temp.add(h5, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '22101020001', 'CREDIT', 10404.66, U&'Honor\00e1rios cont\00e1beis Vis\00e3o (5.000,00) e Teixeira (5.404,66) - fora do Anexo V');
  s5 := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0143', DATE '2026-05-05', 2);
  PERFORM pg_temp.setv(s5, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '22101050005', 'DEBIT', 172404.66, 162000.00);
  PERFORM pg_temp.add(s5, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 10404.66, U&'Honor\00e1rios cont\00e1beis - pago por conta da Hotelsys (m\00fatuo)');
  h6 := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0019', DATE '2026-06-05', 2);
  PERFORM pg_temp.setv(h6, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '21101020008', 'DEBIT', 145000.00, 140000.00);
  PERFORM pg_temp.setv(h6, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '22101020002', 'CREDIT', 145000.00, 140000.00);
  PERFORM pg_temp.add(h6, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '42103010041', 'DEBIT', 5000.00, U&'Honor\00e1rios cont\00e1beis Teixeira - fora do Anexo V');
  PERFORM pg_temp.add(h6, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, '22101020001', 'CREDIT', 5000.00, U&'Honor\00e1rios cont\00e1beis Teixeira - fora do Anexo V');
  s6 := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0167', DATE '2026-06-05', 2);
  PERFORM pg_temp.setv(s6, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '22101050005', 'DEBIT', 145000.00, 140000.00);
  PERFORM pg_temp.add(s6, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 5000.00, U&'Honor\00e1rios cont\00e1beis Teixeira - pago por conta da Hotelsys (m\00fatuo)');
  -- todos os lancamentos alterados precisam continuar com debito = credito
  FOREACH je IN ARRAY ARRAY[h1, h2, h3, h4, h5, h6, s1, s2, s3, s5, s6] LOOP
    SELECT sum(value) FILTER (WHERE type::text = 'DEBIT'), sum(value) FILTER (WHERE type::text = 'CREDIT') INTO d, c FROM journal_entry_items WHERE journal_entry_id = je;
    IF d <> c THEN RAISE EXCEPTION 'Lancamento % ficou desbalanceado (D % C %) - nada alterado', (SELECT reference FROM journal_entries WHERE id = je), d, c; END IF;
    UPDATE journal_entries SET updated_at = now() WHERE id = je;
  END LOOP;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_CORRECAO_ORIGEM', 'anexo-v-20261022',
    jsonb_build_object('pacote', 'anexo-v-20261022', 'lancamentos', 11, 'excluidos', 2, 'motivo', 'Anexo V pago depois de 31/10/2025 igual ao projeto'), now());
  RAISE NOTICE 'Correcao aplicada: 11 lancamentos ajustados na origem, 2 estornos excluidos';
END $$;
-- conferencia em 30/09/2026 (saldo: credor positivo nas contas de passivo, devedor positivo nas de ativo/despesa)
SELECT e.nome AS empresa, a.code, a.name,
  to_char(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END) * CASE WHEN left(a.code, 1) IN ('1', '4') THEN -1 ELSE 1 END, 'FM999G999G990D00') AS saldo_30_09_2026
FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
JOIN (VALUES ('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'HOTELSYS'), ('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'SUNSYS')) e(id, nome) ON e.id = j.company_id
WHERE j.deleted_at IS NULL AND j.date::date <= DATE '2026-09-30'
  AND ((e.nome = 'HOTELSYS' AND a.code IN ('22101020002','22101020001','21101020008','21101020007','21101040010','21101020006')) OR (e.nome = 'SUNSYS' AND a.code IN ('22101050005','12101020022')))
GROUP BY e.nome, a.code, a.name ORDER BY 1, 2;
COMMIT;
