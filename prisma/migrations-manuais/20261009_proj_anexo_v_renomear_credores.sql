-- prisma/migrations-manuais/20261009_proj_anexo_v_renomear_credores.sql
-- Renomeia 3 credores do Anexo V a pedido do usuario (09/10/2026). O texto original da cl. 2.A.2 fica em credor_no_contrato.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE proj_anexo_v_itens ADD COLUMN IF NOT EXISTS credor_no_contrato varchar(160);
ALTER TABLE proj_anexo_v_itens DISABLE TRIGGER proj_anexo_v_itens_imutavel_trg;
UPDATE proj_anexo_v_itens SET credor_no_contrato = credor WHERE credor_no_contrato IS NULL;
UPDATE proj_anexo_v_itens SET credor = 'Ação Trabalhista - Josivani E. R.S. Alves' WHERE ordem = 2 AND credor_no_contrato = 'Ação Trabalhista Josi';
UPDATE proj_anexo_v_itens SET credor = 'Salários Pendentes J.E.R.S.A. 07/19 a 04/24' WHERE ordem = 8 AND credor_no_contrato = 'Tempo de Trabalho Josi 07/2019 à 04/24';
UPDATE proj_anexo_v_itens SET credor = 'MOU 2018 - Fundo San Francisco' WHERE ordem = 9 AND credor_no_contrato = 'Aportes 2018 - Avia Sports';
ALTER TABLE proj_anexo_v_itens ENABLE TRIGGER proj_anexo_v_itens_imutavel_trg;
DO $$ BEGIN
  IF (SELECT count(*) FROM proj_anexo_v_itens WHERE credor IS DISTINCT FROM credor_no_contrato) <> 3 THEN
    RAISE EXCEPTION 'Esperava exatamente 3 credores renomeados'; END IF;
END $$;
COMMIT;