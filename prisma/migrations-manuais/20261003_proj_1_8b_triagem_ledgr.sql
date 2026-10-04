-- prisma/migrations-manuais/20261003_proj_1_8b_triagem_ledgr.sql
-- Fase 1.8 revista - triagem do extrato no LEDGR (empresa ativa); o projeto so recebe o que for encaminhado.
BEGIN;
-- Devolve SO os ids das transacoes DA EMPRESA ja destinadas (comprovam credito ou marcadas como nao pertencentes).
-- SECURITY DEFINER: a triagem nao precisa (nem pode) enxergar os dados do projeto para saber o que ja foi destinado.
CREATE OR REPLACE FUNCTION proj_transacoes_destinadas(p_company uuid)
RETURNS TABLE (bank_transaction_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.bank_transaction_id FROM proj_credito_provas p JOIN bank_transactions t ON t.id = p.bank_transaction_id
   WHERE p.cancelado_em IS NULL AND t.company_id = p_company
  UNION
  SELECT d.bank_transaction_id FROM proj_extrato_decisoes d JOIN bank_transactions t ON t.id = d.bank_transaction_id
   WHERE d.cancelado_em IS NULL AND t.company_id = p_company
$$;
REVOKE ALL ON FUNCTION proj_transacoes_destinadas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION proj_transacoes_destinadas(uuid) TO ledgr_api;

INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, action_type, resource)
SELECT '/app/projetos/encaminhar', 'Encaminhar entradas', 'projetos', 'FiUpload', g.id, 2, 'link', 'proj-encaminhar'
FROM sidebar_items g WHERE g.path = '/app/projetos' AND NOT EXISTS (SELECT 1 FROM sidebar_items WHERE path = '/app/projetos/encaminhar');
INSERT INTO audit_logs (actor_id, acao, target_id, depois)
SELECT hp.id, 'SIDEBAR_ITEM_CREATED', s.id::text, jsonb_build_object('path', s.path, 'label', s.label, 'item', 'Fase 1.8 revista')
FROM sidebar_items s CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE s.path = '/app/projetos/encaminhar' AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.acao = 'SIDEBAR_ITEM_CREATED' AND a.target_id = s.id::text);
COMMIT;
SELECT count(*) AS entradas_sunsys_ja_destinadas FROM proj_transacoes_destinadas('6a13e876-7056-4076-a403-9610f7dc37b1');