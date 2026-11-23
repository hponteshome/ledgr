-- prisma/migrations-manuais/2026-11-23-codpuro-02-check-codigo-puro.sql
-- CODPURO-02 (23/11/2026) - Regra: codigo de conta contabil sempre puro; mascara so na exibicao.
-- O banco recusa codigo com separador de mascara (ponto, hifen, barra ou espaco).
-- Gerenciado fora do Prisma (como o indice unico parcial de chart_of_accounts).
BEGIN;
ALTER TABLE chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_code_puro_chk;
ALTER TABLE chart_of_accounts ADD CONSTRAINT chart_of_accounts_code_puro_chk CHECK (code !~ '[./[:space:]-]');
COMMIT;