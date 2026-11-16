-- 16/11/2026 - Item de menu "Regimes x Declaracoes" no grupo SPED. UMA linha em sidebar_items.
-- Rollback: DELETE FROM sidebar_items WHERE path = '/app/sped/regimes';
\pset pager off
BEGIN;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, disabled, action_type)
SELECT '/app/sped/regimes',
       U&'Regimes x Declara\00e7\00f5es',
       'sped',
       'FiCheckCircle',
       m.parent_id,
       (SELECT MIN(g) FROM generate_series(4, 200) g
         WHERE g NOT IN (SELECT ordem FROM sidebar_items WHERE parent_id = m.parent_id)),
       false,
       'link'
  FROM sidebar_items m
 WHERE m.path = '/app/sped/ecf/arquivo'
ON CONFLICT (path) DO NOTHING;
COMMIT;
SELECT path, label, ordem FROM sidebar_items WHERE path = '/app/sped/regimes';