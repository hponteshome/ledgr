BEGIN;

-- 1) Cria a raiz nova "5 Despesas com IRPJ e CSLL" na Matriz (template
--    global) - mesmo desenho ja aplicado e validado na Hotelsys.
INSERT INTO matriz_master_accounts (id, code, name, level, type, nature, is_analytic, bloco, is_active, parent_id)
VALUES ('df094c33-7939-4c24-9da8-aba9547e9b75', '5', 'Despesas com IRPJ e CSLL', 1, 'EXPENSE', 'DEBIT', false, 'NUCLEO', true, NULL);
INSERT INTO matriz_master_accounts (id, code, name, level, type, nature, is_analytic, bloco, is_active, parent_id)
VALUES ('f00c3799-acef-460b-adaf-399b9baef456', '51', 'Despesas com IRPJ e CSLL', 2, 'EXPENSE', 'DEBIT', false, 'NUCLEO', true, 'df094c33-7939-4c24-9da8-aba9547e9b75');
INSERT INTO matriz_master_accounts (id, code, name, level, type, nature, is_analytic, bloco, is_active, parent_id)
VALUES ('fa493691-c5d4-441b-950f-ac37d19fa4c7', '511', 'Impostos sobre o Lucro', 3, 'EXPENSE', 'DEBIT', false, 'NUCLEO', true, 'f00c3799-acef-460b-adaf-399b9baef456');
INSERT INTO matriz_master_accounts (id, code, name, level, type, nature, is_analytic, bloco, is_active, parent_id)
VALUES ('fd8472cf-3a77-404e-bad1-0e4a47a71abb', '51101', 'Impostos sobre o Lucro', 4, 'EXPENSE', 'DEBIT', false, 'NUCLEO', true, 'fa493691-c5d4-441b-950f-ac37d19fa4c7');
INSERT INTO matriz_master_accounts (id, code, name, level, type, nature, is_analytic, bloco, is_active, parent_id)
VALUES ('42fbd3fb-e020-4e3c-921b-fe24c3bdebc0', '5110101', 'IRPJ e CSLL', 5, 'EXPENSE', 'DEBIT', false, 'NUCLEO', true, 'fd8472cf-3a77-404e-bad1-0e4a47a71abb');
INSERT INTO matriz_master_accounts (id, code, name, level, type, nature, is_analytic, bloco, is_active, parent_id)
VALUES ('7fe090a8-0c6d-4807-9608-0846306e0fb6', '5110102', 'IRPJ e CSLL Diferidos', 5, 'EXPENSE', 'DEBIT', false, 'NUCLEO', true, 'fd8472cf-3a77-404e-bad1-0e4a47a71abb');

-- 2) Move as 4 folhas (mesmo id, so code/parent_id/reduced_code mudam) e
--    corrige o reduced_code das Diferidas para o bloco 51xx (Regra 2).
UPDATE matriz_master_accounts SET code = '51101010001', parent_id = '42fbd3fb-e020-4e3c-921b-fe24c3bdebc0', reduced_code = '0005101' WHERE id = '5f0dee0d-35ea-4ee4-b10f-e882cd453be8';
UPDATE matriz_master_accounts SET code = '51101010002', parent_id = '42fbd3fb-e020-4e3c-921b-fe24c3bdebc0', reduced_code = '0005102' WHERE id = '63dae60f-79f0-4211-962e-31b1b36204e3';
UPDATE matriz_master_accounts SET code = '51101020001', parent_id = '7fe090a8-0c6d-4807-9608-0846306e0fb6', reduced_code = '0005103' WHERE id = '2b85fd58-45b5-4220-9586-bbb77cef63f8';
UPDATE matriz_master_accounts SET code = '51101020002', parent_id = '7fe090a8-0c6d-4807-9608-0846306e0fb6', reduced_code = '0005104' WHERE id = '316fdd08-0924-4cbc-bced-2d6876cdc63f';

-- 3) Aposenta a cadeia orfa antiga (0 filho depois da mudanca acima) -
--    exclusiva de IRPJ/CSLL, sem mistura com outras despesas (confirmado).
UPDATE matriz_master_accounts SET deleted_at = NOW(), is_active = false
WHERE id IN (
  '43f69601-bd5f-4849-a8b0-c024427e2520',
  '08923f32-b99a-4240-9640-801acfbf6749',
  '2626808d-92a0-4e88-aa8c-6ee4dd5db265',
  '60c53f27-4989-4a01-b501-9d29a2a5b4a1',
  '0c316c95-e443-4312-b695-aa8679f15b20'
);

COMMIT;

-- Verificacao
SELECT code, name, level, reduced_code, is_active FROM matriz_master_accounts
WHERE code LIKE '5%' AND deleted_at IS NULL
ORDER BY code;
