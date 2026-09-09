-- prisma/migrations-manuais/2026-09-09-limpa-reduced-code-placeholder.sql
-- Remove o placeholder "000000" (sem significado real) do reduced_code de
-- contas SINTETICAS da Hotelsys - esse campo so deveria existir em contas
-- analiticas. Matriz global ja estava limpo (0 ocorrencias, confirmado).
UPDATE chart_of_accounts
SET reduced_code = NULL
WHERE reduced_code = '000000' AND is_analytic = false
  AND company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND deleted_at IS NULL;
