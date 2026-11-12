-- IMPL-ECF-01 (12/11/2026) - escrituracao do periodo no regime tributario (generico, qualquer empresa)
-- tip_esc_pre: C = escrituracao contabil (ECD vinculada) | L = livro caixa (sem ECD) - ECF 0010.TIP_ESC_PRE
-- criterio_receita: CAIXA | COMPETENCIA - ECF 0010.IND_REC_RECEITA (Presumido)
ALTER TABLE company_tax_regimes ADD COLUMN IF NOT EXISTS tip_esc_pre varchar(1);
ALTER TABLE company_tax_regimes ADD COLUMN IF NOT EXISTS criterio_receita varchar(12);
