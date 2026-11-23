-- prisma/migrations-manuais/2026-11-23-extbb-10b-menu-extratos.sql
-- EXTBB-10B (23/11/2026) - item de menu do Financeiro passa a abrir a tela nova: rotulo "Extratos e Conciliacao".
SET client_encoding = 'UTF8';
UPDATE sidebar_items SET label = 'Extratos e Conciliação' WHERE path = '/app/finance/bank-import';