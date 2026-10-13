-- prisma/migrations-manuais/20261013_cambio_cotacoes.sql
-- Cotacoes de cambio (PTAX do Banco Central), imutaveis, com data e hora da consulta e SHA-256 da resposta (13/10/2026).
-- Vale a primeira cotacao gravada de cada data de referencia. ledgr_api so le e inclui.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS cambio_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moeda varchar(3) NOT NULL,
  data_referencia date NOT NULL,
  data_cotacao date NOT NULL,
  data_hora_boletim timestamp NOT NULL,
  tipo_boletim varchar(20) NOT NULL,
  taxa_compra numeric(18,6) NOT NULL,
  taxa_venda numeric(18,6) NOT NULL,
  fonte varchar(30) NOT NULL,
  url text NOT NULL,
  resposta_sha256 char(64) NOT NULL,
  resposta jsonb NOT NULL,
  consultado_em timestamptz NOT NULL DEFAULT now(),
  consultado_por_id uuid NULL REFERENCES users(id),
  CONSTRAINT cambio_cotacoes_ck CHECK (taxa_compra > 0 AND taxa_venda > 0 AND data_cotacao <= data_referencia)
);
CREATE INDEX IF NOT EXISTS cambio_cotacoes_ref_idx ON cambio_cotacoes (moeda, fonte, data_referencia, consultado_em);
CREATE OR REPLACE FUNCTION cambio_cotacoes_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Cotacao de cambio e imutavel (%).', TG_OP; END $$;
DROP TRIGGER IF EXISTS cambio_cotacoes_imutavel_trg ON cambio_cotacoes;
CREATE TRIGGER cambio_cotacoes_imutavel_trg BEFORE UPDATE OR DELETE ON cambio_cotacoes FOR EACH ROW EXECUTE FUNCTION cambio_cotacoes_imutavel();
DROP TRIGGER IF EXISTS cambio_cotacoes_truncate_trg ON cambio_cotacoes;
CREATE TRIGGER cambio_cotacoes_truncate_trg BEFORE TRUNCATE ON cambio_cotacoes FOR EACH STATEMENT EXECUTE FUNCTION cambio_cotacoes_imutavel();
GRANT SELECT, INSERT ON cambio_cotacoes TO ledgr_api;
COMMIT;