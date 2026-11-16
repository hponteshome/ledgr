-- 2026-11-16 - LM: regime de 2013 a 2021 era Lucro Presumido (confirmado pelo Hpontes em 16/11/2026).
-- O registro estava com forma_tributacao = 2 (Real/Arbitrado na tabela da ECF). Correto: 5 (Presumido), IRPJ trimestral.
\pset pager off
\echo === ANTES ===
SELECT dt_ini, dt_fin, forma_tributacao, periodo_apuracao_irpj, tip_esc_pre, criterio_receita
  FROM company_tax_regimes WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' ORDER BY dt_ini;
BEGIN;
UPDATE company_tax_regimes
   SET forma_tributacao = '5', periodo_apuracao_irpj = 'T', updated_at = now()
 WHERE id = 'b8a25170-ffe4-4ffa-b28d-4afd75fae402'
   AND company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a'
   AND dt_ini = DATE '2013-03-12'
   AND forma_tributacao = '2';
COMMIT;
\echo === DEPOIS ===
SELECT dt_ini, dt_fin, forma_tributacao, periodo_apuracao_irpj, tip_esc_pre, criterio_receita
  FROM company_tax_regimes WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' ORDER BY dt_ini;