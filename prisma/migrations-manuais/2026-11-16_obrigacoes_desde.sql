-- 2026-11-16 - Inicio da agenda de obrigacoes por empresa (null = ultimos 5 anos, nunca antes da abertura).
-- LM: regularizacao a partir de jan/2022 (decisao de 10/11/2026; 2021 fora do escopo).
\pset pager off
BEGIN;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS obrigacoes_desde date;
UPDATE companies SET obrigacoes_desde = DATE '2022-01-01' WHERE id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND obrigacoes_desde IS NULL;
COMMIT;
SELECT legal_name, obrigacoes_desde, tem_folha, tem_pro_labore FROM companies ORDER BY legal_name;