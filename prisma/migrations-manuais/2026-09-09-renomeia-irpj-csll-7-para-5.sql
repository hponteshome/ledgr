BEGIN;

-- 1) Soft-delete das 6 contas nativas do grupo 5 (CONTA TRANSITORIA /
--    TRIBUTACAO SOBRE O LUCRO / IRPJ DIFERIDO / CSLL DIFERIDA), 0 itens
--    gravados confirmado - libera o codigo pra reuso.
UPDATE chart_of_accounts
SET deleted_at = NOW()
WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND code IN ('5','51','5101','5101001','5101001346','5101001347')
  AND deleted_at IS NULL;

-- 2) Renomeia as 10 contas de IRPJ/CSLL de 7xxx para 5xxx (mesmo id,
--    reduced_code ja correto/inalterado - so a posicao na arvore muda).
UPDATE chart_of_accounts SET code = '5' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '7' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET code = '51' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '71' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET code = '511' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '711' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET code = '51101' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '71101' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET code = '5110101' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '7110101' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET code = '5110102' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '7110102' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET code = '51101010001' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '71101010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET code = '51101010002' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '71101010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET code = '51101020001' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '71101020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET code = '51101020002' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '71101020002' AND deleted_at IS NULL;

COMMIT;

-- Verificacao
SELECT code, name, origin, reduced_code FROM chart_of_accounts
WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND code LIKE '5%' AND deleted_at IS NULL
ORDER BY code;
