SET client_encoding = 'UTF8';
-- 29/09/2026 - Disposicoes especificas por contrato de locacao (fora do template)
ALTER TABLE rental_contracts ADD COLUMN IF NOT EXISTS specific_clauses text;
