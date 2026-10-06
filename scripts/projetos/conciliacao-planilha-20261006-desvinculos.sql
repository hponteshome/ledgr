-- 06/10/2026: desvincula da Conta Individual os 11 creditos que a planilha ajustada nao marca como aporte do Cliente Ancora.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE alvo ON COMMIT DROP AS
SELECT v.id AS vinculo_id, v.credito_id, v.adquirente_id, c.numero_ordem, c.valor,
       CASE WHEN c.numero_ordem IN (1, 2) THEN 'venda de unidade (nao proveniente de A. Vieira)'
            WHEN c.numero_ordem = 20 THEN 'entrada de terceiro sem relacao com o Adquirente'
            ELSE 'devolucao do circuito da Josi (protecao de bloqueios)' END AS natureza
FROM proj_creditos c JOIN proj_credito_vinculos v ON v.credito_id = c.id AND v.cancelado_em IS NULL AND v.situacao = 'VINCULADO'
JOIN proj_operacoes o ON o.id = c.operacao_id AND o.codigo = 'ANCORA'
WHERE c.cancelado_em IS NULL AND c.numero_ordem IN (1, 2, 20, 31, 32, 33, 39, 43, 44, 45, 46);
SELECT numero_ordem AS n, valor, natureza FROM alvo ORDER BY numero_ordem;
DO $$ BEGIN IF (SELECT count(*) FROM alvo) <> 11 OR (SELECT sum(valor) FROM alvo) <> 201191.74 THEN
  RAISE EXCEPTION 'esperados 11 creditos somando 201.191,74; encontrados % somando %', (SELECT count(*) FROM alvo), (SELECT sum(valor) FROM alvo); END IF; END $$;
UPDATE proj_credito_vinculos v SET cancelado_em = now(), cancelado_por_id = (SELECT id FROM users WHERE email = 'hpontes@ledgr.com'),
  motivo_cancelamento = 'Substituido por DESVINCULADO: conciliacao com a planilha ajustada de 06/10/2026.'
FROM alvo a WHERE v.id = a.vinculo_id;
INSERT INTO proj_credito_vinculos (credito_id, situacao, adquirente_id, motivo, criado_por_id)
SELECT credito_id, 'DESVINCULADO', NULL::uuid,
       'Credito nao e aporte do Adquirente Ancora: ' || natureza || ' (planilha ajustada do Financeiro de 06/10/2026, coluna Projeto Ancora).',
       (SELECT id FROM users WHERE email = 'hpontes@ledgr.com')
FROM alvo;
INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
SELECT gen_random_uuid(), (SELECT id FROM users WHERE email = 'hpontes@ledgr.com'), 'PROJ_CREDITO_VINCULO_ALTERADO', a.credito_id::text,
       jsonb_build_object('numero', a.numero_ordem, 'de', 'VINCULADO', 'para', 'DESVINCULADO', 'valor', to_char(a.valor, 'FM9999999990.00'), 'motivo', a.natureza, 'lote', 'conciliacao-planilha-20261006'), now()
FROM alvo a;
COMMIT;
SELECT 'Conta Individual (vinculados - devolucoes): ' || to_char(
  COALESCE((SELECT sum(c.valor) FROM proj_creditos c JOIN proj_credito_vinculos v ON v.credito_id = c.id AND v.cancelado_em IS NULL AND v.situacao = 'VINCULADO'
            JOIN proj_operacoes o ON o.id = c.operacao_id AND o.codigo = 'ANCORA' WHERE c.cancelado_em IS NULL AND c.data_credito <= DATE '2025-12-31'), 0)
  - COALESCE((SELECT sum(a.valor) FROM proj_aplicacoes a JOIN proj_naturezas_aplicacao n ON n.id = a.natureza_id AND n.tipo = 'DEVOLUCAO'
            JOIN proj_operacoes o ON o.id = a.operacao_id AND o.codigo = 'ANCORA' WHERE a.cancelado_em IS NULL AND a.data_aplicacao <= DATE '2025-12-31'), 0),
  'FM999G999G990D00') || ' em 31/12/2025' AS conferencia;