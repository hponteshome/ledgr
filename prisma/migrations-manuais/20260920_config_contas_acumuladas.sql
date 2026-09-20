-- Config contabil: contas de saldo anterior (Lucros Acumulados / Prejuizos Acumulados), opcionais
ALTER TABLE company_accounting_configs
  ADD COLUMN IF NOT EXISTS encerramento_conta_lucros_acumulados_id uuid,
  ADD COLUMN IF NOT EXISTS encerramento_conta_prejuizos_acumulados_id uuid;
