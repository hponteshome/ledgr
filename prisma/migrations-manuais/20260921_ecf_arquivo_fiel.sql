-- 21/09/2026 - ARQUIVO FIEL DA ECF (analise do LALUR independente do Contabil)
-- ADITIVA: 3 tabelas novas. Nenhuma tabela existente e alterada.
-- Unica ligacao: ecf_arquivos.company_id -> companies(id).
-- Regra: 1 versao VIGENTE por empresa e periodo (retificadora vence a original);
-- versoes descartadas ficam so como metadado (versoes_descartadas), sem linhas.
-- Rollback: DROP TABLE ecf_arq_registros, ecf_arq_periodos, ecf_arquivos;
BEGIN;

CREATE TABLE ecf_arquivos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES companies(id),
  file_name            varchar NOT NULL,
  file_size            integer,
  sha256               varchar(64) NOT NULL,
  cod_ver              varchar(10),
  cnpj                 varchar(14),
  nome                 varchar,
  dt_ini               date NOT NULL,
  dt_fin               date NOT NULL,
  retificadora         varchar(1) NOT NULL DEFAULT 'N',
  num_rec              varchar(60),
  hash_anterior        varchar(60),
  qualidade            integer NOT NULL DEFAULT 0,
  versoes_descartadas  jsonb,
  stats                jsonb,
  loaded_by            uuid,
  loaded_at            timestamp(6) NOT NULL DEFAULT now(),
  UNIQUE (company_id, dt_ini, dt_fin)
);

CREATE TABLE ecf_arq_periodos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id  uuid NOT NULL REFERENCES ecf_arquivos(id) ON DELETE CASCADE,
  bloco       varchar(1) NOT NULL,
  reg         varchar(4) NOT NULL,
  per         varchar(8) NOT NULL,
  dt_ini      date NOT NULL,
  dt_fin      date NOT NULL,
  ordem       integer NOT NULL
);
CREATE INDEX ecf_arq_per_idx ON ecf_arq_periodos (arquivo_id, bloco, per);

CREATE TABLE ecf_arq_registros (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id  uuid NOT NULL REFERENCES ecf_arquivos(id) ON DELETE CASCADE,
  ordem       integer NOT NULL,
  bloco       varchar(1) NOT NULL,
  reg         varchar(4) NOT NULL,
  per         varchar(8),
  campos      text[] NOT NULL
);
CREATE INDEX ecf_arq_reg_idx ON ecf_arq_registros (arquivo_id, reg, per);
CREATE INDEX ecf_arq_reg_ord_idx ON ecf_arq_registros (arquivo_id, ordem);

COMMIT;