-- prisma/migrations-manuais/20261022_mep_custo_sunsys.sql
-- 22/10/2026 - Participacao Hotelsys -> Sunsys (equity_method_investments): custo inicial 92.750.000,00 -> 62.750.000,00
-- (integralizacao em imoveis de 30/07/2018, 62.750.000 quotas). Reexecutar nao altera nada.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE n int;
BEGIN
  UPDATE equity_method_investments SET initial_cost = 62750000.00, updated_at = now()
   WHERE investor_company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND investee_company_id = '6a13e876-7056-4076-a403-9610f7dc37b1'
     AND deleted_at IS NULL AND initial_cost = 92750000.00;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
      'SOCIETARIO_CORRECAO', 'mep-custo-sunsys-20261022', jsonb_build_object('pacote', 'mep-custo-sunsys-20261022', 'antes', 92750000.00, 'depois', 62750000.00), now());
  END IF;
  RAISE NOTICE 'Linhas alteradas: %', n;
END $$;
SELECT ci.legal_name AS investidora, ce.legal_name AS investida, m.percent_owned AS perc, m.initial_cost AS custo, m.acquisition_date AS aquisicao
  FROM equity_method_investments m JOIN companies ci ON ci.id = m.investor_company_id JOIN companies ce ON ce.id = m.investee_company_id
 WHERE m.deleted_at IS NULL ORDER BY 1;
COMMIT;
