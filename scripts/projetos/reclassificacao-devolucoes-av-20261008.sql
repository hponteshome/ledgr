-- scripts/projetos/reclassificacao-devolucoes-av-20261008.sql
-- 08/10/2026 (decisao Hpontes): A. Vieira e intermediario e indica o destino dos recursos; as "Devolucoes AV" de out/2024
-- sao pagamentos a terceiros por ordem do intermediario, com recursos do aporte do Cliente Ancora (nao reduzem a Conta Individual).
\set ON_ERROR_STOP on
SELECT string_agg(column_name || ' ' || data_type || CASE WHEN is_nullable = 'NO' AND column_default IS NULL THEN ' (obrig.)' ELSE '' END, ', ' ORDER BY ordinal_position) AS colunas_naturezas
FROM information_schema.columns WHERE table_name = 'proj_naturezas_aplicacao';
BEGIN;
CREATE TEMP TABLE o_ctx ON COMMIT DROP AS
SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') AS master, pp.company_id AS empresa, o.id AS operacao
FROM proj_participacoes pp JOIN proj_papeis pa ON pa.id = pp.papel_id JOIN proj_operacoes o ON o.id = pp.operacao_id
WHERE o.codigo = 'ANCORA' AND pa.codigo = 'RECEBEDORA_FINANCEIRA' AND pp.cancelado_em IS NULL LIMIT 1;
INSERT INTO proj_naturezas_aplicacao (codigo, nome, tipo, ativo, paga_passivo)
SELECT 'PAGAMENTO_ORDEM_INTERMEDIARIO', 'Pagamento por ordem do Intermediário', 'APLICACAO', true, false
WHERE NOT EXISTS (SELECT 1 FROM proj_naturezas_aplicacao WHERE codigo = 'PAGAMENTO_ORDEM_INTERMEDIARIO');
CREATE TEMP TABLE o_alvo ON COMMIT DROP AS
SELECT bt.id, bt.transaction_date::date AS data, bt.amount AS valor, d.id AS decisao_id,
       trim(split_part(a.texto, '|', 2)) AS referencia
FROM bank_transactions bt JOIN o_ctx x ON x.empresa = bt.company_id
JOIN proj_anotacoes_extrato a ON a.bank_transaction_id = bt.id AND trim(split_part(a.texto, '|', 1)) ILIKE 'Devolu%AV'
JOIN proj_extrato_decisoes d ON d.bank_transaction_id = bt.id AND d.cancelado_em IS NULL AND d.decisao = 'NAO_PERTENCE'
WHERE bt.type::text = 'DEBIT' AND bt.transaction_date::date BETWEEN DATE '2024-10-01' AND DATE '2024-10-31'
  AND NOT EXISTS (SELECT 1 FROM proj_aplicacoes ap WHERE ap.bank_transaction_id = bt.id AND ap.cancelado_em IS NULL);
SELECT data, valor, left(referencia, 80) AS referencia FROM o_alvo ORDER BY data;
DO $$ BEGIN IF (SELECT count(*) FROM o_alvo) <> 6 OR (SELECT sum(valor) FROM o_alvo) <> 316753.71 THEN
  RAISE EXCEPTION 'esperadas 6 saidas somando 316.753,71; encontradas % somando %', (SELECT count(*) FROM o_alvo), (SELECT sum(valor) FROM o_alvo); END IF; END $$;
UPDATE proj_extrato_decisoes d SET cancelado_em = now(), cancelado_por_id = (SELECT master FROM o_ctx),
  motivo_cancelamento = 'Substituida por aplicacao "Pagamento por ordem do Intermediario" (decisao de 08/10/2026: A. Vieira indica o destino; recurso do aporte do Cliente Ancora).'
WHERE d.id IN (SELECT decisao_id FROM o_alvo);
WITH ins AS (
  INSERT INTO proj_aplicacoes (operacao_id, bank_transaction_id, natureza_id, data_aplicacao, valor, descricao, motivo, criado_por_id)
  SELECT x.operacao, t.id, (SELECT id FROM proj_naturezas_aplicacao WHERE codigo = 'PAGAMENTO_ORDEM_INTERMEDIARIO'), t.data, t.valor,
         'Pagamento a terceiro por ordem do Intermediario (A. Vieira): ' || COALESCE(NULLIF(t.referencia, ''), 'Devolucao AV'),
         'Decisao de 08/10/2026: A. Vieira e intermediario e indica onde os recursos sao aplicados; o aporte do Cliente Ancora continua valendo (planilha: categoria "Devolucao AV").', x.master
  FROM o_alvo t CROSS JOIN o_ctx x RETURNING id, bank_transaction_id, valor)
INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
SELECT gen_random_uuid(), (SELECT master FROM o_ctx), 'PROJ_APLICACAO_REGISTRADA', ins.id::text,
       jsonb_build_object('natureza', 'PAGAMENTO_ORDEM_INTERMEDIARIO', 'valor', to_char(ins.valor, 'FM9999999990.00'), 'bankTransactionId', ins.bank_transaction_id, 'lote', 'devolucoes-av-20261008'), now()
FROM ins;
COMMIT;
SELECT 'aplicacoes por ordem do intermediario: ' || count(*) || ' | ' || to_char(sum(a.valor), 'FM999G999G990D00') AS resultado
FROM proj_aplicacoes a JOIN proj_naturezas_aplicacao n ON n.id = a.natureza_id AND n.codigo = 'PAGAMENTO_ORDEM_INTERMEDIARIO' WHERE a.cancelado_em IS NULL;
SELECT 'Conta Individual em 31/12/2025: ' || to_char(
  COALESCE((SELECT sum(c.valor) FROM proj_creditos c JOIN proj_credito_vinculos v ON v.credito_id = c.id AND v.cancelado_em IS NULL AND v.situacao = 'VINCULADO'
            JOIN proj_operacoes o ON o.id = c.operacao_id AND o.codigo = 'ANCORA' WHERE c.cancelado_em IS NULL AND c.data_credito <= DATE '2025-12-31'), 0)
  - COALESCE((SELECT sum(a.valor) FROM proj_aplicacoes a JOIN proj_naturezas_aplicacao n ON n.id = a.natureza_id AND n.tipo = 'DEVOLUCAO'
            JOIN proj_operacoes o ON o.id = a.operacao_id AND o.codigo = 'ANCORA' WHERE a.cancelado_em IS NULL AND a.data_aplicacao <= DATE '2025-12-31'), 0),
  'FM999G999G990D00') AS conferencia;