-- prisma/migrations-manuais/20261003_proj_1_2b_rls.sql
-- Fase 1.2b (passo B): RLS nas tabelas proj_*. A API informa o usuario por transacao (app.user_id);
-- o banco decide quem e Master pelo perfil (nao confia em flag da aplicacao). Sem usuario: zero linhas.
BEGIN;
CREATE OR REPLACE FUNCTION proj_ctx_user() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION proj_ctx_master() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u JOIN profiles p ON p.id = u.profile_id
    WHERE u.id = proj_ctx_user() AND u.deleted_at IS NULL AND (p.permissions->>'all') = 'true'
  )
$$;
CREATE OR REPLACE FUNCTION proj_tem_projeto(p_projeto uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT proj_ctx_master() OR EXISTS (
    SELECT 1 FROM proj_concessoes c JOIN proj_perfis pf ON pf.id = c.perfil_id
    WHERE c.user_id = proj_ctx_user() AND c.projeto_id = p_projeto AND c.cancelado_em IS NULL
      AND c.valido_de <= now() AND (c.valido_ate IS NULL OR c.valido_ate > now()) AND pf.ativo
  )
$$;
CREATE OR REPLACE FUNCTION proj_tem_operacao(p_operacao uuid, p_projeto uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT proj_ctx_master() OR EXISTS (
    SELECT 1 FROM proj_concessoes c JOIN proj_perfis pf ON pf.id = c.perfil_id
    WHERE c.user_id = proj_ctx_user() AND c.projeto_id = p_projeto AND (c.operacao_id IS NULL OR c.operacao_id = p_operacao)
      AND c.cancelado_em IS NULL AND c.valido_de <= now() AND (c.valido_ate IS NULL OR c.valido_ate > now()) AND pf.ativo
  )
$$;

ALTER TABLE proj_projetos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_projetos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_projetos_ler ON proj_projetos;
DROP POLICY IF EXISTS proj_projetos_gravar ON proj_projetos;
CREATE POLICY proj_projetos_ler ON proj_projetos FOR SELECT USING (proj_tem_projeto(id));
CREATE POLICY proj_projetos_gravar ON proj_projetos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());

ALTER TABLE proj_projeto_empresas ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_projeto_empresas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_projeto_empresas_ler ON proj_projeto_empresas;
DROP POLICY IF EXISTS proj_projeto_empresas_gravar ON proj_projeto_empresas;
CREATE POLICY proj_projeto_empresas_ler ON proj_projeto_empresas FOR SELECT USING (proj_tem_projeto(projeto_id));
CREATE POLICY proj_projeto_empresas_gravar ON proj_projeto_empresas FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());

ALTER TABLE proj_operacoes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_operacoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_operacoes_ler ON proj_operacoes;
DROP POLICY IF EXISTS proj_operacoes_gravar ON proj_operacoes;
CREATE POLICY proj_operacoes_ler ON proj_operacoes FOR SELECT USING (proj_tem_operacao(id, projeto_id));
CREATE POLICY proj_operacoes_gravar ON proj_operacoes FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());

ALTER TABLE proj_participacoes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_participacoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_participacoes_ler ON proj_participacoes;
DROP POLICY IF EXISTS proj_participacoes_gravar ON proj_participacoes;
CREATE POLICY proj_participacoes_ler ON proj_participacoes FOR SELECT USING (EXISTS (SELECT 1 FROM proj_operacoes o WHERE o.id = operacao_id));
CREATE POLICY proj_participacoes_gravar ON proj_participacoes FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());

ALTER TABLE proj_contrapartes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_contrapartes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_contrapartes_ler ON proj_contrapartes;
DROP POLICY IF EXISTS proj_contrapartes_gravar ON proj_contrapartes;
CREATE POLICY proj_contrapartes_ler ON proj_contrapartes FOR SELECT USING (EXISTS (SELECT 1 FROM proj_participacoes pp WHERE pp.contraparte_id = proj_contrapartes.id));
CREATE POLICY proj_contrapartes_gravar ON proj_contrapartes FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());

ALTER TABLE proj_concessoes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_concessoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_concessoes_ler ON proj_concessoes;
DROP POLICY IF EXISTS proj_concessoes_gravar ON proj_concessoes;
CREATE POLICY proj_concessoes_ler ON proj_concessoes FOR SELECT USING (proj_ctx_master() OR user_id = proj_ctx_user());
CREATE POLICY proj_concessoes_gravar ON proj_concessoes FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
COMMIT;
SELECT c.relname AS tabela, c.relrowsecurity AS rls, c.relforcerowsecurity AS forcado, (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = c.relname) AS politicas FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'proj_%' ORDER BY 1;