-- prisma/migrations-manuais/20261104_imoveis_cessao.sql
-- 04/11/2026 - Imoveis: contratos de cessao (tipo de documento CONTRATO_CESSAO; asset_documents.tipo CESSAO).
-- Um contrato de cessao cobre varios imoveis: o indice unico passa a ser (documento, imovel).
\set ON_ERROR_STOP on
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CONTRATO_CESSAO';
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'asset_documents'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format('ALTER TABLE asset_documents DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE asset_documents ADD CONSTRAINT asset_documents_tipo_check CHECK (tipo IN ('MATRICULA', 'ESCRITURA', 'CESSAO'));
DROP INDEX IF EXISTS asset_documents_document_uq;
CREATE UNIQUE INDEX IF NOT EXISTS asset_documents_doc_asset_uq ON asset_documents (document_id, fixed_asset_id) WHERE deleted_at IS NULL;
SELECT pg_get_constraintdef(oid) AS tipo_check FROM pg_constraint WHERE conname = 'asset_documents_tipo_check';