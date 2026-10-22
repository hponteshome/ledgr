-- prisma/migrations-manuais/20261022_societario_sunsys_percentuais.sql
-- 22/10/2026 - Livro de Registro e participacao (MEP):
--  1. Sunsys: percentuais pelo capital de 62.800.000 quotas - Hotelsys 62.750.000 = 99,9204%; Mohamed 50.000 = 0,0796%
--     (estavam 99,2% e 0,8%); valor integralizado = total (estava 0); nome do Mohamed sem o prefixo "1.2.<tab>".
--  2. Participacao Hotelsys -> Sunsys (equity_method_investments): 99,2000% -> 99,9204%.
--  3. F5 (Helenilto, 100.000 ON) e Sunrise (F5, 1.408.780 quotas): valor integralizado = total (estava 0).
--  4. Cadastro de pessoa do Mohamed: nome sem o prefixo "1.2.<tab>".
-- Reexecutar nao altera nada (cada UPDATE so age sobre o valor antigo).
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE n int; t int := 0;
  sunsys uuid := '6a13e876-7056-4076-a403-9610f7dc37b1'; hotelsys uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc';
BEGIN
  UPDATE shareholder_records SET percent_owned = 99.9204, paid_in_amount = 62750000.00, updated_at = now()
   WHERE id = 'a30b9d70-926a-489e-bcff-424479b8f626' AND company_id = sunsys AND quantity = 62750000 AND percent_owned = 99.2;
  GET DIAGNOSTICS n = ROW_COUNT; t := t + n;
  UPDATE shareholder_records SET percent_owned = 0.0796, paid_in_amount = 50000.00, holder_name = 'MOHAMED SIDIK ABDUL LATIF', updated_at = now()
   WHERE id = 'f8a7c01a-2214-404b-a01c-7041e2f55029' AND company_id = sunsys AND quantity = 50000 AND percent_owned = 0.8;
  GET DIAGNOSTICS n = ROW_COUNT; t := t + n;
  UPDATE equity_method_investments SET percent_owned = 99.9204, updated_at = now()
   WHERE investor_company_id = hotelsys AND investee_company_id = sunsys AND deleted_at IS NULL AND percent_owned = 99.2;
  GET DIAGNOSTICS n = ROW_COUNT; t := t + n;
  UPDATE shareholder_records SET paid_in_amount = total_value, updated_at = now()
   WHERE id IN ('9056d976-18f1-4ebe-88aa-40506ca3ae80', 'd5a22e3e-cd47-45a1-bf8c-c0293b00e2f6') AND paid_in_amount = 0 AND is_fully_paid;
  GET DIAGNOSTICS n = ROW_COUNT; t := t + n;
  UPDATE persons SET full_name = 'Mohamed Sidik Abdul Latif', updated_at = now()
   WHERE full_name LIKE '1.2.%Mohamed Sidik Abdul Latif';
  GET DIAGNOSTICS n = ROW_COUNT; t := t + n;
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), '421642c8-e981-49c9-996c-b4bfabc22b52',
    'SOCIETARIO_CORRECAO', 'societario-sunsys-20261022', jsonb_build_object('pacote', 'societario-sunsys-20261022', 'linhas', t), now());
  RAISE NOTICE 'Linhas alteradas: %', t;
END $$;
SELECT c.legal_name AS empresa, r.holder_name AS titular, r.quantity::bigint AS quotas, r.percent_owned AS perc, r.paid_in_amount AS integralizado
  FROM shareholder_records r JOIN companies c ON c.id = r.company_id
 WHERE r.deleted_at IS NULL AND r.is_active ORDER BY 1, 3 DESC;
SELECT ci.legal_name AS investidora, ce.legal_name AS investida, m.percent_owned AS perc
  FROM equity_method_investments m JOIN companies ci ON ci.id = m.investor_company_id JOIN companies ce ON ce.id = m.investee_company_id
 WHERE m.deleted_at IS NULL ORDER BY 1;
COMMIT;
