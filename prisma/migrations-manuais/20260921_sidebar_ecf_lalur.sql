-- 21/09/2026 - Item de menu "ECF - Analise do LALUR (consulta)" no grupo SPED (autorizado pelo usuario).
-- UMA linha em sidebar_items. Nao toca em profile_/user_sidebar_permissions.
-- Rollback: DELETE FROM sidebar_items WHERE path = '/app/sped/ecf/arquivo';
BEGIN;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, disabled, action_type)
SELECT '/app/sped/ecf/arquivo',
       U&'ECF \2014 An\00e1lise do LALUR (consulta)',
       'sped',
       COALESCE((SELECT s.icon FROM sidebar_items s WHERE s.parent_id = m.parent_id AND s.path LIKE '/app/sped/ecf%' ORDER BY s.ordem LIMIT 1), 'FiColumns'),
       m.parent_id,
       (SELECT MIN(g) FROM generate_series(4, 200) g
         WHERE g NOT IN (SELECT ordem FROM sidebar_items WHERE parent_id = m.parent_id)),
       false,
       'link'
FROM sidebar_items m
WHERE m.path = '/app/sped/ecd/movimentacao'
ON CONFLICT (path) DO NOTHING;
COMMIT;