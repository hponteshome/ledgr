-- 20261111_tax_darfs.sql - DARFs gerados pelo LEDGR (controle de emissao e pagamento)
BEGIN;
CREATE TABLE IF NOT EXISTS tax_darfs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES companies(id),
  lote_id                 uuid NOT NULL,
  origem                  varchar(20) NOT NULL DEFAULT 'MANUAL', -- ESTUDO_REGIME | APURACAO | MANUAL
  origem_id               uuid,
  codigo                  varchar(6) NOT NULL,
  descricao               varchar(200),
  periodo_apuracao        date NOT NULL,
  vencimento              date NOT NULL,
  numero_referencia       varchar(30),
  data_pagamento_prevista date NOT NULL,
  principal               numeric(15,2) NOT NULL,
  multa_modo              varchar(10) NOT NULL DEFAULT 'SICALC', -- SICALC | DENUNCIA | SEM
  multa_pct               numeric(7,2) NOT NULL DEFAULT 0,
  multa                   numeric(15,2) NOT NULL DEFAULT 0,
  selic_pct               numeric(9,2) NOT NULL DEFAULT 0,
  juros                   numeric(15,2) NOT NULL DEFAULT 0,
  total                   numeric(15,2) NOT NULL,
  status                  varchar(10) NOT NULL DEFAULT 'GERADO', -- GERADO | PAGO | CANCELADO
  pago_em                 date,
  valor_pago              numeric(15,2),
  numero_documento        varchar(40),
  created_by_id           uuid,
  autor_nome              varchar(150),
  created_at              timestamp(6) NOT NULL DEFAULT now(),
  updated_at              timestamp(6) NOT NULL DEFAULT now(),
  deleted_at              timestamp(6)
);
CREATE INDEX IF NOT EXISTS tax_darfs_company_pa_idx ON tax_darfs (company_id, periodo_apuracao);
CREATE INDEX IF NOT EXISTS tax_darfs_lote_idx ON tax_darfs (lote_id);
COMMIT;
