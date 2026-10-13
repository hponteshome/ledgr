-- prisma/migrations-manuais/20261013_f5_historico_aquisicao.sql
-- F5 PARTICIPACOES S/A: preenche o historico do lancamento de aquisicao da Sunrise (09/07/2025, R$ 1,00), que estava como modelo
-- ("[Nome da Investida]", "[Data de Outubro/2025]"). Data e valores mantidos (decisao Hpontes 13/10/2026). Guarda: exatamente 1 lancamento.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE alvo ON COMMIT DROP AS
SELECT je.id, je.description AS historico_antigo
FROM journal_entries je JOIN companies c ON c.id = je.company_id
WHERE c.legal_name ILIKE 'F5 PARTICIPA%' AND je.deleted_at IS NULL AND je.date::date = '2025-07-09'
  AND je.description ILIKE '%[Nome da Investida]%';
DO $$ BEGIN
  IF (SELECT count(*) FROM alvo) <> 1 THEN
    RAISE EXCEPTION 'Esperado 1 lancamento de aquisicao, encontrado % - nada alterado', (SELECT count(*) FROM alvo);
  END IF;
END $$;
\echo === ANTES ===
SELECT id, historico_antigo FROM alvo;
SELECT a.code, i.type, i.value, i.description AS historico_partida FROM journal_entry_items i JOIN chart_of_accounts a ON a.id = i.account_id WHERE i.journal_entry_id = (SELECT id FROM alvo) ORDER BY i.type DESC;
UPDATE journal_entry_items SET description = U&'Aquisi\00E7\00E3o de 100% das quotas representativas do capital social da SUNRISE HOTELS & RESORTS HOLDING LTDA. (CNPJ 16.846.468/0001-31), pelo valor simb\00F3lico de R$ 1,00 (um real), com efeitos a partir de 09/07/2025, marco reconhecido pela Senten\00E7a Arbitral de 27/10/2025 (proc. 0026/2025 da 1\00AA C\00E2mara de Concilia\00E7\00E3o e Arbitragem de Pernambuco), conforme instrumento de compra e venda de participa\00E7\00E3o societ\00E1ria.'
 WHERE journal_entry_id = (SELECT id FROM alvo) AND description ILIKE '%[Nome da Investida]%';
UPDATE journal_entries SET description = U&'Aquisi\00E7\00E3o de 100% das quotas representativas do capital social da SUNRISE HOTELS & RESORTS HOLDING LTDA. (CNPJ 16.846.468/0001-31), pelo valor simb\00F3lico de R$ 1,00 (um real), com efeitos a partir de 09/07/2025, marco reconhecido pela Senten\00E7a Arbitral de 27/10/2025 (proc. 0026/2025 da 1\00AA C\00E2mara de Concilia\00E7\00E3o e Arbitragem de Pernambuco), conforme instrumento de compra e venda de participa\00E7\00E3o societ\00E1ria.', updated_at = now()
 WHERE id = (SELECT id FROM alvo);
\echo === DEPOIS ===
SELECT je.date, je.description FROM journal_entries je WHERE je.id = (SELECT id FROM alvo);
COMMIT;