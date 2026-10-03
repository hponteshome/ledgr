-- prisma/migrations-manuais/20261003_proj_1_3_menu.sql
-- Fase 1.3 - grupo "Projetos" e item "Concessoes de acesso" no menu (recurso sem permissao em perfis: so Master ve).
BEGIN;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, action_type)
SELECT '/app/projetos', 'Projetos', 'projetos', 'FiFolder', NULL, 15, (SELECT action_type FROM sidebar_items WHERE path = '/app/finance')
WHERE NOT EXISTS (SELECT 1 FROM sidebar_items WHERE path = '/app/projetos');
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, action_type, resource)
SELECT '/app/projetos/concessoes', 'Concessões de acesso', 'projetos', 'FiKey', g.id, 1, 'link', 'proj-concessoes'
FROM sidebar_items g
WHERE g.path = '/app/projetos' AND NOT EXISTS (SELECT 1 FROM sidebar_items WHERE path = '/app/projetos/concessoes');
INSERT INTO audit_logs (actor_id, acao, target_id, depois)
SELECT hp.id, 'SIDEBAR_ITEM_CREATED', s.id::text, jsonb_build_object('path', s.path, 'label', s.label, 'item', 'Fase 1.3')
FROM sidebar_items s CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE s.path IN ('/app/projetos', '/app/projetos/concessoes')
  AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.acao = 'SIDEBAR_ITEM_CREATED' AND a.target_id = s.id::text);
COMMIT;
SELECT path, label, module, icon, ordem, action_type, resource FROM sidebar_items WHERE path LIKE '/app/projetos%' ORDER BY path;