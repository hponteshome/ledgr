BEGIN;

-- ═══ MATRIZ (matriz_master_accounts) ═══════════════════════════════════════

-- Novo grupo 234 - irmao de 233, sob 23 Patrimonio Liquido
INSERT INTO matriz_master_accounts (id, code, name, level, type, nature, is_analytic, bloco, is_active, parent_id)
VALUES ('436fb0dc-f2b4-4b26-989c-54fb940593a8', '234', 'APURAÇÃO DE RESULTADOS', 3, 'EQUITY', 'CREDIT', false, 'NUCLEO', true,
        'c7541530-eb44-406c-9f4a-e327229070d0');

INSERT INTO matriz_master_accounts (id, code, name, level, type, nature, is_analytic, bloco, is_active, parent_id)
VALUES ('9c066b30-d1a3-4805-90f2-a58fc7d32965', '23401', 'APURAÇÃO DE RESULTADOS', 4, 'EQUITY', 'CREDIT', false, 'NUCLEO', true,
        '436fb0dc-f2b4-4b26-989c-54fb940593a8');

INSERT INTO matriz_master_accounts (id, code, name, level, type, nature, is_analytic, bloco, is_active, parent_id)
VALUES ('4d98f05f-126d-45e5-9a98-c845aa627316', '2340101', 'APURAÇÃO DO RESULTADO DO EXERCÍCIO', 5, 'EQUITY', 'CREDIT', false, 'NUCLEO', true,
        '9c066b30-d1a3-4805-90f2-a58fc7d32965');

-- Reclassifica a folha existente (mesmo ID - preserva qualquer vinculo futuro)
UPDATE matriz_master_accounts
SET code = '23401010001',
    level = 6,
    type = 'EQUITY',
    nature = 'CREDIT',
    parent_id = '4d98f05f-126d-45e5-9a98-c845aa627316'
WHERE code = '49101010001' AND deleted_at IS NULL;

-- Soft-delete da cadeia orfa (0 vinculo transacional na Matriz, ela e so template)
UPDATE matriz_master_accounts
SET deleted_at = NOW()
WHERE code IN ('49','491','49101','4910101') AND deleted_at IS NULL;

-- ═══ HOTELSYS (chart_of_accounts) ═══════════════════════════════════════════

INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id)
VALUES ('0f0c01b7-ee2c-4b3d-90e9-1a5b65a47e06',
        (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '234', 'APURAÇÃO DE RESULTADOS', 3, 'EQUITY', 'CREDIT', false, true,
        '2d07c5bd-dab1-443b-9ab7-b412de5190b0');

INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id)
VALUES ('bb05f442-65c8-414f-ab11-7a2f98ea0e0d',
        (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '23401', 'APURAÇÃO DE RESULTADOS', 4, 'EQUITY', 'CREDIT', false, true,
        '0f0c01b7-ee2c-4b3d-90e9-1a5b65a47e06');

INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id)
VALUES ('5d2a7e4f-44bc-4422-9c41-ca41ab1d69e5',
        (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '2340101', 'APURAÇÃO DO RESULTADO DO EXERCÍCIO', 5, 'EQUITY', 'CREDIT', false, true,
        'bb05f442-65c8-414f-ab11-7a2f98ea0e0d');

-- Reclassifica a folha existente (mesmo ID - journal_entry_items intactos, ECD-2019 nao precisa reprocessar)
UPDATE chart_of_accounts
SET code = '23401010001',
    level = 6,
    type = 'EQUITY',
    nature = 'CREDIT',
    parent_id = '5d2a7e4f-44bc-4422-9c41-ca41ab1d69e5'
WHERE code = '49101010001'
  AND company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND deleted_at IS NULL;

-- Soft-delete da cadeia orfa (0 itens proprios, confirmado antes)
UPDATE chart_of_accounts
SET deleted_at = NOW()
WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND code IN ('49','491','49101','4910101')
  AND deleted_at IS NULL;

COMMIT;

-- ═══ Verificacao ═════════════════════════════════════════════════════════
SELECT 'matriz' AS origem, code, name, type, nature, is_analytic, level FROM matriz_master_accounts
WHERE code IN ('234','23401','2340101','23401010001') AND deleted_at IS NULL
UNION ALL
SELECT 'hotelsys', code, name, type, nature, is_analytic, level FROM chart_of_accounts
WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND code IN ('234','23401','2340101','23401010001') AND deleted_at IS NULL
ORDER BY origem, code;
