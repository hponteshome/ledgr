SET client_encoding = 'UTF8';
-- 29/09/2026 - Fiador com conjuge (outorga condicional) e data do instrumento (sempre confirmada)
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS guarantor_has_spouse boolean NOT NULL DEFAULT false;
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS instrument_date date;
