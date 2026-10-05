-- prisma/migrations-manuais/20261004_seg_0a_recursos_menu.sql
-- Seguranca 0A (04/10/2026): quatro recursos novos nos grupos do menu que ja existem (aparecem em Permissoes de Menu).
BEGIN;
UPDATE sidebar_items SET resource = 'relatorios-contabeis' WHERE path = '/app/accounting/relatorios' AND COALESCE(resource, '') = '';
UPDATE sidebar_items SET resource = 'importacoes-contabeis' WHERE path = '/app/accounting/importacao' AND COALESCE(resource, '') = '';
UPDATE sidebar_items SET resource = 'societario' WHERE path = '/app/societario' AND COALESCE(resource, '') = '';
UPDATE sidebar_items SET resource = 'conciliacao-bancaria' WHERE path = '/app/finance/bank-import' AND COALESCE(resource, '') = '';
COMMIT;
SELECT label, path, resource FROM sidebar_items WHERE resource IN ('relatorios-contabeis', 'importacoes-contabeis', 'societario', 'conciliacao-bancaria') ORDER BY resource;