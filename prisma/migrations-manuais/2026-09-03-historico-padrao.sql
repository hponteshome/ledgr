-- prisma/migrations-manuais/2026-09-03-historico-padrao.sql
-- Cria tabela de catalogo de Historico Padrao por empresa (SPED ECD registro
-- 0400) e a FK opcional em journal_entry_items.

CREATE TABLE historicos_padrao (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID NOT NULL REFERENCES companies(id),
    code         VARCHAR(20) NOT NULL,
    description  TEXT NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP(6)
);

CREATE UNIQUE INDEX historicos_padrao_company_id_code_key ON historicos_padrao (company_id, code);

ALTER TABLE journal_entry_items
    ADD COLUMN historico_padrao_id UUID REFERENCES historicos_padrao(id);
