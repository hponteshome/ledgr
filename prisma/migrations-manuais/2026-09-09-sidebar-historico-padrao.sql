-- prisma/migrations-manuais/2026-09-09-sidebar-historico-padrao.sql
INSERT INTO sidebar_items (id, path, label, module, icon, parent_id, ordem, disabled, action_type)
VALUES (
  '59b6927b-6d41-4ea5-9cf6-48b24e0c14a8',
  '/app/accounting/historico-padrao',
  'Histórico Padrão',
  'accounting',
  'FiFileText',
  '322e684b-23ca-40a3-8340-913b2f15a241',
  13,
  false,
  'link'
)
ON CONFLICT (id) DO NOTHING;
