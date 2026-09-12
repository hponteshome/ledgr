-- prisma/migrations-manuais/2026-09-11-sped-plano-referencial.sql
CREATE TABLE sped_plano_referencial (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela     VARCHAR(20) NOT NULL,
  ano_base   INT NOT NULL,
  versao     INT NOT NULL,
  codigo     VARCHAR(30) NOT NULL,
  descricao  TEXT NOT NULL,
  dt_ini     DATE,
  dt_fim     DATE,
  ordem      INT,
  tipo       VARCHAR(1),
  cod_sup    VARCHAR(30),
  nivel      INT,
  natureza   VARCHAR(2),
  created_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT sped_plano_referencial_tabela_ano_versao_codigo_key UNIQUE (tabela, ano_base, versao, codigo)
);
CREATE INDEX sped_plano_referencial_tabela_ano_idx ON sped_plano_referencial (tabela, ano_base);
