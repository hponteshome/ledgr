-- 2026-11-16 - folha_desde (vigencia da flag tem_folha) e link de acao nos alertas.
-- LM: folha CLT a partir de 2027 (domesticos estavam na PF do socio - informado em 16/11/2026).
\pset pager off
BEGIN;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS folha_desde date;
UPDATE companies SET folha_desde = DATE '2027-01-01' WHERE id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND folha_desde IS NULL;
ALTER TABLE company_alerts ADD COLUMN IF NOT EXISTS action_url varchar(200);
ALTER TABLE company_alerts ADD COLUMN IF NOT EXISTS action_label varchar(60);
UPDATE company_alerts SET action_url = '/app/sistema/obrigacoes', action_label = 'Ver as DIMOBs pendentes'
 WHERE id = '5ddbe1cb-19dc-44ba-92ec-94558fef5c14' AND action_url IS NULL;
UPDATE company_alerts SET action_url = '/app/sped/efd', action_label = U&'Abrir EFD-Contribui\00e7\00f5es'
 WHERE id = '973caef3-e924-41e7-8944-91e8b600ac20' AND action_url IS NULL;
COMMIT;
SELECT legal_name, tem_folha, folha_desde, tem_pro_labore, obrigacoes_desde FROM companies WHERE id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a';
SELECT title, action_url, action_label FROM company_alerts WHERE resolved_at IS NULL;