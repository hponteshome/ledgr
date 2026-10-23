-- prisma/migrations-manuais/20261023_rental_contract_reajuste_datas.sql
-- 23/10/2026 - Locacao: datas de reajuste no contrato (alertas de reajuste)
--   next_readjustment_date: proximo reajuste quando difere do aniversario do inicio (ex.: contrato renovado)
--   last_readjustment_date: data-base do ultimo reajuste APLICADO (null = nenhum registrado)
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS next_readjustment_date date;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS last_readjustment_date date;
-- LM: datas informadas pela Galvao Locacoes (extrato de repasse set/2026)
UPDATE rental_contracts SET next_readjustment_date = DATE '2026-11-01'
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND contract_number = '40148.002' AND next_readjustment_date IS NULL;
UPDATE rental_contracts SET next_readjustment_date = DATE '2027-02-01'
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND contract_number = '40148.001' AND next_readjustment_date IS NULL;
SELECT contract_number, next_readjustment_date, last_readjustment_date FROM rental_contracts
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND next_readjustment_date IS NOT NULL;
