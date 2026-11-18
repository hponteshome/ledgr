-- 18/11/2026 - Processamento Mensal do eSocial: aprovacao da conferencia por competencia
CREATE TABLE IF NOT EXISTS esocial_s13_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  tp_amb smallint NOT NULL,
  per_apur varchar(7) NOT NULL,
  aprovado_por uuid,
  aprovado_em timestamp(6) NOT NULL,
  resumo jsonb,
  created_at timestamp(6) NOT NULL DEFAULT now(),
  CONSTRAINT esocial_s13_aprovacoes_company_id_tp_amb_per_apur_key UNIQUE (company_id, tp_amb, per_apur)
);
