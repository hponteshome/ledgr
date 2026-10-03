-- prisma/migrations-manuais/20261003_proj_d8_menu.sql
-- D8 - item "Meus projetos" no grupo Projetos do LEDGR (abre o espaco segregado em nova aba).
BEGIN;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, action_type, resource)
SELECT '/app/projetos/lista', 'Meus projetos', 'projetos', 'FiFolder', g.id, 0, 'link', 'proj-projetos'
FROM sidebar_items g
WHERE g.path = '/app/projetos' AND NOT EXISTS (SELECT 1 FROM sidebar_items WHERE path = '/app/projetos/lista');
INSERT INTO audit_logs (actor_id, acao, target_id, depois)
SELECT hp.id, 'SIDEBAR_ITEM_CREATED', s.id::text, jsonb_build_object('path', s.path, 'label', s.label, 'item', 'D8')
FROM sidebar_items s CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE s.path = '/app/projetos/lista' AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.acao = 'SIDEBAR_ITEM_CREATED' AND a.target_id = s.id::text);
COMMIT;
SELECT path, label, ordem, resource FROM sidebar_items WHERE path LIKE '/app/projetos%' ORDER BY ordem, path;