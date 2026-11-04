-- prisma/migrations-manuais/20261104_imoveis_matriculas.sql
-- 04/11/2026 - Arquivo Digital > Imoveis: tipos MATRICULA_IMOVEL e ESCRITURA_PUBLICA, vinculo documento x imovel
-- (asset_documents) com situacao registral, e itens de menu. Sem BEGIN no ADD VALUE do enum.
\set ON_ERROR_STOP on
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'MATRICULA_IMOVEL';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'ESCRITURA_PUBLICA';
CREATE TABLE IF NOT EXISTS asset_documents (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             uuid NOT NULL REFERENCES companies(id),
  fixed_asset_id         uuid NOT NULL REFERENCES fixed_assets(id),
  document_id            uuid NOT NULL REFERENCES documents(id),
  tipo                   varchar(20) NOT NULL CHECK (tipo IN ('MATRICULA', 'ESCRITURA')),
  numero_matricula       varchar(60),
  cartorio               varchar(120),
  data_certidao          date,
  ultimo_ato             text,
  proprietario_registral varchar(200),
  situacao               varchar(30) NOT NULL DEFAULT 'EMPRESA'
                         CHECK (situacao IN ('EMPRESA', 'SOCIO_PENDENTE_REGISTRO', 'GRUPO_TERCEIRO', 'SEM_MATRICULA')),
  observacao             text,
  created_by_id          uuid,
  created_at             timestamp(6) NOT NULL DEFAULT now(),
  updated_at             timestamp(6) NOT NULL DEFAULT now(),
  deleted_at             timestamp(6)
);
CREATE INDEX IF NOT EXISTS asset_documents_company_asset_idx ON asset_documents (company_id, fixed_asset_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS asset_documents_document_uq ON asset_documents (document_id) WHERE deleted_at IS NULL;
BEGIN;
UPDATE sidebar_items SET ordem = 7
 WHERE path = '/app/arquivo/templates' AND ordem = 6
   AND NOT EXISTS (SELECT 1 FROM sidebar_items WHERE path = '/app/arquivo/imoveis');
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, disabled, action_type)
SELECT '/app/arquivo/imoveis', U&'Im\00f3veis \00b7 Arquivo', l.module, 'FiHome', l.parent_id, 6, false, 'link'
  FROM sidebar_items l WHERE l.path = '/app/arquivo/locacao'
ON CONFLICT (path) DO NOTHING;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, disabled, action_type)
SELECT '/app/arquivo/imoveis/matriculas', U&'Matr\00edculas', p.module, 'FiFileText', p.id, 1, false, 'link'
  FROM sidebar_items p WHERE p.path = '/app/arquivo/imoveis'
ON CONFLICT (path) DO NOTHING;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, disabled, action_type)
SELECT '/app/arquivo/imoveis/escrituras', 'Escrituras', p.module, 'FiBookOpen', p.id, 2, false, 'link'
  FROM sidebar_items p WHERE p.path = '/app/arquivo/imoveis'
ON CONFLICT (path) DO NOTHING;
COMMIT;
SELECT s.path, s.ordem, p.path AS pai FROM sidebar_items s LEFT JOIN sidebar_items p ON p.id = s.parent_id
 WHERE s.path LIKE '/app/arquivo/imoveis%' OR s.path = '/app/arquivo/templates' ORDER BY s.path;
SELECT count(*) AS asset_documents FROM asset_documents;