-- 18/11/2026 - compensacao de adiantamentos de pro-labore
CREATE TABLE IF NOT EXISTS pro_labore_compensacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  pagamento_id uuid NOT NULL REFERENCES pro_labore_pagamentos(id),
  adiantamento_id uuid NOT NULL REFERENCES pro_labore_pagamentos(id),
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  created_at timestamp(6) NOT NULL DEFAULT now(),
  deleted_at timestamp(6)
);
CREATE INDEX IF NOT EXISTS pro_labore_compensacoes_adiantamento_id_idx ON pro_labore_compensacoes(adiantamento_id);
CREATE INDEX IF NOT EXISTS pro_labore_compensacoes_pagamento_id_idx ON pro_labore_compensacoes(pagamento_id);
