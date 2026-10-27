-- prisma/migrations-manuais/20261027_integridade.sql
-- 27/10/2026 - Central de Integridade: execucoes e achados das verificacoes automaticas
CREATE TABLE IF NOT EXISTS integrity_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id),
  started_at     timestamp(6) NOT NULL DEFAULT now(),
  finished_at    timestamp(6),
  triggered_by   varchar(20) NOT NULL DEFAULT 'MANUAL',   -- MANUAL | IMPORTACAO | AGENDADA
  user_id        uuid,
  total_findings int NOT NULL DEFAULT 0,
  criticos       int NOT NULL DEFAULT 0,
  alertas        int NOT NULL DEFAULT 0,
  infos          int NOT NULL DEFAULT 0,
  summary        jsonb
);
CREATE INDEX IF NOT EXISTS integrity_runs_company_idx ON integrity_runs (company_id, started_at DESC);

CREATE TABLE IF NOT EXISTS integrity_findings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES integrity_runs(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL,
  check_code  varchar(40) NOT NULL,
  severity    varchar(10) NOT NULL,                    -- CRITICO | ALERTA | INFO
  title       varchar(200) NOT NULL,
  detail      text,
  qtd         int,
  valor       numeric(18,2),
  amostra     jsonb,
  created_at  timestamp(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integrity_findings_run_idx ON integrity_findings (run_id);
CREATE INDEX IF NOT EXISTS integrity_findings_check_idx ON integrity_findings (company_id, check_code);

-- item de menu (Sistema), no mesmo grupo da Auditoria
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem)
SELECT '/app/sistema/integridade', 'Central de Integridade', s.module, 'FiShield', s.parent_id, s.ordem + 1
FROM sidebar_items s
WHERE s.path ILIKE '%system/audit' AND NOT EXISTS (SELECT 1 FROM sidebar_items WHERE path = '/app/sistema/integridade')
LIMIT 1;
SELECT path, label, module, parent_id IS NOT NULL AS tem_pai FROM sidebar_items WHERE path IN ('/app/sistema/integridade') OR path ILIKE '%system/audit';
