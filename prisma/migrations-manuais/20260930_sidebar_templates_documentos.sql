SET client_encoding = 'UTF8';
-- 30/09/2026 - Item de menu Arquivo Digital > Templates > Documentos (Templates de Documentos).
-- Rollback: DELETE FROM sidebar_items WHERE path = '/app/arquivo/templates/documentos';
BEGIN;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, disabled, action_type)
SELECT '/app/arquivo/templates/documentos',
       'Documentos',
       m.module,
       COALESCE((SELECT icon FROM sidebar_items WHERE icon = 'FiFileText' LIMIT 1), 'FiLayers'),
       m.parent_id,
       (SELECT MIN(g) FROM generate_series(1, 200) g
         WHERE g NOT IN (SELECT ordem FROM sidebar_items WHERE parent_id = m.parent_id)),
       false,
       'link'
FROM sidebar_items m
WHERE m.path = '/app/arquivo/templates/logotipos'
ON CONFLICT (path) DO NOTHING;
COMMIT;
