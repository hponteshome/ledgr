-- prisma/migrations-manuais/2026-11-23-extbb-05-menu-contas-bancarias.sql
-- EXTBB-05 (23/11/2026) - item de menu Financeiro > Contas Bancarias (recurso contas-bancarias). Idempotente.
SET client_encoding = 'UTF8';
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, action_type, resource)
SELECT '/app/finance/contas-bancarias', 'Contas Bancárias', 'finance', 'FiCreditCard', id, 9, 'link', 'contas-bancarias'
FROM sidebar_items WHERE path = '/app/finance'
ON CONFLICT (path) DO NOTHING;