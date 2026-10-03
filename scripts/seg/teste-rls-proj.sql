-- scripts/seg/teste-rls-proj.sql
-- Testes de RLS nas tabelas proj_* executados COMO ledgr_api (SET ROLE). Sempre desfeitos (ROLLBACK).
BEGIN;
SET LOCAL ROLE ledgr_api;
SELECT 'sem_contexto=' || count(*) FROM proj_projetos;
SELECT 'ctx_qa=' || (set_config('app.user_id', (SELECT id::text FROM users WHERE email = 'qa.hotelsys@ledgr.local'), true) IS NOT NULL)::text;
SELECT 'qa_projetos=' || count(*) FROM proj_projetos;
SELECT 'qa_operacoes=' || count(*) FROM proj_operacoes;
SELECT 'qa_participacoes=' || count(*) FROM proj_participacoes;
SELECT 'qa_contrapartes=' || count(*) FROM proj_contrapartes;
SELECT 'qa_concessoes_de_outros=' || count(*) FROM proj_concessoes WHERE user_id <> proj_ctx_user();
WITH u AS (UPDATE proj_operacoes SET nome = nome RETURNING 1) SELECT 'qa_update_operacoes=' || count(*) FROM u;
SELECT 'ctx_master=' || (set_config('app.user_id', (SELECT id::text FROM users WHERE email = 'hpontes@ledgr.com'), true) IS NOT NULL)::text;
SELECT 'master_projetos=' || count(*) FROM proj_projetos;
SELECT 'master_operacoes=' || count(*) FROM proj_operacoes;
ROLLBACK;