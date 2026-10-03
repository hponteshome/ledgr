-- prisma/migrations-manuais/20261003_2fa_colunas.sql
-- Fase 0A.6 - autenticacao em dois fatores: colunas de suporte
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_recovery_codes text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled_at timestamp(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_trust_version integer NOT NULL DEFAULT 0;
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_name = 'users' AND column_name LIKE 'two_factor%' ORDER BY column_name;