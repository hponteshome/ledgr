-- Sessão 17/07/2026 — Reorganização de Sidebar em Macro-Categorias
-- Aplicado diretamente via docker exec psql (ver LEDGR-contexto.md para detalhes)

BEGIN;

-- 1. Divisores de macro-categoria
UPDATE sidebar_items SET divider_before = 'Gestão Operacional'      WHERE id = '9ce167d9-e911-41d5-8fbe-80e92079a7a1';
UPDATE sidebar_items SET divider_before = 'Compliance & Obrigações' WHERE id = '494bef20-936a-4cf9-8114-bc079d7c012f';
UPDATE sidebar_items SET divider_before = 'Configurações e Sistema' WHERE id = '0c34db2d-d882-496b-9b6d-3b6b328472c6';
UPDATE sidebar_items SET divider_before = NULL WHERE id = '243f0ae5-cad2-4655-9b3b-060d3ba1aff8';
UPDATE sidebar_items SET divider_before = NULL WHERE id = '322e684b-23ca-40a3-8340-913b2f15a241';

-- 2. Renomear para desambiguar / clarear
UPDATE sidebar_items SET label = 'Fiscal · Arquivo'              WHERE id = 'a355435f-14eb-4959-982d-ed1c719a02e4';
UPDATE sidebar_items SET label = 'Fiscal · Operação'              WHERE id = '1516d341-c9f5-47a1-8a2e-ed2202a88bc8';
UPDATE sidebar_items SET label = 'Societário · Arquivo'           WHERE id = 'dc7f9ca1-d00c-4101-895b-fb8b4faafa38';
UPDATE sidebar_items SET label = 'Societário · Operação'          WHERE id = '243f0ae5-cad2-4655-9b3b-060d3ba1aff8';
UPDATE sidebar_items SET label = 'Departamento Pessoal · Arquivo' WHERE id = 'af32bce9-e7ba-4a7a-b8f1-c79b90181792';
UPDATE sidebar_items SET label = 'Assinaturas & Certificados'     WHERE id = 'cb68278d-ecd9-4e1f-93e9-4dcc01332aae';
UPDATE sidebar_items SET label = 'Administração do Sistema'       WHERE id = '88a1af2e-feef-41d1-902a-eded1cb75d55';
UPDATE sidebar_items SET label = 'SPED & Entregas'                WHERE id = '494bef20-936a-4cf9-8114-bc079d7c012f';
UPDATE sidebar_items SET label = 'Cadastros Base'                 WHERE id = '0c34db2d-d882-496b-9b6d-3b6b328472c6';
UPDATE sidebar_items SET label = 'Arquivos Digitais'              WHERE id = 'caab53b5-dccb-4683-9afc-b4c44c7b698d';

-- 3. Reparentar eSocial/RAIS/DCTFWeb para SPED & Entregas (limpa DP diário)
UPDATE sidebar_items SET parent_id = '494bef20-936a-4cf9-8114-bc079d7c012f', ordem = 7 WHERE id = '9fa70fd8-f4c2-40cd-8fad-571f7de9a808';
UPDATE sidebar_items SET parent_id = '494bef20-936a-4cf9-8114-bc079d7c012f', ordem = 8 WHERE id = '59d30130-77a2-4343-b3b5-1c04f289e2dc';
UPDATE sidebar_items SET parent_id = '494bef20-936a-4cf9-8114-bc079d7c012f', ordem = 9 WHERE id = '9f384b86-aeac-4f2a-b2d1-aac49ad97cd8';

-- 4. Novo item: Parâmetros Globais
INSERT INTO sidebar_items (id, path, label, module, icon, parent_id, divider_before, ordem, disabled, action_type, resource)
VALUES (gen_random_uuid(), '/app/sistema/parametros', 'Parâmetros Globais', 'admin', 'FiDatabase', NULL, NULL, 13, false, 'link', 'parametros-globais');

-- 5. Reparentar  Calendário/Indicadores/Tabelas para Parâmetros Globais
UPDATE sidebar_items SET parent_id = (SELECT id FROM sidebar_items WHERE path = '/app/sistema/parametros'), ordem = 1 WHERE id = '7b68de16-da94-468a-9e98-6c17b1a58110';
UPDATE sidebar_items SET parent_id = (SELECT id FROM sidebar_items WHERE path = '/app/sistema/parametros'), ordem = 2 WHERE id = 'c26b6094-af21-423f-a8c1-af5e38fb8ae6';
UPDATE sidebar_items SET parent_id = (SELECT id FROM sidebar_items WHERE path = '/app/sistema/parametros'), ordem = 3 WHERE id = '1cd36edf-c4cb-4b61-a9af-a8eb175e7c84';

-- 6. Ordem final da raiz (Arquivos Digitais dentro de Gestão Operacional, sem divisor próprio)
UPDATE sidebar_items SET ordem = 1  WHERE id = 'c3753cdd-43f0-49a8-9609-9b0d853e4843'; -- Visão Geral
UPDATE sidebar_items SET ordem = 2  WHERE id = '9ce167d9-e911-41d5-8fbe-80e92079a7a1'; -- Financeiro
UPDATE sidebar_items SET ordem = 3  WHERE id = '322e684b-23ca-40a3-8340-913b2f15a241'; -- Contabilidade
UPDATE sidebar_items SET ordem = 4  WHERE id = '1516d341-c9f5-47a1-8a2e-ed2202a88bc8'; -- Fiscal · Operação
UPDATE sidebar_items SET ordem = 5  WHERE id = 'f22fcbfe-b232-4538-a7de-b9f23dba0389'; -- Departamento Pessoal
UPDATE sidebar_items SET ordem = 6  WHERE id = '243f0ae5-cad2-4655-9b3b-060d3ba1aff8'; -- Societário · Operação
UPDATE sidebar_items SET ordem = 7  WHERE id = '14a2d0bd-ba3c-4611-ae4e-f43078f7a0c9'; -- Patrimônio
UPDATE sidebar_items SET ordem = 8  WHERE id = 'caab53b5-dccb-4683-9afc-b4c44c7b698d'; -- Arquivos Digitais
UPDATE sidebar_items SET ordem = 9  WHERE id = '494bef20-936a-4cf9-8114-bc079d7c012f'; -- SPED & Entregas
UPDATE sidebar_items SET ordem = 10 WHERE id = 'cb68278d-ecd9-4e1f-93e9-4dcc01332aae'; -- Assinaturas & Certificados
UPDATE sidebar_items SET ordem = 11 WHERE id = '0c34db2d-d882-496b-9b6d-3b6b328472c6'; -- Cadastros Base
UPDATE sidebar_items SET ordem = 12 WHERE id = '88a1af2e-feef-41d1-902a-eded1cb75d55'; -- Administração do Sistema
UPDATE sidebar_items SET ordem = 13 WHERE id = '08975054-9faf-40cf-9e40-7d34121caa0b' AND ordem <> 14; -- (no-op, mantém Mensagens fora se já ajustado)
UPDATE sidebar_items SET ordem = 14 WHERE id = '08975054-9faf-40cf-9e40-7d34121caa0b'; -- Mensagens

COMMIT;