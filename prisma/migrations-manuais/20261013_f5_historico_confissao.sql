-- prisma/migrations-manuais/20261013_f5_historico_confissao.sql
-- F5 PARTICIPACOES S/A: corrige o historico do lancamento da confissao de divida (31/10/2025).
-- Decisao Hpontes 13/10/2026: nao e AFAC; data (31/10/2025) e valor (R$ 54.418.451,00) confirmados.
-- So o texto muda (cabecalho e partidas com o texto antigo). Nada e excluido. Guarda: exatamente 1 lancamento.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE alvo ON COMMIT DROP AS
SELECT je.id, je.description AS historico_antigo
FROM journal_entries je JOIN companies c ON c.id = je.company_id
WHERE c.legal_name ILIKE 'F5 PARTICIPA%' AND je.deleted_at IS NULL AND je.date::date = '2025-10-31'
  AND je.description ILIKE '%Adiantamento para Futuro%'
  AND EXISTS (SELECT 1 FROM journal_entry_items i JOIN chart_of_accounts a ON a.id = i.account_id
              WHERE i.journal_entry_id = je.id AND a.code = '12101010006');
DO $$ BEGIN
  IF (SELECT count(*) FROM alvo) <> 1 THEN
    RAISE EXCEPTION 'Esperado 1 lancamento da confissao, encontrado % - nada alterado', (SELECT count(*) FROM alvo);
  END IF;
END $$;
\echo === ANTES ===
SELECT id, historico_antigo FROM alvo;
SELECT a.code, i.type, i.value, i.description AS historico_partida FROM journal_entry_items i JOIN chart_of_accounts a ON a.id = i.account_id WHERE i.journal_entry_id = (SELECT id FROM alvo) ORDER BY i.type DESC;
UPDATE journal_entry_items SET description = U&'Confiss\00E3o de d\00EDvida da Real Mouch\00E3o em favor da F5, contrato de 31/10/2025, \20AC 8.748.947,11 ao c\00E2mbio de 6,22 - pagamento do Anexo V por conta da RM'
 WHERE journal_entry_id = (SELECT id FROM alvo) AND description ILIKE '%Adiantamento para Futuro%';
UPDATE journal_entries SET description = U&'Confiss\00E3o de d\00EDvida da Real Mouch\00E3o em favor da F5, contrato de 31/10/2025, \20AC 8.748.947,11 ao c\00E2mbio de 6,22 - pagamento do Anexo V por conta da RM', updated_at = now()
 WHERE id = (SELECT id FROM alvo);
\echo === DEPOIS ===
SELECT je.date, je.description FROM journal_entries je WHERE je.id = (SELECT id FROM alvo);
SELECT a.code, i.type, i.value, i.description AS historico_partida FROM journal_entry_items i JOIN chart_of_accounts a ON a.id = i.account_id WHERE i.journal_entry_id = (SELECT id FROM alvo) ORDER BY i.type DESC;
COMMIT;