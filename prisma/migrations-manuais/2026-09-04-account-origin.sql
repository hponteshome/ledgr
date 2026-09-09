-- prisma/migrations-manuais/2026-09-04-account-origin.sql
CREATE TYPE account_origin AS ENUM ('MATRIZ', 'ECD_NATIVE');
ALTER TABLE chart_of_accounts ADD COLUMN origin account_origin;
