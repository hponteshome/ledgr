-- prisma/migrations-manuais/2026-08-24-partial-unique-chart-of-accounts.sql
-- Corrige incompatibilidade entre soft-delete e UNIQUE(company_id, code):
-- uma vez soft-deletada, a conta bloqueava permanentemente aquele codigo,
-- impedindo recriar. Achado real: 9 de 27 contas do bloco Hotelaria da
-- Sunsys (empresa de teste) nao conseguiam ser recriadas apos limpeza de
-- dado corrompido, falhando silenciosamente (erro nao exibido na tela).

BEGIN;

DROP INDEX IF EXISTS chart_of_accounts_company_id_code_key;

CREATE UNIQUE INDEX chart_of_accounts_company_id_code_active_key
  ON chart_of_accounts (company_id, code)
  WHERE deleted_at IS NULL;

-- confere que o indice novo existe e o antigo sumiu
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'chart_of_accounts' AND indexname LIKE '%code%';

COMMIT;
