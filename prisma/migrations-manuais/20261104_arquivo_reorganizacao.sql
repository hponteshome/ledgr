-- prisma/migrations-manuais/20261104_arquivo_reorganizacao.sql
-- 04/11/2026 - Arquivo Digital reorganizado em 5 areas (Societario, Imoveis, Contabil e Fiscal, Pessoal, Templates).
-- documents.subtipo separa Balancete/ECD/ECF/Obrigacao etc. Itens de menu de 3o nivel saem (abas na pagina);
-- copia dos itens originais em sidebar_items_bkp_20261104. As rotas antigas continuam funcionando.
\set ON_ERROR_STOP on
ALTER TABLE documents ADD COLUMN IF NOT EXISTS subtipo varchar(30);
CREATE INDEX IF NOT EXISTS documents_company_type_subtipo_idx ON documents (company_id, type, subtipo) WHERE deleted_at IS NULL;
BEGIN;
CREATE TABLE IF NOT EXISTS sidebar_items_bkp_20261104 AS SELECT * FROM sidebar_items WHERE false;
INSERT INTO sidebar_items_bkp_20261104
SELECT * FROM sidebar_items WHERE path LIKE '/app/arquivo%' AND NOT EXISTS (SELECT 1 FROM sidebar_items_bkp_20261104);
DELETE FROM sidebar_items
 WHERE path IN ('/app/arquivo/fiscal', '/app/arquivo/locacao')
    OR path LIKE '/app/arquivo/societario/%' OR path LIKE '/app/arquivo/contabil/%'
    OR path LIKE '/app/arquivo/fiscal/%' OR path LIKE '/app/arquivo/rh/%' OR path LIKE '/app/arquivo/imoveis/%';
UPDATE sidebar_items SET ordem = ordem + 100 WHERE parent_id = (SELECT id FROM sidebar_items WHERE path = '/app/arquivo');
UPDATE sidebar_items SET ordem = 1, label = U&'Societ\00e1rio'           WHERE path = '/app/arquivo/societario';
UPDATE sidebar_items SET ordem = 2, label = U&'Im\00f3veis'              WHERE path = '/app/arquivo/imoveis';
UPDATE sidebar_items SET ordem = 3, label = U&'Cont\00e1bil e Fiscal'    WHERE path = '/app/arquivo/contabil';
UPDATE sidebar_items SET ordem = 4, label = 'Pessoal'                   WHERE path = '/app/arquivo/rh';
UPDATE sidebar_items SET ordem = 5                                      WHERE path = '/app/arquivo/templates';
COMMIT;
SELECT s.ordem, s.path, s.label FROM sidebar_items s
 WHERE s.parent_id = (SELECT id FROM sidebar_items WHERE path = '/app/arquivo') ORDER BY s.ordem;
SELECT count(*) AS itens_no_backup FROM sidebar_items_bkp_20261104;