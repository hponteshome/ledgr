-- B-NFSE-LOC-1 - 20261106_nfse_locacao.sql
ALTER TABLE nfse_nacional_emissoes
  ADD COLUMN IF NOT EXISTS tipo_operacao      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS rental_contract_id UUID,
  ADD COLUMN IF NOT EXISTS ar_entry_id        UUID,
  ADD COLUMN IF NOT EXISTS id_dps             VARCHAR(50),
  ADD COLUMN IF NOT EXISTS d_compet           DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento     DATE,
  ADD COLUMN IF NOT EXISTS v_tot_oper         DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS v_ajuste_bc_loc    DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS v_pis              DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS v_cofins           DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS cst_ibs_cbs        VARCHAR(3),
  ADD COLUMN IF NOT EXISTS c_class_trib       VARCHAR(6),
  ADD COLUMN IF NOT EXISTS cert_thumbprint    VARCHAR(64),
  ADD COLUMN IF NOT EXISTS dados_operacao     JSONB;
CREATE INDEX IF NOT EXISTS nfse_nacional_emissoes_rental_contract_id_idx ON nfse_nacional_emissoes (rental_contract_id);
SELECT column_name FROM information_schema.columns WHERE table_name = 'nfse_nacional_emissoes' AND column_name IN
 ('tipo_operacao','rental_contract_id','id_dps','dados_operacao') ORDER BY 1;