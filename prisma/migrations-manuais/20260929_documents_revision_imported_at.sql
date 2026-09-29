SET client_encoding = 'UTF8';
-- 29/09/2026 - Marca de versao revisada importada do Word (protege contra nova geracao sem confirmacao)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS revision_imported_at timestamp(3);
