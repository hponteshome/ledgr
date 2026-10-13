-- prisma/migrations-manuais/20261013_proj_fluxo_contas.sql
-- Contas do Fluxo (13/10/2026): mapa papel -> conta do plano de cada empresa para o projeto Recife Ocean. Toda troca de conta
-- fica em proj_fluxo_contas_hist (imutavel). So Master (RLS). Carga inicial com as contas criadas em 13/10/2026.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS proj_fluxo_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES proj_projetos(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  papel varchar(40) NOT NULL,
  descricao text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  account_id uuid NULL REFERENCES chart_of_accounts(id),
  rotina boolean NOT NULL DEFAULT false,
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por_id uuid NULL,
  CONSTRAINT proj_fluxo_contas_uk UNIQUE (projeto_id, papel));
CREATE TABLE IF NOT EXISTS proj_fluxo_contas_hist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES proj_fluxo_contas(id),
  papel varchar(40) NOT NULL,
  account_id_antes uuid NULL,
  account_id_depois uuid NULL,
  alterado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  alterado_por_id uuid NULL);
CREATE OR REPLACE FUNCTION proj_fluxo_contas_upd() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.projeto_id, NEW.company_id, NEW.papel) IS DISTINCT FROM ROW(OLD.projeto_id, OLD.company_id, OLD.papel) THEN
    RAISE EXCEPTION 'Contas do Fluxo: projeto, empresa e papel nao mudam'; END IF;
  IF NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    INSERT INTO proj_fluxo_contas_hist (conta_id, papel, account_id_antes, account_id_depois, alterado_por_id)
    VALUES (OLD.id, OLD.papel, OLD.account_id, NEW.account_id, NEW.atualizado_por_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_fluxo_contas_upd_trg ON proj_fluxo_contas;
CREATE TRIGGER proj_fluxo_contas_upd_trg BEFORE UPDATE ON proj_fluxo_contas FOR EACH ROW EXECUTE FUNCTION proj_fluxo_contas_upd();
CREATE OR REPLACE FUNCTION proj_fluxo_contas_hist_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historico das contas do Fluxo e imutavel (%).', TG_OP; END $$;
DROP TRIGGER IF EXISTS proj_fluxo_contas_hist_imut_trg ON proj_fluxo_contas_hist;
CREATE TRIGGER proj_fluxo_contas_hist_imut_trg BEFORE UPDATE OR DELETE ON proj_fluxo_contas_hist FOR EACH ROW EXECUTE FUNCTION proj_fluxo_contas_hist_imutavel();
ALTER TABLE proj_fluxo_contas ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_fluxo_contas FORCE ROW LEVEL SECURITY;
ALTER TABLE proj_fluxo_contas_hist ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_fluxo_contas_hist FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_fluxo_contas_master ON proj_fluxo_contas;
CREATE POLICY proj_fluxo_contas_master ON proj_fluxo_contas FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
DROP POLICY IF EXISTS proj_fluxo_contas_hist_master ON proj_fluxo_contas_hist;
CREATE POLICY proj_fluxo_contas_hist_master ON proj_fluxo_contas_hist FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
GRANT SELECT, INSERT, UPDATE ON proj_fluxo_contas TO ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_fluxo_contas FROM ledgr_api;
GRANT SELECT, INSERT ON proj_fluxo_contas_hist TO ledgr_api;
REVOKE UPDATE, DELETE, TRUNCATE ON proj_fluxo_contas_hist FROM ledgr_api;
INSERT INTO proj_fluxo_contas (projeto_id, company_id, papel, descricao, ordem, account_id, rotina)
SELECT 'a912ebc7-86e5-401c-8a21-20f561db2fce'::uuid, v.cid::uuid, v.papel, v.descr, v.ordem,
  (SELECT a.id FROM chart_of_accounts a WHERE a.company_id = v.cid::uuid AND a.code = v.code AND (to_jsonb(a)->>'deleted_at') IS NULL LIMIT 1), v.rotina
FROM (VALUES
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_CREDITO_RM', U&'Cr\00E9dito confessado contra a Real Mouch\00E3o', 101, '12101010006', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_OBRIG_ANEXO_V', U&'Obriga\00E7\00E3o de pagamento do Anexo V por conta da RM', 102, '22103010001', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_JUROS_RECEBER', U&'Juros a receber - Real Mouch\00E3o', 103, '12101010007', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_CC_SUNSYS', U&'Conta corrente Sunsys - Opera\00E7\00E3o \00C2ncora', 104, '12101020024', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_TITULO_VAL', U&'T\00EDtulos de investimento a pagar - VAL', 105, '22101060004', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_MASSA_PAGAR', U&'Contas a pagar - Massa insolvente da RM (spread)', 106, '21101020006', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_REC_JUROS', U&'Receita de juros - Real Mouch\00E3o', 107, '32102010003', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_VC_ATIVA', U&'Varia\00E7\00E3o cambial ativa - Real Mouch\00E3o', 108, '32102010004', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_VC_PASSIVA', U&'Varia\00E7\00E3o cambial passiva - Real Mouch\00E3o', 109, '42301010012', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_DESP_SPREAD', U&'Despesa de spread \00E0 massa da RM', 110, '42301010013', false),
  ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', 'F5_DESP_RET_VAL', U&'Remunera\00E7\00E3o do t\00EDtulo da VAL', 111, '42301010014', false),
  ('ad8ad459-40b4-47f5-8a9a-7e4688487b4f', 'SUNRISE_RECEBER_F5', U&'A receber da F5 - Anexo V por conta da RM', 201, '12101020024', false),
  ('ad8ad459-40b4-47f5-8a9a-7e4688487b4f', 'SUNRISE_OBRIG_RM', U&'Obriga\00E7\00E3o de participa\00E7\00E3o econ\00F4mica - Real Mouch\00E3o', 202, '22103010001', false),
  ('ad8ad459-40b4-47f5-8a9a-7e4688487b4f', 'SUNRISE_CC_HOTELSYS', U&'Conta corrente Hotelsys - Anexo V', 203, '12101020025', false),
  ('6a13e876-7056-4076-a403-9610f7dc37b1', 'SUNSYS_BANCOS', U&'Bancos (conta de rotina)', 301, NULL, true),
  ('6a13e876-7056-4076-a403-9610f7dc37b1', 'SUNSYS_ADIANT', U&'Adiantamentos - Opera\00E7\00E3o \00C2ncora', 302, '22101050005', false),
  ('6a13e876-7056-4076-a403-9610f7dc37b1', 'SUNSYS_MUTUO_HOTELSYS', U&'M\00FAtuo Hotelsys - Opera\00E7\00E3o \00C2ncora', 303, '12101020022', false),
  ('6a13e876-7056-4076-a403-9610f7dc37b1', 'SUNSYS_CC_F5', U&'Conta corrente F5 - Opera\00E7\00E3o \00C2ncora', 304, '22101050006', false),
  ('c2d48edc-28b7-4fd8-9272-b486449ab2cc', 'HOTELSYS_MUTUO_SUNSYS', U&'M\00FAtuo Sunsys - Opera\00E7\00E3o \00C2ncora', 401, '22101020001', false),
  ('c2d48edc-28b7-4fd8-9272-b486449ab2cc', 'HOTELSYS_CC_SUNRISE', U&'Conta corrente Sunrise - Anexo V', 402, '22101020002', false),
  ('c2d48edc-28b7-4fd8-9272-b486449ab2cc', 'HOTELSYS_A_RECLASSIFICAR', U&'Pagamentos a comprovar / passivos a reclassificar - Opera\00E7\00E3o \00C2ncora', 403, '11304010009', false),
  ('c2d48edc-28b7-4fd8-9272-b486449ab2cc', 'HOTELSYS_DESP_MANUT', U&'Despesas de manuten\00E7\00E3o - Opera\00E7\00E3o \00C2ncora', 404, '42103010041', false),
  ('c2d48edc-28b7-4fd8-9272-b486449ab2cc', 'HOTELSYS_PASSIVO_REAL', U&'Passivos reais da Hotelsys (conta de rotina, por natureza)', 405, NULL, true)
) AS v(cid, papel, descr, ordem, code, rotina)
ON CONFLICT (projeto_id, papel) DO NOTHING;
COMMIT;