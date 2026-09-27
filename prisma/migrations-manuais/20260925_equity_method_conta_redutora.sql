-- 25/09/2026 - Equivalencia Patrimonial: conta redutora do investimento
-- Campo novo (reduction_account_id) para somar ao investment_account_id no
-- calculo do saldo liquido - caso real Hotelsys/Sunsys: integralizacao pelo
-- valor de mercado (R$ 62.750.000,00) com o ganho nao realizado registrado
-- em conta propria (R$ 56.069.333,03 C), em vez de eliminado direto na
-- conta de investimento.
ALTER TABLE equity_method_investments
  ADD COLUMN IF NOT EXISTS reduction_account_id UUID;

-- Linka o investimento real Hotelsys -> Sunsys a conta redutora ja criada
UPDATE equity_method_investments emi
SET reduction_account_id = '68293a1e-f8a6-4d87-8b1b-0d816ba8aa28'
FROM companies c
WHERE emi.investee_company_id = c.id AND c.tax_id = '31057460000180';
