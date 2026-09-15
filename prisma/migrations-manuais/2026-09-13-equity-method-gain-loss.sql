ALTER TABLE equity_method_investments RENAME COLUMN result_account_id TO gain_account_id;
ALTER TABLE equity_method_investments ADD COLUMN loss_account_id UUID NOT NULL REFERENCES chart_of_accounts(id);
