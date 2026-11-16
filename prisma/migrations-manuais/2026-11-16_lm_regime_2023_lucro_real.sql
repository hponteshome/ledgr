-- 2026-11-16 - LM: regime de 2023 = Lucro Real (forma 1), confirmado pela ECF 2023 entregue (0010: FORMA_TRIB 1, anual).
-- O registro estava com forma_tributacao = 2 (Real/Arbitrado na tabela da ECF).
\pset pager off
BEGIN;
UPDATE company_tax_regimes
   SET forma_tributacao = '1', updated_at = now()
 WHERE id = '74d8de4d-4612-4330-b386-b7ee2b47fc0f'
   AND company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a'
   AND dt_ini = DATE '2023-01-01'
   AND forma_tributacao = '2';
COMMIT;
SELECT dt_ini, dt_fin, forma_tributacao, periodo_apuracao_irpj, tip_esc_pre, criterio_receita
  FROM company_tax_regimes WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' ORDER BY dt_ini;