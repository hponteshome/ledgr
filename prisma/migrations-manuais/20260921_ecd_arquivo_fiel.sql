-- =============================================================================
-- 21/09/2026 - ARQUIVO FIEL DA ECD (consulta independente do Contabil)
-- ADITIVA: cria 6 tabelas novas. Nenhuma tabela existente e alterada.
-- Unica ligacao com o resto do sistema: ecd_arquivos.company_id -> companies(id).
-- Rollback: DROP TABLE ecd_arq_partidas, ecd_arq_lancamentos, ecd_arq_saldos,
--           ecd_arq_contas, ecd_arq_historicos, ecd_arquivos;
-- =============================================================================
BEGIN;

CREATE TABLE ecd_arquivos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id),
  file_name         varchar NOT NULL,
  file_size         integer,
  cnpj              varchar(14),
  nome_empresarial  varchar,
  dt_ini            date NOT NULL,
  dt_fin            date NOT NULL,
  cod_ver_lc        varchar(10),
  ind_esc           varchar(1),
  ind_fin_esc       varchar(1),
  cod_hash_sub      varchar(64),
  stats             jsonb,
  loaded_by         uuid,
  loaded_at         timestamp(6) NOT NULL DEFAULT now(),
  UNIQUE (company_id, dt_ini, dt_fin)
);

CREATE TABLE ecd_arq_contas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id   uuid NOT NULL REFERENCES ecd_arquivos(id) ON DELETE CASCADE,
  bloco        varchar(1) NOT NULL DEFAULT 'I',
  cod_cta      varchar(255) NOT NULL,
  cod_cta_sup  varchar(255),
  nome         varchar NOT NULL,
  cod_nat      varchar(2),
  ind_cta      varchar(1),
  nivel        integer,
  dt_alt       date,
  cod_cta_ref  varchar(60),
  UNIQUE (arquivo_id, bloco, cod_cta)
);

CREATE TABLE ecd_arq_saldos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id   uuid NOT NULL REFERENCES ecd_arquivos(id) ON DELETE CASCADE,
  bloco        varchar(1) NOT NULL DEFAULT 'I',
  dt_ini       date NOT NULL,
  dt_fin       date NOT NULL,
  cod_cta      varchar(255) NOT NULL,
  cod_ccus     varchar(255),
  vl_sld_ini   numeric(18,2) NOT NULL,
  ind_dc_ini   varchar(1) NOT NULL,
  vl_deb       numeric(18,2) NOT NULL,
  vl_cred      numeric(18,2) NOT NULL,
  vl_sld_fin   numeric(18,2) NOT NULL,
  ind_dc_fin   varchar(1) NOT NULL
);
CREATE INDEX ecd_arq_saldos_idx ON ecd_arq_saldos (arquivo_id, bloco, cod_cta, dt_ini);

CREATE TABLE ecd_arq_lancamentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id   uuid NOT NULL REFERENCES ecd_arquivos(id) ON DELETE CASCADE,
  seq          integer NOT NULL,
  num_lcto     varchar(255) NOT NULL,
  dt_lcto      date NOT NULL,
  vl_lcto      numeric(18,2),
  ind_lcto     varchar(1),
  dt_lcto_ext  date
);
CREATE INDEX ecd_arq_lanc_data_idx ON ecd_arq_lancamentos (arquivo_id, dt_lcto, seq);
CREATE INDEX ecd_arq_lanc_num_idx  ON ecd_arq_lancamentos (arquivo_id, num_lcto);

CREATE TABLE ecd_arq_partidas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id     uuid NOT NULL REFERENCES ecd_arquivos(id) ON DELETE CASCADE,
  lancamento_id  uuid NOT NULL REFERENCES ecd_arq_lancamentos(id) ON DELETE CASCADE,
  seq            integer NOT NULL,
  cod_cta        varchar(255) NOT NULL,
  cod_ccus       varchar(255),
  vl_dc          numeric(18,2) NOT NULL,
  ind_dc         varchar(1) NOT NULL,
  num_arq        varchar(255),
  cod_hist_pad   varchar(255),
  hist           text,
  cod_part       varchar(255)
);
CREATE INDEX ecd_arq_part_cta_idx  ON ecd_arq_partidas (arquivo_id, cod_cta);
CREATE INDEX ecd_arq_part_lanc_idx ON ecd_arq_partidas (lancamento_id);

CREATE TABLE ecd_arq_historicos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id  uuid NOT NULL REFERENCES ecd_arquivos(id) ON DELETE CASCADE,
  cod_hist    varchar(255) NOT NULL,
  descr_hist  text,
  UNIQUE (arquivo_id, cod_hist)
);

COMMIT;