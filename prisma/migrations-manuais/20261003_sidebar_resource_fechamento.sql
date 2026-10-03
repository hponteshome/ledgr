-- prisma/migrations-manuais/20261003_sidebar_resource_fechamento.sql
-- Item "Fechamento Mensal" sem resource: SidebarResourceGuard devolvia NONE para todo nao Master.
BEGIN;
INSERT INTO audit_logs (actor_id, acao, target_id, antes, depois)
SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com'), 'SIDEBAR_RESOURCE_SET', si.id::text,
       jsonb_build_object('resource', si.resource),
       jsonb_build_object('resource', 'fechamento-mensal', 'motivo', 'Recurso exigido por fechamento.controller sem item correspondente')
FROM sidebar_items si
WHERE si.id = 'd7d0ea06-5317-4efb-bf59-22d0bce78c0a' AND si.resource IS NULL;
UPDATE sidebar_items SET resource = 'fechamento-mensal'
WHERE id = 'd7d0ea06-5317-4efb-bf59-22d0bce78c0a' AND resource IS NULL;
COMMIT;
SELECT path, label, resource FROM sidebar_items WHERE id = 'd7d0ea06-5317-4efb-bf59-22d0bce78c0a';
SELECT pr.name AS perfil, psp.access_level
FROM profile_sidebar_permissions psp JOIN profiles pr ON pr.id = psp.profile_id
WHERE psp.item_id = 'd7d0ea06-5317-4efb-bf59-22d0bce78c0a' ORDER BY pr.name;