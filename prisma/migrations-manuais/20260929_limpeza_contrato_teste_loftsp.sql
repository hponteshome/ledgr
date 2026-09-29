SET client_encoding = 'UTF8';
-- 29/09/2026 - Limpeza do contrato de TESTE do LoftSP (LM Administracao), criado em 24/07/2026.
-- Sem signatarios, sem ar_entries, sem lancamentos. Soft-delete apenas (nada apagado fisicamente).
DO $do$
DECLARE n int;
BEGIN
  UPDATE rental_contracts
     SET status = 'ENCERRADO', deleted_at = now()
   WHERE id = 'a2989653-e034-4df0-95b8-3b35ca6d033b'
     AND company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a'
     AND document_id = '67b3f6cf-b4fc-4214-9f9c-7d63f9d94f0b'
     AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Contrato: esperado 1 registro, afetado %', n; END IF;

  UPDATE documents
     SET status = 'CANCELADO'
   WHERE id = '67b3f6cf-b4fc-4214-9f9c-7d63f9d94f0b'
     AND status = 'RASCUNHO';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Documento: esperado 1 registro, afetado %', n; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'documents' AND column_name = 'deleted_at') THEN
    EXECUTE 'UPDATE documents SET deleted_at = now() WHERE id = ''67b3f6cf-b4fc-4214-9f9c-7d63f9d94f0b''';
  END IF;
END
$do$;
\echo '== Conferencia =='
SELECT id, status, deleted_at FROM rental_contracts WHERE id = 'a2989653-e034-4df0-95b8-3b35ca6d033b';
SELECT id, status FROM documents WHERE id = '67b3f6cf-b4fc-4214-9f9c-7d63f9d94f0b';
SELECT count(*) AS contratos_ativos_loftsp
  FROM rental_contracts rc JOIN fixed_assets fa ON fa.id = rc.fixed_asset_id
 WHERE rc.company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND fa.internal_code = 'LoftSP'
   AND rc.deleted_at IS NULL AND rc.status = 'ATIVO';