-- scripts/seg/teste-rls-proj.sql
-- Testes de RLS nas tabelas proj_* executados COMO ledgr_api (SET ROLE). Sempre desfeitos (ROLLBACK).
BEGIN;
SET LOCAL ROLE ledgr_api;
SELECT 'sem_contexto=' || count(*) FROM proj_projetos;
SELECT 'sem_contexto_creditos=' || count(*) FROM proj_creditos;
SELECT 'ctx_qa=' || (set_config('app.user_id', (SELECT id::text FROM users WHERE email = 'qa.hotelsys@ledgr.local'), true) IS NOT NULL)::text;
SELECT 'qa_projetos=' || count(*) FROM proj_projetos;
SELECT 'qa_operacoes=' || count(*) FROM proj_operacoes;
SELECT 'qa_participacoes=' || count(*) FROM proj_participacoes;
SELECT 'qa_contrapartes=' || count(*) FROM proj_contrapartes;
SELECT 'qa_creditos=' || count(*) FROM proj_creditos;
WITH u AS (UPDATE proj_creditos SET valor = valor RETURNING 1) SELECT 'qa_update_creditos=' || count(*) FROM u;
SELECT 'qa_vinculos=' || count(*) FROM proj_credito_vinculos WHERE cancelado_em IS NULL;
WITH u AS (UPDATE proj_credito_vinculos SET motivo_cancelamento = motivo_cancelamento RETURNING 1) SELECT 'qa_update_vinculos=' || count(*) FROM u;
SELECT 'qa_concessoes_de_outros=' || count(*) FROM proj_concessoes WHERE user_id <> proj_ctx_user();
WITH u AS (UPDATE proj_operacoes SET nome = nome RETURNING 1) SELECT 'qa_update_operacoes=' || count(*) FROM u;
SELECT 'ctx_master=' || (set_config('app.user_id', (SELECT id::text FROM users WHERE email = 'hpontes@ledgr.com'), true) IS NOT NULL)::text;
SELECT 'master_projetos=' || count(*) FROM proj_projetos;
SELECT 'master_operacoes=' || count(*) FROM proj_operacoes;
CREATE TEMP TABLE t_imut (r text) ON COMMIT DROP;
DO $$ BEGIN BEGIN UPDATE proj_credito_vinculos SET motivo = motivo || ' alterado' WHERE id = (SELECT id FROM proj_credito_vinculos LIMIT 1); INSERT INTO t_imut VALUES ('nao'); EXCEPTION WHEN others THEN INSERT INTO t_imut VALUES ('sim'); END; END $$;
SELECT 'vinculo_imutavel=' || r FROM t_imut;
CREATE TEMP TABLE t_del (r text) ON COMMIT DROP;
DO $$ BEGIN BEGIN DELETE FROM proj_credito_vinculos WHERE id = (SELECT id FROM proj_credito_vinculos LIMIT 1); INSERT INTO t_del VALUES ('permitido'); EXCEPTION WHEN others THEN INSERT INTO t_del VALUES ('negado'); END; END $$;
SELECT 'vinculo_delete=' || r FROM t_del;
ROLLBACK;