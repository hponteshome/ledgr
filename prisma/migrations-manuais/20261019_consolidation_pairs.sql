-- prisma/migrations-manuais/20261019_consolidation_pairs.sql
-- 19/10/2026 - Balanco Consolidado Intercompany.
-- 1) Tabela consolidation_pairs (pares de contas intercompany eliminados na consolidacao). Sem model no Prisma:
--    a API acessa por SQL direto (consolidation.service.ts). Remocao logica (deleted_at).
-- 2) Pares iniciais da Operacao Ancora (so entram se as duas contas existirem no plano de cada empresa).
-- 3) Item de menu "Balanco Consolidado" logo abaixo do Balanco Patrimonial (mesmo grupo, modulo e icone).
-- Rollback: DELETE FROM sidebar_items WHERE path = '/app/accounting/balanco-consolidado'; DROP TABLE consolidation_pairs;
BEGIN;

CREATE TABLE IF NOT EXISTS consolidation_pairs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_a_id    uuid NOT NULL REFERENCES companies(id),
  account_a_code  varchar(30) NOT NULL,
  company_b_id    uuid NOT NULL REFERENCES companies(id),
  account_b_code  varchar(30) NOT NULL,
  descricao       varchar(200) NOT NULL,
  created_by_id   uuid NULL,
  created_at      timestamp(6) NOT NULL DEFAULT now(),
  deleted_at      timestamp(6) NULL,
  CONSTRAINT consolidation_pairs_empresas_distintas CHECK (company_a_id <> company_b_id)
);
CREATE INDEX IF NOT EXISTS consolidation_pairs_a_idx ON consolidation_pairs (company_a_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS consolidation_pairs_b_idx ON consolidation_pairs (company_b_id) WHERE deleted_at IS NULL;

INSERT INTO consolidation_pairs (company_a_id, account_a_code, company_b_id, account_b_code, descricao)
SELECT v.a::uuid, v.ca, v.b::uuid, v.cb, v.d
  FROM (VALUES
    ('6a13e876-7056-4076-a403-9610f7dc37b1', '12101020022', 'c2d48edc-28b7-4fd8-9272-b486449ab2cc', '22101020001', U&'M\00fatuo Opera\00e7\00e3o \00c2ncora - Sunsys x Hotelsys'),
    ('c2d48edc-28b7-4fd8-9272-b486449ab2cc', '22101020002', 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f', '12101020025', 'Anexo V - conta corrente Hotelsys x Sunrise'),
    ('ad8ad459-40b4-47f5-8a9a-7e4688487b4f', '12101020024', 'e274dfc0-0a9a-4af1-8141-f35ff73fac93', '22103010001', U&'Anexo V por conta da RM (confiss\00e3o) - Sunrise x F5'),
    ('e274dfc0-0a9a-4af1-8141-f35ff73fac93', '12101020024', '6a13e876-7056-4076-a403-9610f7dc37b1', '22101050006', U&'Conta corrente Opera\00e7\00e3o \00c2ncora - F5 x Sunsys'),
    ('c2d48edc-28b7-4fd8-9272-b486449ab2cc', '12101020021', '6a13e876-7056-4076-a403-9610f7dc37b1', '22101050004', U&'M\00fatuo Hotelsys x Sunsys (anterior \00e0 Opera\00e7\00e3o \00c2ncora)')
  ) AS v(a, ca, b, cb, d)
 WHERE EXISTS (SELECT 1 FROM chart_of_accounts x WHERE x.company_id = v.a::uuid AND x.code = v.ca AND x.deleted_at IS NULL)
   AND EXISTS (SELECT 1 FROM chart_of_accounts y WHERE y.company_id = v.b::uuid AND y.code = v.cb AND y.deleted_at IS NULL)
   AND NOT EXISTS (SELECT 1 FROM consolidation_pairs p WHERE p.deleted_at IS NULL AND p.company_a_id = v.a::uuid AND p.account_a_code = v.ca
                      AND p.company_b_id = v.b::uuid AND p.account_b_code = v.cb);

INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, disabled, action_type)
SELECT '/app/accounting/balanco-consolidado',
       U&'Balan\00e7o Consolidado',
       m.module,
       m.icon,
       m.parent_id,
       (SELECT MIN(g) FROM generate_series(m.ordem + 1, m.ordem + 500) g
         WHERE g NOT IN (SELECT ordem FROM sidebar_items s WHERE s.parent_id IS NOT DISTINCT FROM m.parent_id)),
       false,
       'link'
  FROM sidebar_items m
 WHERE m.path = '/app/accounting/balanco'
ON CONFLICT (path) DO NOTHING;

COMMIT;
