-- 20261111_tax_regime_studies.sql - Comparativo de Regimes (Real x Presumido): ESTUDOS de apoio a decisao por exercicio (nao alteram company_tax_regimes)
BEGIN;
CREATE TABLE IF NOT EXISTS tax_regime_studies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id),
  ano               integer NOT NULL,
  versao            integer NOT NULL,
  titulo            varchar(200),
  premissas         jsonb NOT NULL,
  resultado         jsonb NOT NULL,
  status            varchar(20) NOT NULL DEFAULT 'RASCUNHO', -- RASCUNHO | CONCLUIDO | SUBSTITUIDO
  regime_recomendado varchar(20),
  justificativa     text,
  concluido_em      timestamp(6),
  concluido_por_id  uuid,
  concluido_por_nome varchar(150),
  created_by_id     uuid,
  autor_nome        varchar(150),
  created_at        timestamp(6) NOT NULL DEFAULT now(),
  updated_at        timestamp(6) NOT NULL DEFAULT now(),
  deleted_at        timestamp(6)
);
-- se o bloco IMPL-REGIME-01 (versao anterior) chegou a rodar, renomeia as colunas antigas
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tax_regime_studies' AND column_name = 'regime_escolhido') THEN
    ALTER TABLE tax_regime_studies RENAME COLUMN regime_escolhido TO regime_recomendado;
    ALTER TABLE tax_regime_studies RENAME COLUMN decidido_em TO concluido_em;
    ALTER TABLE tax_regime_studies RENAME COLUMN decidido_por_id TO concluido_por_id;
    ALTER TABLE tax_regime_studies RENAME COLUMN decidido_por_nome TO concluido_por_nome;
    UPDATE tax_regime_studies SET status = 'CONCLUIDO' WHERE status = 'DECIDIDO';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS tax_regime_studies_company_ano_versao_key ON tax_regime_studies (company_id, ano, versao);
CREATE INDEX IF NOT EXISTS tax_regime_studies_company_ano_idx ON tax_regime_studies (company_id, ano);
UPDATE sidebar_items SET ordem = 5 WHERE id = '3c9a0aa7-5207-410a-8d02-80bc96cac2e1' AND ordem = 4;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem)
VALUES ('/app/fiscal/comparativo-regimes', 'Comparativo de Regimes', 'fiscal', 'FiBarChart2', '1516d341-c9f5-47a1-8a2e-ed2202a88bc8', 4)
ON CONFLICT (path) DO NOTHING;
COMMIT;
SELECT label, ordem FROM sidebar_items WHERE parent_id = '1516d341-c9f5-47a1-8a2e-ed2202a88bc8' ORDER BY ordem;
