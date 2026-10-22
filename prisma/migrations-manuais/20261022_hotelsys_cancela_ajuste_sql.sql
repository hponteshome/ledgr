-- prisma/migrations-manuais/20261022_hotelsys_cancela_ajuste_sql.sql
-- 22/10/2026 - Hotelsys: o ajuste do passivo ao Anexo V foi lancado duas vezes - pelo script 20261021_hotelsys_ajuste_passivo_anexo_v.sql
-- (lancamento MANUAL-2024, sem lote) e pelo lote do Importar Manual (35 partidas simples). Vale o lote. Este script exclui (soft delete,
-- deleted_at) o lancamento do script e confere os saldos de 31/10/2025 com a relacao de credores (R$ 67.258.658,64).
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; n int; r record;
BEGIN
  SELECT count(*) INTO n FROM journal_entries
   WHERE company_id = emp AND deleted_at IS NULL AND import_lote_id IS NULL AND date::date = DATE '2024-12-31'
     AND description LIKE 'Ajuste do passivo da Hotelsys % rela%o de credores do Anexo V (R$ 67.258.658,64 em 31/10/2025)';
  IF n = 0 THEN RAISE NOTICE 'Lancamento do script ja excluido - nada a fazer'; RETURN; END IF;
  IF n > 1 THEN RAISE EXCEPTION 'Encontrados % lancamentos do script - nada alterado; me mande a saida', n; END IF;
  SELECT id, reference INTO r FROM journal_entries
   WHERE company_id = emp AND deleted_at IS NULL AND import_lote_id IS NULL AND date::date = DATE '2024-12-31'
     AND description LIKE 'Ajuste do passivo da Hotelsys % rela%o de credores do Anexo V (R$ 67.258.658,64 em 31/10/2025)';
  UPDATE journal_entries SET deleted_at = now(), updated_at = now() WHERE id = r.id;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
    VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52', 'CONTABIL_LANCAMENTO_EXCLUIDO', r.id::text,
            jsonb_build_object('ref', r.reference, 'empresa', 'HOTELSYS', 'motivo', 'Duplicidade: o mesmo ajuste foi importado pelo lote do Importar Manual'), now());
  RAISE NOTICE 'Excluido (soft delete): %', r.reference;
END $$;
-- conferencia em 31/10/2025 (saldo credor)
WITH s AS (
  SELECT a.code, a.name, sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END) AS saldo
  FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
  WHERE j.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND j.deleted_at IS NULL AND j.date::date <= DATE '2025-10-31' AND left(a.code, 2) IN ('21', '22')
  GROUP BY a.code, a.name HAVING abs(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END)) >= 0.01)
SELECT code, name, to_char(saldo, 'FM999G999G990D00') AS saldo_31_10_2025 FROM s
UNION ALL SELECT 'TOTAL', 'Passivo (esperado 69.976.959,07 = relacao 67.258.658,64 + mutuo Sunsys 2.718.300,43)', to_char(sum(saldo), 'FM999G999G990D00') FROM s
ORDER BY 1;
COMMIT;
