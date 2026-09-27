-- 25/09/2026 - Equivalencia Patrimonial: provisao para perda excedente
-- (CPC 18/IAS 28). Campo novo (provision_account_id) + link do investimento
-- real Sunrise Hotels & Resorts Holding (investidora) -> Hotelsys Gestao
-- Hoteleira (investida) para a conta ja existente de "Provisoes para Perdas
-- em Investimentos" (22102010001), ja usada na pratica pela Sunrise.
ALTER TABLE equity_method_investments
  ADD COLUMN IF NOT EXISTS provision_account_id UUID;

UPDATE equity_method_investments emi
SET provision_account_id = (
  SELECT coa.id FROM chart_of_accounts coa
  WHERE coa.company_id = (SELECT id FROM companies WHERE tax_id = '16846468000131')
    AND coa.code = '22102010001' AND coa.deleted_at IS NULL
)
FROM companies investidora, companies investida
WHERE emi.investor_company_id = investidora.id
  AND emi.investee_company_id = investida.id
  AND investidora.tax_id = '16846468000131'
  AND investida.tax_id = '05736256000185';
