-- 2026-11-18_js_prolabore_ago2026_preparo.sql
-- JS-AGO-01: Jose Silva Sociedade Individual de Advocacia (sem empregados; so receita financeira).
-- 1) apaga o calculo de pro-labore gerado no LEDGR e nunca transmitido (nenhum evento eSocial da empresa no LEDGR);
-- 2) desliga "Tem Folha" (marcacao indevida; travava o fechamento S-1299 de 08/2026).
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE n int; j text;
BEGIN
  SELECT count(*) INTO n FROM pro_labore_calculos WHERE company_id = 'ca9ba513-06ae-4579-b546-ebc457f33452';
  IF n <> 1 THEN RAISE EXCEPTION 'esperado 1 calculo de pro-labore da Jose Silva, ha %', n; END IF;
  SELECT to_jsonb(x)::text INTO j FROM pro_labore_calculos x WHERE company_id = 'ca9ba513-06ae-4579-b546-ebc457f33452';
  IF EXISTS (SELECT 1 FROM pro_labore_calculos x, jsonb_each(to_jsonb(x)) e(k, v)
              WHERE x.company_id = 'ca9ba513-06ae-4579-b546-ebc457f33452'
                AND k ~* 'recib|receipt|protocol|transmit|esocial_id|nr_rec' AND v <> 'null'::jsonb AND v <> '""'::jsonb AND v <> 'false'::jsonb) THEN
    RAISE EXCEPTION 'calculo tem marca de transmissao - abortado: %', j;
  END IF;
  RAISE NOTICE 'calculo apagado: %', left(j, 400);
  DELETE FROM pro_labore_calculos WHERE company_id = 'ca9ba513-06ae-4579-b546-ebc457f33452';

  UPDATE companies SET tem_folha = false, updated_at = now() WHERE id = 'ca9ba513-06ae-4579-b546-ebc457f33452' AND tem_folha = true;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'tem_folha: % linhas', n; END IF;
END $$;
COMMIT;
\echo == conferencia ==
SELECT legal_name, tax_regime, tem_folha, tem_pro_labore FROM companies WHERE id = 'ca9ba513-06ae-4579-b546-ebc457f33452';
SELECT count(*) AS calculos FROM pro_labore_calculos WHERE company_id = 'ca9ba513-06ae-4579-b546-ebc457f33452';