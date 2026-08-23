-- prisma/migrations-manuais/2026-08-23-add-is-closing-entry.sql
ALTER TABLE journal_entries
  ADD COLUMN is_closing_entry BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mesmo criterio textual que esta sendo substituido, aplicado uma
-- unica vez a todo o historico existente (todas as empresas, nao so GRB/Hotelsys)
UPDATE journal_entries
SET is_closing_entry = true
WHERE (description ILIKE '%encerr%' OR description ILIKE '%zeramento%')
  AND deleted_at IS NULL;

-- Confere quantos foram marcados, por empresa
SELECT c.name, count(*) AS qtd_lancamentos_encerramento
FROM journal_entries je
JOIN companies c ON c.id = je.company_id
WHERE je.is_closing_entry = true
GROUP BY c.name
ORDER BY c.name;
