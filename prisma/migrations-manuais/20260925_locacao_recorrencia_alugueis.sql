-- 25/09/2026 - Locacao de Imoveis: recorrencia mensal de aluguel
-- 2 campos novos em company_accounting_configs (contas de Receita de
-- Alugueis / Alugueis a Receber) + rental_contract_id em ar_entries, com
-- indice unico (rental_contract_id, competence_month) para idempotencia -
-- espelha o padrao ja usado por provisao_lancamentos.
ALTER TABLE company_accounting_configs
  ADD COLUMN IF NOT EXISTS locacao_conta_receita_alugueis_id UUID,
  ADD COLUMN IF NOT EXISTS locacao_conta_alugueis_a_receber_id UUID;

ALTER TABLE ar_entries
  ADD COLUMN IF NOT EXISTS rental_contract_id UUID REFERENCES rental_contracts(id);

CREATE UNIQUE INDEX IF NOT EXISTS ar_entries_rental_contract_competence_key
  ON ar_entries (rental_contract_id, competence_month);
