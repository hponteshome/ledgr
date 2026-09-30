SET client_encoding = 'UTF8';
-- 30/09/2026 - Gestao de templates de documento: padrao, versao, exclusao logica, historico de versoes,
-- rastreio do template usado em documents e rental_contracts.
BEGIN;
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS deleted_at timestamp(6);
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS updated_by_id uuid;
CREATE TABLE IF NOT EXISTS document_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  version integer NOT NULL,
  content text NOT NULL,
  change_note text,
  created_by_id uuid NOT NULL,
  created_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT document_template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES document_templates(id),
  CONSTRAINT document_template_versions_template_id_version_key UNIQUE (template_id, version)
);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS template_version integer;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS template_id uuid;
UPDATE document_templates SET name = 'Locação Residencial - Padrão', is_default = true WHERE id = 'b37f43d3-37ff-44a3-87ad-073b4f026fb3';
INSERT INTO document_template_versions (template_id, version, content, change_note, created_by_id)
SELECT id, 1, content, 'Versão inicial (template existente em 30/09/2026)', created_by_id
  FROM document_templates WHERE id = 'b37f43d3-37ff-44a3-87ad-073b4f026fb3'
ON CONFLICT (template_id, version) DO NOTHING;
COMMIT;
