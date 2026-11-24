-- REAJ-01 (24/11/2026) - historico de reajustes do aluguel (aplicado ou dispensado). O contrato guarda o valor vigente
-- e as datas de reajuste (last/next_readjustment_date); cada registro guarda as datas anteriores para desfazer.
CREATE TABLE IF NOT EXISTS rental_contract_readjustments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES companies(id),
  rental_contract_id uuid NOT NULL REFERENCES rental_contracts(id),
  data_base          date NOT NULL,
  tipo               varchar(12) NOT NULL,
  indice             varchar(20),
  percentual         numeric(9,6),
  valor_anterior     numeric(15,2) NOT NULL,
  valor_novo         numeric(15,2) NOT NULL,
  competencia_inicio varchar(7),
  motivo             text,
  document_id        uuid REFERENCES documents(id),
  ultimo_anterior    date,
  proximo_anterior   date,
  created_by_id      uuid NOT NULL,
  created_at         timestamp(6) NOT NULL DEFAULT now(),
  deleted_at         timestamp(6)
);
CREATE INDEX IF NOT EXISTS rental_contract_readjustments_contrato_idx ON rental_contract_readjustments (rental_contract_id);
