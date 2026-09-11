-- prisma/migrations-manuais/2026-09-10-import-lotes.sql
-- Tabela de lotes de importacao (numero sequencial unico por empresa+ano,
-- precisa constar no Livro Diario e Razao).
CREATE TABLE import_lotes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id),
  ano                    INT NOT NULL,
  numero                 INT NOT NULL,
  nome_arquivo           VARCHAR(255),
  tipo                   VARCHAR(20) NOT NULL,
  quantidade_lancamentos INT NOT NULL DEFAULT 0,
  total_debito           DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credito          DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_by_id          UUID NOT NULL,
  created_at             TIMESTAMP(6) NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMP(6),
  CONSTRAINT import_lotes_company_ano_numero_key UNIQUE (company_id, ano, numero)
);
CREATE INDEX import_lotes_company_ano_idx ON import_lotes (company_id, ano);

ALTER TABLE journal_entries ADD COLUMN import_lote_id UUID REFERENCES import_lotes(id);
