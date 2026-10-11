-- prisma/migrations-manuais/20261011_sidebar_solicitacoes_assinatura.sql
-- Menu: tela de solicitacoes de assinatura (ClickSign 3.0) no grupo "Assinaturas & Certificados".
-- Idempotente. Permissoes copiadas do item pai (/app/assinaturas).
BEGIN;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, disabled, action_type, resource)
SELECT '/app/documents/signatures', 'Solicitações de Assinatura', v.module, v.icon, v.parent_id,
       (SELECT min(x.ordem) - 1 FROM sidebar_items x WHERE x.parent_id = v.parent_id), false, 'link', v.resource
FROM sidebar_items v
WHERE v.path = '/app/signatures/validate'
  AND NOT EXISTS (SELECT 1 FROM sidebar_items n WHERE n.path = '/app/documents/signatures');

INSERT INTO profile_sidebar_permissions (profile_id, item_id, access_level)
SELECT pp.profile_id, n.id, pp.access_level
FROM profile_sidebar_permissions pp
JOIN sidebar_items pai ON pai.id = pp.item_id AND pai.path = '/app/assinaturas'
CROSS JOIN sidebar_items n
WHERE n.path = '/app/documents/signatures'
  AND NOT EXISTS (SELECT 1 FROM profile_sidebar_permissions e WHERE e.profile_id = pp.profile_id AND e.item_id = n.id);

INSERT INTO user_sidebar_permissions (user_id, item_id, company_id, access_level)
SELECT up.user_id, n.id, up.company_id, up.access_level
FROM user_sidebar_permissions up
JOIN sidebar_items pai ON pai.id = up.item_id AND pai.path = '/app/assinaturas'
CROSS JOIN sidebar_items n
WHERE n.path = '/app/documents/signatures'
  AND NOT EXISTS (SELECT 1 FROM user_sidebar_permissions e
                  WHERE e.user_id = up.user_id AND e.item_id = n.id AND e.company_id IS NOT DISTINCT FROM up.company_id);
COMMIT;

SELECT i.ordem, i.path, i.label, i.icon, i.resource,
       (SELECT count(*) FROM profile_sidebar_permissions p WHERE p.item_id = i.id) AS perfis,
       (SELECT count(*) FROM user_sidebar_permissions u WHERE u.item_id = i.id) AS usuarios
FROM sidebar_items i
WHERE i.parent_id = (SELECT id FROM sidebar_items WHERE path = '/app/assinaturas')
ORDER BY i.ordem;