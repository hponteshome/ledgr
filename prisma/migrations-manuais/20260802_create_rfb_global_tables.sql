CREATE TABLE IF NOT EXISTS rfb_global_tables (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sistema       VARCHAR(20)  NOT NULL,
    tabela        VARCHAR(60)  NOT NULL,
    versao_arq    INTEGER      NOT NULL,
    codigo        VARCHAR(20)  NOT NULL,
    nome          VARCHAR(200) NOT NULL,
    data_inicio   DATE,
    data_fim      DATE,
    extra         JSONB,
    source_file   VARCHAR(200),
    created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rfb_global_tables_sistema_tabela_codigo_data_inicio_key
        UNIQUE (sistema, tabela, codigo, data_inicio)
);

CREATE INDEX IF NOT EXISTS rfb_global_tables_sistema_tabela_idx
    ON rfb_global_tables (sistema, tabela);
