-- scripts/projetos/carga-darfs-hotelsys-20261008.sql
-- DARFs pagos da HOTELSYS (relatorio da RFB emitido em 08/10/2026, sha256 3588c331...) + vinculos ao centavo + envios a custodia
-- (conta da mae e C6 Bank sao da Josi - decisao Hpontes 08/10/2026).
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE k_ctx ON COMMIT DROP AS
SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') AS master, pp.company_id AS empresa, o.id AS operacao
FROM proj_participacoes pp JOIN proj_papeis pa ON pa.id = pp.papel_id JOIN proj_operacoes o ON o.id = pp.operacao_id
WHERE o.codigo = 'ANCORA' AND pa.codigo = 'RECEBEDORA_FINANCEIRA' AND pp.cancelado_em IS NULL LIMIT 1;
INSERT INTO proj_comprovantes_fiscais (operacao_id, tipo, contribuinte_cnpj, contribuinte_nome, data_arrecadacao, receita, numero_documento, periodo_apuracao,
  principal, multa, juros, total, arquivo_nome, arquivo_sha256, criado_por_id)
SELECT x.operacao, 'DARF', '05.736.256/0001-85', 'HOTELSYS', v.d::date, v.r, v.n, v.pa::date, v.p, v.m, v.j, v.t,
       'Darfs_Pagas_Hotelsys_2024_a_set2026.pdf', '3588c331959405f345c64d33ab95f0239178bb59d9ce5883472d1ca2e740875d', x.master
FROM (VALUES
  ('2026-02-23', '6092', '1821475465',        '2026-02-28',  2221.63,     0.00,     0.00,   2221.63),
  ('2025-07-23', '6092', '1600636635',        '2025-07-31',   869.26,     0.00,     0.00,    869.26),
  ('2025-06-27', '1734', '07172517845455305', '2025-04-30', 55471.26, 11187.22, 70235.74, 136894.22),
  ('2025-06-27', '1734', '07172517845472510', '2025-04-30', 27416.82,  5482.98, 34086.73,  66986.53),
  ('2025-06-26', '6092', '1562930185',        '2024-12-31',   150.00,     0.00,     0.00,    150.00),
  ('2025-05-30', '1734', '07172514961036491', '2025-03-31', 54869.85, 11065.92, 69474.29, 135410.06),
  ('2025-05-29', '1734', '07172514961056360', '2025-03-31', 27119.55,  5423.54, 33717.19,  66260.28),
  ('2025-04-29', '1734', '07172511585643949', '2025-02-28', 54310.65, 10953.14, 68766.26, 134030.05),
  ('2025-04-29', '1734', '07172511585814522', '2025-02-28', 26843.13,  5368.25, 33373.62,  65585.00),
  ('2025-02-27', '6092', '1481329045',        '2025-02-28',  6687.73,     0.00,     0.00,   6687.73),
  ('2025-01-31', '1734', '07172503093895269', '2025-01-31', 52754.39, 10639.32, 66795.75, 130189.46),
  ('2025-01-31', '1734', '07172503094000770', '2025-01-31', 26073.96,  5214.41, 32417.31,  63705.68)
) v(d, r, n, pa, p, m, j, t) CROSS JOIN k_ctx x
WHERE NOT EXISTS (SELECT 1 FROM proj_comprovantes_fiscais c WHERE c.tipo = 'DARF' AND c.numero_documento = v.n AND c.cancelado_em IS NULL);
DO $$ BEGIN IF (SELECT count(*) FROM proj_comprovantes_fiscais WHERE cancelado_em IS NULL) <> 12 OR (SELECT sum(total) FROM proj_comprovantes_fiscais WHERE cancelado_em IS NULL) <> 808989.90 THEN
  RAISE EXCEPTION 'esperados 12 DARFs somando 808.989,90'; END IF; END $$;
CREATE TEMP TABLE k_par ON COMMIT DROP AS
WITH g AS (SELECT data_arrecadacao AS d, sum(total) AS soma FROM proj_comprovantes_fiscais WHERE cancelado_em IS NULL AND receita = '1734' GROUP BY 1)
SELECT c.id AS comprovante_id, c.numero_documento, c.total, a.id AS aplicacao_id, a.valor AS valor_aplicacao, g.d
FROM g JOIN proj_comprovantes_fiscais c ON c.data_arrecadacao = g.d AND c.receita = '1734' AND c.cancelado_em IS NULL
JOIN proj_aplicacoes a ON a.cancelado_em IS NULL AND a.operacao_id = (SELECT operacao FROM k_ctx) AND a.valor = g.soma
JOIN bank_transactions bt ON bt.id = a.bank_transaction_id AND bt.transaction_date::date = g.d
WHERE NOT EXISTS (SELECT 1 FROM proj_comprovante_vinculos v WHERE v.comprovante_id = c.id AND v.cancelado_em IS NULL);
SELECT d AS data, numero_documento AS darf, total, valor_aplicacao AS saida_sunsys FROM k_par ORDER BY d, numero_documento;
DO $$ BEGIN IF (SELECT count(*) FROM k_par) NOT IN (0, 8) THEN RAISE EXCEPTION 'esperados 8 pares DARF x aplicacao; encontrados %', (SELECT count(*) FROM k_par); END IF; END $$;
WITH ins AS (
  INSERT INTO proj_comprovante_vinculos (comprovante_id, aplicacao_id, valor, motivo, criado_por_id)
  SELECT comprovante_id, aplicacao_id, total, 'Carga de 08/10/2026: DARF do relatorio da RFB casado ao centavo com a saida da SUNSYS de ' || to_char(d, 'DD/MM/YYYY') || '.', (SELECT master FROM k_ctx)
  FROM k_par RETURNING id, comprovante_id, aplicacao_id, valor)
INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
SELECT gen_random_uuid(), (SELECT master FROM k_ctx), 'PROJ_COMPROVANTE_VINCULADO', ins.id::text,
       jsonb_build_object('comprovante', ins.comprovante_id, 'aplicacao', ins.aplicacao_id, 'valor', to_char(ins.valor, 'FM9999999990.00'), 'lote', 'darfs-20261008'), now() FROM ins;
DO $$ BEGIN IF (SELECT count(*) FROM proj_comprovante_vinculos WHERE cancelado_em IS NULL) <> 8 OR (SELECT sum(valor) FROM proj_comprovante_vinculos WHERE cancelado_em IS NULL) <> 799061.28 THEN
  RAISE EXCEPTION 'esperados 8 vinculos somando 799.061,28'; END IF; END $$;
-- conta da mae (03/12/2024) e C6 Bank (30/07/2025): envios a custodia da Josi
CREATE TEMP TABLE k_cust ON COMMIT DROP AS
SELECT bt.id, bt.transaction_date::date AS data, bt.amount AS valor, left(COALESCE(bt.description, ''), 40) AS lancamento,
       (SELECT n.nome FROM proj_aplicacoes a JOIN proj_naturezas_aplicacao n ON n.id = a.natureza_id WHERE a.bank_transaction_id = bt.id AND a.cancelado_em IS NULL LIMIT 1) AS aplicacao_atual,
       (SELECT d.decisao FROM proj_extrato_decisoes d WHERE d.bank_transaction_id = bt.id AND d.cancelado_em IS NULL LIMIT 1) AS decisao_atual
FROM bank_transactions bt JOIN k_ctx x ON x.empresa = bt.company_id
WHERE bt.type::text = 'DEBIT' AND ((bt.transaction_date::date = DATE '2024-12-03' AND bt.amount = 208718.71) OR (bt.transaction_date::date = DATE '2025-07-30' AND bt.amount = 207000.00))
  AND NOT EXISTS (SELECT 1 FROM proj_custodia_lancamentos l WHERE l.bank_transaction_id = bt.id AND l.cancelado_em IS NULL);
SELECT data, valor, lancamento, aplicacao_atual, decisao_atual FROM k_cust ORDER BY data;
DO $$ BEGIN IF (SELECT count(*) FROM k_cust) NOT IN (0, 2) OR ((SELECT count(*) FROM k_cust) = 2 AND (SELECT sum(valor) FROM k_cust) <> 415718.71) THEN
  RAISE EXCEPTION 'esperadas 2 saidas (conta da mae e C6) somando 415.718,71'; END IF; END $$;
UPDATE proj_aplicacoes a SET cancelado_em = now(), cancelado_por_id = (SELECT master FROM k_ctx),
  motivo_cancelamento = 'Envio a custodia da Josi (conta da mae / C6 Bank), decisao de 08/10/2026; sem DARF da HOTELSYS correspondente.'
WHERE a.cancelado_em IS NULL AND a.bank_transaction_id IN (SELECT id FROM k_cust);
UPDATE proj_extrato_decisoes d SET cancelado_em = now(), cancelado_por_id = (SELECT master FROM k_ctx),
  motivo_cancelamento = 'Substituida pela decisao CUSTODIA (conta da mae / C6 Bank sao da Josi), 08/10/2026.'
WHERE d.cancelado_em IS NULL AND d.bank_transaction_id IN (SELECT id FROM k_cust);
INSERT INTO proj_extrato_decisoes (operacao_id, bank_transaction_id, decisao, motivo, criado_por_id)
SELECT x.operacao, k.id, 'CUSTODIA', 'Custodia da Josi: envio pela conta da mae / C6 Bank para pagamento de imposto (a comprovar), decisao de 08/10/2026.', x.master FROM k_cust k CROSS JOIN k_ctx x;
WITH ins AS (
  INSERT INTO proj_custodia_lancamentos (custodia_id, tipo, bank_transaction_id, data, valor, situacao, validado_por_id, validado_em, motivo, criado_por_id)
  SELECT (SELECT id FROM proj_custodias WHERE codigo = 'JOSI' AND cancelado_em IS NULL), 'ENVIO', k.id, k.data, k.valor, 'VALIDADO', x.master, now(),
         'Envio pela conta da mae / C6 Bank (custodia da Josi), para pagamento de imposto a comprovar com o DARF.', x.master
  FROM k_cust k CROSS JOIN k_ctx x RETURNING id, valor, bank_transaction_id)
INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
SELECT gen_random_uuid(), (SELECT master FROM k_ctx), 'PROJ_CUSTODIA_LANCAMENTO_REGISTRADO', ins.id::text,
       jsonb_build_object('custodia', 'JOSI', 'tipo', 'ENVIO', 'valor', to_char(ins.valor, 'FM9999999990.00'), 'bankTransactionId', ins.bank_transaction_id, 'lote', 'darfs-20261008'), now() FROM ins;
COMMIT;
SELECT 'DARFs: ' || count(*) || ' | ' || to_char(sum(total), 'FM999G999G990D00') || ' | vinculados: ' ||
       (SELECT count(*) FROM proj_comprovante_vinculos WHERE cancelado_em IS NULL) || ' | ' ||
       to_char((SELECT sum(valor) FROM proj_comprovante_vinculos WHERE cancelado_em IS NULL), 'FM999G999G990D00') AS resultado
FROM proj_comprovantes_fiscais WHERE cancelado_em IS NULL;
SELECT 'custodia Josi - envios: ' || count(*) || ' | ' || to_char(sum(valor), 'FM999G999G990D00') AS custodia FROM proj_custodia_lancamentos WHERE tipo = 'ENVIO' AND cancelado_em IS NULL;