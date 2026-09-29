SET client_encoding = 'UTF8';
-- 29/09/2026 - Genero gramatical do locatario e do fiador (flexao do contrato de locacao)
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_gender varchar(1);
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS guarantor_gender varchar(1);
DO $do$ BEGIN
  ALTER TABLE rental_contracts ADD CONSTRAINT rental_contracts_tenant_gender_chk CHECK (tenant_gender IN ('M','F'));
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN
  ALTER TABLE rental_contracts ADD CONSTRAINT rental_contracts_guarantor_gender_chk CHECK (guarantor_gender IN ('M','F'));
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
