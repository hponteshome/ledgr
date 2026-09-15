CREATE TABLE equity_method_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_company_id UUID NOT NULL REFERENCES companies(id),
  investee_company_id UUID NOT NULL REFERENCES companies(id),
  percent_owned NUMERIC(8,4) NOT NULL,
  investment_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  result_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  initial_cost NUMERIC(18,2) NOT NULL,
  acquisition_date DATE NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP(6)
);
CREATE INDEX idx_equity_method_investments_investor ON equity_method_investments(investor_company_id);

CREATE TABLE equity_method_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES equity_method_investments(id),
  reference_date DATE NOT NULL,
  investee_pl NUMERIC(18,2) NOT NULL,
  percent_applied NUMERIC(8,4) NOT NULL,
  equity_value NUMERIC(18,2) NOT NULL,
  previous_book_value NUMERIC(18,2) NOT NULL,
  adjustment NUMERIC(18,2) NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by_id UUID NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT now(),
  UNIQUE(investment_id, reference_date)
);
CREATE INDEX idx_equity_method_calculations_investment ON equity_method_calculations(investment_id);
