-- prisma/migrations-manuais/20261011_signature_method_clicksign.sql
-- Arquivo: assinatura pela ClickSign ganha metodo proprio (antes era gravada como CERT_A1).
DO $$
DECLARE t text;
BEGIN
  SELECT format('%I', typname) INTO t FROM pg_type WHERE typname IN ('SignatureMethod', 'signature_method') LIMIT 1;
  IF t IS NULL THEN RAISE EXCEPTION 'Tipo SignatureMethod nao encontrado'; END IF;
  EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L', t, 'CLICKSIGN');
END $$;
SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname IN ('SignatureMethod', 'signature_method') GROUP BY t.typname;
