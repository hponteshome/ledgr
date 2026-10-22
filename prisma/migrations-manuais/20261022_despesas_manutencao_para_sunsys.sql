-- prisma/migrations-manuais/20261022_despesas_manutencao_para_sunsys.sql
-- 22/10/2026 - Nao existe "despesa da Operacao Ancora": ou e despesa propria da Sunsys, ou amortiza o Anexo V. Os pagamentos que
-- estavam na Hotelsys em 42103010041 (Despesas de manutencao - Operacao Ancora) contra o mutuo (22101020001), de 2024 a 2026
-- (37 pagamentos, R$ 119,033.52), passam a ser despesa da Sunsys, corrigidos NA ORIGEM (sem estorno):
--  Hotelsys: lancamento so com o par D 42103010041 / C 22101020001 -> excluido (soft delete); lancamento que tambem paga
--            Anexo V (0040, 2026-0015, 2026-0019) -> sai so o par (partidas apagadas, registradas na auditoria).
--  Sunsys:   a partida D 12101020022 (mutuo Hotelsys) vai para a despesa da natureza (cartorio, custas, honorarios contabeis,
--            manutencao, copa, 13o salario, cestas de Natal).
-- Mutuo cai R$ 119,033.52 nos dois lados. Encerramentos de 2024 e 2025 da Hotelsys e da Sunsys precisam ser refeitos na tela.
-- Confere cada lancamento antes; qualquer divergencia aborta tudo. Reexecutar nao duplica.
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
-- Hotelsys: lancamento so com o par despesa x mutuo -> soft delete
CREATE FUNCTION pg_temp.delpar(emp uuid, ref text, dt date, v numeric) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE x uuid; a uuid; b uuid; BEGIN x := pg_temp.je(emp, ref, dt, 2); a := pg_temp.item(x, emp, '42103010041', 'DEBIT', v); b := pg_temp.item(x, emp, '22101020001', 'CREDIT', v);
  UPDATE journal_entries SET deleted_at = now(), updated_at = now() WHERE id = x;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_LANCAMENTO_EXCLUIDO', x::text,
    jsonb_build_object('ref', ref, 'valor', v, 'motivo', 'Despesa propria da Sunsys (nao e da Hotelsys nem do mutuo) - correcao na origem 22/10/2026'), now()); END $f$;
-- Hotelsys: lancamento que tambem paga Anexo V -> sai so o par despesa x mutuo
CREATE FUNCTION pg_temp.rmpar(x uuid, emp uuid, v numeric) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE a uuid; b uuid; BEGIN a := pg_temp.item(x, emp, '42103010041', 'DEBIT', v); b := pg_temp.item(x, emp, '22101020001', 'CREDIT', v);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_PARTIDA_REMOVIDA', x::text,
    jsonb_build_object('ref', (SELECT reference FROM journal_entries WHERE id = x), 'partidas', jsonb_build_array('D 42103010041 ' || v, 'C 22101020001 ' || v),
      'motivo', 'Despesa propria da Sunsys (nao e da Hotelsys nem do mutuo) - correcao na origem 22/10/2026'), now());
  DELETE FROM journal_entry_items WHERE id IN (a, b); END $f$;
DO $$
DECLARE x uuid; je uuid; hj uuid[] := '{}'; sj uuid[] := '{}'; d numeric; c numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'manutencao-sunsys-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0022', DATE '2024-09-20', 32000.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2024-0012', DATE '2024-09-20', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 32000.00, '42103010010', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - SICASI PAGAMENTO MATRICULAS IMOVEIS - CARTORIO JABOATAO MATRICULAS IMOVEIS - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0030', DATE '2024-11-22', 3657.30);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2024-0034', DATE '2024-11-22', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 3657.30, '42103010008', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PIX QR-CODE - SP RIO JANEIRO - PROCESSO JUDICIAL  - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0032', DATE '2024-12-30', 2208.53);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2024-0047', DATE '2024-12-30', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 2208.53, '42103010008', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PIX QR-CODE - SP RIO JANEIRO - PROCESSO JUDICIAL  - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2024-0033', DATE '2024-12-30', 800.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2024-0048', DATE '2024-12-30', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 800.00, '42103010008', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PIX TRANSFERENCIA - SP RIO JANEIRO - PROCESSO JUDICIAL  - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0002', DATE '2025-01-10', 10464.71);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0171', DATE '2025-01-10', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 10464.71, '42103010010', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - REGISTRO CARTORIO NOTAS - CONTRATO REGISTRADO CARTORIO NOTAS RECIFE - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0016', DATE '2025-05-20', 540.29);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0242', DATE '2025-05-20', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 540.29, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Manuten\00e7\00e3o e Reparos - TAPUMES FRENTE HOTEL 2 FOLHAS - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0017', DATE '2025-05-28', 16.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0244', DATE '2025-05-28', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 16.00, '42103010030', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Fornecedor de agua mineral - Fornecedor de agua mineral - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0020', DATE '2025-06-02', 446.30);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0259', DATE '2025-06-02', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 446.30, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PIX QR-CODE - LATERNAS/PILHAS - LATERNAS/PILHAS - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0022', DATE '2025-06-17', 14.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0266', DATE '2025-06-17', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 14.00, '42103010030', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Fornecedor de agua mineral - Fornecedor de agua mineral - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0025', DATE '2025-06-30', 434.99);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0276', DATE '2025-06-30', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 434.99, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PAG TIT BANCO 033 - Manuten\00e7\00e3o e Reparos - COLETA LIXO ARREDORES HOTEL ( NOTIFICA\00c7AO PREFEITURA ) - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0026', DATE '2025-07-07', 14.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0283', DATE '2025-07-07', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 14.00, '42103010030', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Fornecedor de agua mineral - Fornecedor de agua mineral - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0030', DATE '2025-08-06', 65.90);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0320', DATE '2025-08-06', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 65.90, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PIX QR-CODE - CANAL CONSTRU\00c7AO - MATERIAL ARMAZEM - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0031', DATE '2025-08-13', 137.72);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0325', DATE '2025-08-13', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 137.72, '42103010011', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PIX QR-CODE - COMBUSTIVEL AUDIENCIA IPOJUCA - COMBUSTIVEL AUDIENCIA IPOJUCA - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0032', DATE '2025-09-26', 403.35);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0351', DATE '2025-09-26', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 403.35, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PIX QR-CODE - Manuten\00e7\00e3o e Reparos - MADEIRA DE TAPUME PARA FECHAR ACESSO FRONTAL QUE FOI ARROMBADO - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0033', DATE '2025-10-08', 2586.63);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0373', DATE '2025-10-08', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 2586.63, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Manuten\00e7\00e3o e Reparos - COMPRA REFLETOR SOLAR - Pagamento Josi - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0034', DATE '2025-10-28', 226.80);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0376', DATE '2025-10-28', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 226.80, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PIX QR-CODE - PILHA E LANTERNA - PILHA E LANTERNA - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0035', DATE '2025-10-29', 350.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0377', DATE '2025-10-29', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 350.00, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - MATERIAL LIMPEZA - MATERIAL LIMPEZA - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0050', DATE '2025-11-18', 10000.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0405', DATE '2025-11-18', 3); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 10000.00, '42103010016', U&'Sinal contrato Vis\00e3o Cont\00e1bil - despesa da Sunsys'); sj := sj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0040', DATE '2025-12-05', 4); PERFORM pg_temp.rmpar(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 731.80); hj := hj || x;
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0432', DATE '2025-12-05', 3); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 731.80, '42103010016', U&'JS Teixeira Cont\00e1bil e reembolso de despesas - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0044', DATE '2025-12-19', 9461.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0446', DATE '2025-12-19', 2); PERFORM pg_temp.setv(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 9461.00, 7761.00);
  PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 7761.00, '42101020006', U&'Saldo do 13\00ba sal\00e1rio - despesa da Sunsys');
  PERFORM pg_temp.add(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '42103010007', 'DEBIT', 1700.00, U&'Cestas de Natal - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2025-0045', DATE '2025-12-22', 5000.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2025-0448', DATE '2025-12-22', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 5000.00, '42103010016', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Vis\00e3o Cont\00e1bil - VISAO CONTABIL BALANCOS HOTELSYS - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0001', DATE '2026-01-07', 1370.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0008', DATE '2026-01-07', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 1370.00, '42103010032', U&'Lcto conf Extrato Ita\00fa-PAGAMENTOS A FORNECEDORES SISPAG FORNECEDORES - Manuten\00e7\00e3o e Reparos - Reembolso Josi - COMPRA REFLETORES/LANTERNAS E PILHAS - Pagamento Josi - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0004', DATE '2026-01-30', 5000.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0026', DATE '2026-01-30', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 5000.00, '42103010016', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Vis\00e3o Cont\00e1bil - VISAO CONTABIL BALANCOS HOTELSYS - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0006', DATE '2026-03-12', 100.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0067', DATE '2026-03-12', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 100.00, '42103010030', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - MAURO JOS\00c9 CANDIDO - FORNECEDOR AGUA MINERAL -  - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0010', DATE '2026-04-07', 5000.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0113', DATE '2026-04-07', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 5000.00, '42103010016', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Vis\00e3o Cont\00e1bil - VISAO CONTABIL BALANCOS HOTELSYS - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0011', DATE '2026-04-08', 600.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0114', DATE '2026-04-08', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 600.00, '42103010016', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Vis\00e3o Cont\00e1bil - VISAO CONTABIL DESPACHANTES DOCUMENTOS JUCEPE - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0012', DATE '2026-04-10', 1600.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0115', DATE '2026-04-10', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 1600.00, '42103010016', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Vis\00e3o Cont\00e1bil - VISAO CONTABIL DESPACHANTES DOCUMENTOS JUCEPE - - despesa da Sunsys'); sj := sj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0015', DATE '2026-05-05', 5); PERFORM pg_temp.rmpar(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 10404.66); hj := hj || x;
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0143', DATE '2026-05-05', 3); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 10404.66, '42103010016', U&'Honor\00e1rios cont\00e1beis - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0016', DATE '2026-05-07', 339.82);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0144', DATE '2026-05-07', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 339.82, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PIX QR-CODE - Manuten\00e7\00e3o e Reparos - COMPRA DE ARMAZEM CARRO MAO / AREIA ) - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0017', DATE '2026-05-22', 785.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0146', DATE '2026-05-22', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 785.00, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Manuten\00e7\00e3o e Reparos - MATERIAL ARMAZEM - PEDRO FERNANDES ARMAZEM - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0018', DATE '2026-06-01', 360.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0147', DATE '2026-06-01', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 360.00, '42103010032', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES - Manuten\00e7\00e3o e Reparos - FECHAMENTO PORTAO GARAGEM - MAO OBRA EXTRA ALEXASANDRO  JOS\00c9 DOS SANTOS - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0020', DATE '2026-06-05', 1706.30);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0168', DATE '2026-06-05', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 1706.30, '42103010010', U&'Lcto conf Extrato Ita\00fa-SISPAG FORNECEDORES PAG TIT 342086168000 - CERTIDAO IMOVEL - TAXA CART\00d3RIO JABOAT\00c1O ( CERTIDAO DE 9 APTOS PARA DEFESA PROCESSO BANCO MAXIMA ) - - despesa da Sunsys'); sj := sj || x;
  x := pg_temp.je('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0019', DATE '2026-06-05', 4); PERFORM pg_temp.rmpar(x, 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 5000.00); hj := hj || x;
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0167', DATE '2026-06-05', 3); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 5000.00, '42103010016', U&'Honor\00e1rios cont\00e1beis Teixeira - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0021', DATE '2026-06-08', 208.42);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0169', DATE '2026-06-08', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 208.42, '42103010032', U&'Lcto conf Extrato Ita\00fa-PAGAMENTOS PIX QR-CODE - Manuten\00e7\00e3o e Reparos - COMPRA DE ARMAZEM CIMENTOS PARA FECHAR PAREDE DA LXEIRA LATERAL ) - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0022', DATE '2026-06-10', 5000.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0171', DATE '2026-06-10', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 5000.00, '42103010016', U&'Lcto conf Extrato Ita\00fa-SA\00cdDA PIX ENVIADO VISAO CONTAB - PARCELA 6/6 BALAN\00c7OS HOTELSYS 8 ANOS - PARCELA 6/6 BALAN\00c7OS HOTELSYS 8 ANOS - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0028', DATE '2026-07-10', 1000.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0199', DATE '2026-07-10', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 1000.00, '42103010032', U&'Lcto conf Extrato Ita\00fa-SA\00cdDA PIX ENVIADO JOSIVANI ETE - Manuten\00e7\00e3o e Reparos - COMPRA REFLETOR SOLAR - - despesa da Sunsys'); sj := sj || x;
  PERFORM pg_temp.delpar('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'MANUAL-2026-0029', DATE '2026-07-10', 1000.00);
  x := pg_temp.je('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'MANUAL-2026-0200', DATE '2026-07-10', 2); PERFORM pg_temp.setacc(x, '6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, '12101020022', 'DEBIT', 1000.00, '42103010032', U&'Lcto conf Extrato Ita\00fa-SA\00cdDA PIX ENVIADO JOSIVANI ETE - Manuten\00e7\00e3o e Reparos - COMPRA REFLETOR SOLAR - - despesa da Sunsys'); sj := sj || x;
  FOREACH je IN ARRAY hj || sj LOOP
    SELECT sum(value) FILTER (WHERE type::text = 'DEBIT'), sum(value) FILTER (WHERE type::text = 'CREDIT') INTO d, c FROM journal_entry_items WHERE journal_entry_id = je;
    IF d <> c THEN RAISE EXCEPTION 'Lancamento % ficou desbalanceado (D % C %) - nada alterado', (SELECT reference FROM journal_entries WHERE id = je), d, c; END IF;
    UPDATE journal_entries SET updated_at = now() WHERE id = je;
  END LOOP;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_CORRECAO_ORIGEM', 'manutencao-sunsys-20261022',
    jsonb_build_object('pacote', 'manutencao-sunsys-20261022', 'pagamentos', 37, 'valor', 119033.52, 'motivo', 'Despesa da Operacao Ancora nao existe: despesa propria da Sunsys'), now());
  RAISE NOTICE 'Correcao aplicada: 37 pagamentos (R$ 119033.52) passaram a despesa da Sunsys';
END $$;
-- conferencia em 30/09/2026 (devedor positivo nas contas 1 e 4, credor positivo nas demais)
SELECT e.nome AS empresa, a.code, a.name,
  to_char(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END) * CASE WHEN left(a.code, 1) IN ('1', '4') THEN -1 ELSE 1 END, 'FM999G999G990D00') AS saldo_30_09_2026
FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
JOIN (VALUES ('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'HOTELSYS'), ('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'SUNSYS')) e(id, nome) ON e.id = j.company_id
WHERE j.deleted_at IS NULL AND j.date::date <= DATE '2026-09-30' AND j.description NOT ILIKE 'Encerramento%'
  AND ((e.nome = 'HOTELSYS' AND a.code IN ('22101020001','42103010041','22101020002')) OR (e.nome = 'SUNSYS' AND a.code IN ('12101020022','42103010016','42103010010','42103010008','42103010011','42103010030','42103010032','42101020006','42103010007')))
GROUP BY e.nome, a.code, a.name ORDER BY 1, 2;
COMMIT;
