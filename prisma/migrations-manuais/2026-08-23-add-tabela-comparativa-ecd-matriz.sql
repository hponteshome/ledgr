-- prisma/migrations-manuais/2026-08-23-add-tabela-comparativa-ecd-matriz.sql
-- Base de dado da Tabela Comparativa ECD x Matriz (conceito 22/08/2026)

CREATE TABLE chart_of_accounts_ecd_imports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES chart_of_accounts(id),
  ecd_import_id UUID NOT NULL REFERENCES ecd_imports(id),
  created_at    TIMESTAMP(6) NOT NULL DEFAULT now(),
  UNIQUE (account_id, ecd_import_id)
);
CREATE INDEX idx_coa_ecd_imports_import ON chart_of_accounts_ecd_imports (ecd_import_id);

CREATE TYPE "EcdMappingMatchType" AS ENUM ('MANUAL', 'SUGGESTED_CONFIRMED');

CREATE TABLE ecd_account_mappings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  source_account_id UUID NOT NULL UNIQUE REFERENCES chart_of_accounts(id),
  target_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  match_type        "EcdMappingMatchType" NOT NULL DEFAULT 'MANUAL',
  notes             TEXT,
  created_by_id     UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP(6) NOT NULL DEFAULT now()
);
CREATE INDEX idx_ecd_account_mappings_target ON ecd_account_mappings (company_id, target_account_id);

-- Confere criacao
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('chart_of_accounts_ecd_imports', 'ecd_account_mappings');
