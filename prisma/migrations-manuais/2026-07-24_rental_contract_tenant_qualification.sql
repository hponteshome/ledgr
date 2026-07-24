ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_rg VARCHAR(20);
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_profession VARCHAR(100);
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_marital_status marital_status;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_nationality VARCHAR DEFAULT 'Brasileira';
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_street VARCHAR;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_number VARCHAR(20);
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_complement VARCHAR;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_neighborhood VARCHAR;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_city VARCHAR;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_state VARCHAR(2);
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS tenant_zip_code VARCHAR(9);

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CONTRATO_LOCACAO';