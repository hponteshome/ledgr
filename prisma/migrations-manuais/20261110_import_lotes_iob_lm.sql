\pset pager off
\set ON_ERROR_STOP on
BEGIN;
WITH li AS (
  SELECT l.*, row_number() OVER (PARTITION BY extract(year FROM batch_date) ORDER BY batch_date, imported_at) AS rn
  FROM lote_imports l
  WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND deleted_at IS NULL AND source = 'IOB'
    AND NOT EXISTS (SELECT 1 FROM import_lotes x WHERE x.company_id = l.company_id AND x.nome_arquivo = l.file_name AND x.deleted_at IS NULL)
)
INSERT INTO import_lotes (company_id, ano, numero, nome_arquivo, tipo, created_by_id, created_at)
SELECT li.company_id, extract(year FROM li.batch_date)::int,
       coalesce((SELECT max(numero) FROM import_lotes x WHERE x.company_id = li.company_id AND x.ano = extract(year FROM li.batch_date)::int), 0) + li.rn,
       li.file_name, 'IOB', li.imported_by, li.imported_at
FROM li;
UPDATE journal_entries e SET import_lote_id = il.id
FROM import_lotes il
JOIN lote_imports li ON li.company_id = il.company_id AND li.file_name = il.nome_arquivo AND li.deleted_at IS NULL
WHERE il.company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND il.tipo = 'IOB' AND il.deleted_at IS NULL
  AND e.company_id = il.company_id AND e.import_lote_id IS NULL AND e.deleted_at IS NULL
  AND date_trunc('month', e.date) = date_trunc('month', li.batch_date)
  AND e.created_at BETWEEN li.imported_at - interval '10 minutes' AND li.imported_at + interval '1 minute';
UPDATE import_lotes il SET quantidade_lancamentos = s.qtd, total_debito = s.deb, total_credito = s.cre
FROM (SELECT e.import_lote_id, count(DISTINCT e.id) AS qtd,
             sum(CASE WHEN i.type::text = 'DEBIT'  THEN i.value ELSE 0 END) AS deb,
             sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE 0 END) AS cre
      FROM journal_entries e JOIN journal_entry_items i ON i.journal_entry_id = e.id
      WHERE e.company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND e.import_lote_id IS NOT NULL
      GROUP BY e.import_lote_id) s
WHERE il.id = s.import_lote_id AND il.tipo = 'IOB';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM import_lotes il
             JOIN lote_imports li ON li.company_id = il.company_id AND li.file_name = il.nome_arquivo AND li.deleted_at IS NULL
             WHERE il.company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND il.tipo = 'IOB'
               AND il.quantidade_lancamentos <> (li.stats->>'imported')::int) THEN
    RAISE EXCEPTION 'Contagem de lancamentos difere da importacao original - nada gravado';
  END IF;
END $$;
COMMIT;
SELECT il.ano, il.numero, il.nome_arquivo, il.quantidade_lancamentos AS lctos, il.total_debito, il.total_credito
FROM import_lotes il WHERE il.company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' ORDER BY il.ano, il.numero;
SELECT count(*) AS lctos_lm, count(import_lote_id) AS com_lote FROM journal_entries
WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND deleted_at IS NULL;