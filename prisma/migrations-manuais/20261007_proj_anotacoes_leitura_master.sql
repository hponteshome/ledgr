-- prisma/migrations-manuais/20261007_proj_anotacoes_leitura_master.sql
-- Anotacoes da planilha do Financeiro (07/10/2026): leitura pela API, so para o Master (detalhamento de Fontes e usos).
\set ON_ERROR_STOP on
SELECT 'antes: rls=' || c.relrowsecurity || ' force=' || c.relforcerowsecurity || ' politicas=' || (SELECT count(*) FROM pg_policies p WHERE p.tablename = 'proj_anotacoes_extrato')
       || ' select_api=' || has_table_privilege('ledgr_api', 'proj_anotacoes_extrato', 'SELECT') AS estado
FROM pg_class c WHERE c.relname = 'proj_anotacoes_extrato';
BEGIN;
ALTER TABLE proj_anotacoes_extrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE proj_anotacoes_extrato FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_anotacoes_master_leitura ON proj_anotacoes_extrato;
CREATE POLICY proj_anotacoes_master_leitura ON proj_anotacoes_extrato FOR SELECT USING (proj_ctx_master());
GRANT SELECT ON proj_anotacoes_extrato TO ledgr_api;
COMMIT;
SELECT 'depois: rls=' || c.relrowsecurity || ' force=' || c.relforcerowsecurity || ' select_api=' || has_table_privilege('ledgr_api', 'proj_anotacoes_extrato', 'SELECT')
       || ' insert_api=' || has_table_privilege('ledgr_api', 'proj_anotacoes_extrato', 'INSERT') AS estado
FROM pg_class c WHERE c.relname = 'proj_anotacoes_extrato';