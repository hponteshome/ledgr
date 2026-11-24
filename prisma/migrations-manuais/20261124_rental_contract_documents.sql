-- ARQ-LOC-01 (24/11/2026) - documentos ligados ao contrato de locacao (aditivos, termos, vistoria, notificacoes,
-- garantia, documentos do locatario, recibos). O contrato assinado continua em rental_contracts.signed_document_id
-- (lastro). Soft-delete por deleted_at; o mesmo documento nao se liga duas vezes ao mesmo contrato.
CREATE TABLE IF NOT EXISTS rental_contract_documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES companies(id),
  rental_contract_id uuid NOT NULL REFERENCES rental_contracts(id),
  document_id        uuid NOT NULL REFERENCES documents(id),
  papel              varchar(30) NOT NULL,
  data_documento     date,
  observacao         text,
  created_by_id      uuid NOT NULL,
  created_at         timestamp(6) NOT NULL DEFAULT now(),
  deleted_at         timestamp(6)
);
CREATE UNIQUE INDEX IF NOT EXISTS rental_contract_documents_ativo_uq ON rental_contract_documents (rental_contract_id, document_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS rental_contract_documents_contrato_idx ON rental_contract_documents (rental_contract_id);
CREATE INDEX IF NOT EXISTS rental_contract_documents_documento_idx ON rental_contract_documents (document_id);
