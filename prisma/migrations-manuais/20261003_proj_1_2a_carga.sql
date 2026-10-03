-- prisma/migrations-manuais/20261003_proj_1_2a_carga.sql
-- Fase 1.2a - catalogo de perfis do projeto (bussola 5.3) e concessao da conta de teste. Idempotente.
BEGIN;
INSERT INTO proj_perfis (codigo, nome, descricao, acoes, nivel_padrao, criado_por_id)
SELECT v.codigo, v.nome, v.descricao, v.acoes, v.nivel, hp.id
FROM (VALUES
  ('ADMIN_PROJETO', 'Administrador do projeto', 'Configuração e cadastros do projeto', ARRAY['ver','criar','editar','conciliar','aprovar','exportar','administrar'], 'EMPRESA_COMPLETA'),
  ('FINANCEIRO', 'Financeiro', 'Importar, classificar, vincular comprovantes', ARRAY['ver','criar','editar','exportar'], 'EMPRESA_PROJETO'),
  ('CONTABILIDADE', 'Contabilidade', 'Classificar, conciliar, sugerir lançamentos, intercompany', ARRAY['ver','criar','editar','conciliar','exportar'], 'EMPRESA_COMPLETA'),
  ('JURIDICO', 'Jurídico/Societário', 'Contratos, atos e documentos', ARRAY['ver','criar','editar'], 'EMPRESA_PROJETO'),
  ('GESTAO', 'Gestão do Projeto', 'Orçamento, cronograma, marcos e pendências', ARRAY['ver','criar','editar'], 'OPERACAO'),
  ('APROVADOR', 'Aprovador', 'Aprovar ou reprovar com justificativa', ARRAY['ver','aprovar'], 'OPERACAO'),
  ('CONSULTA', 'Sócio/Consulta', 'Somente leitura de painéis e relatórios', ARRAY['ver'], 'OPERACAO'),
  ('AUDITORIA', 'Auditoria', 'Leitura ampla, trilha e exportação (conceder com prazo)', ARRAY['ver','exportar'], 'EMPRESA_PROJETO')
) AS v(codigo, nome, descricao, acoes, nivel)
CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO proj_concessoes (user_id, projeto_id, operacao_id, perfil_id, nivel, observacao, criado_por_id)
SELECT u.id, p.id, o.id, pf.id, 'OPERACAO', 'Conta de teste da suite de regressao (Consulta na Operacao Ancora)', hp.id
FROM users u
CROSS JOIN proj_projetos p
JOIN proj_operacoes o ON o.projeto_id = p.id AND o.codigo = 'ANCORA'
CROSS JOIN proj_perfis pf
CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE u.email = 'qa.hotelsys@ledgr.local' AND p.codigo = 'RECIFE-OCEAN' AND pf.codigo = 'CONSULTA'
  AND NOT EXISTS (SELECT 1 FROM proj_concessoes c WHERE c.user_id = u.id AND c.projeto_id = p.id AND c.operacao_id = o.id AND c.cancelado_em IS NULL);

INSERT INTO audit_logs (actor_id, acao, target_id, depois)
SELECT hp.id, 'PROJ_CONCESSAO_CRIADA', c.id::text, jsonb_build_object('usuario', 'qa.hotelsys@ledgr.local', 'perfil', 'CONSULTA', 'escopo', 'Operacao Ancora', 'nivel', c.nivel)
FROM proj_concessoes c JOIN users u ON u.id = c.user_id AND u.email = 'qa.hotelsys@ledgr.local'
CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE c.cancelado_em IS NULL AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.acao = 'PROJ_CONCESSAO_CRIADA' AND a.target_id = c.id::text);
COMMIT;
SELECT codigo, nome, array_to_string(acoes, ',') AS acoes, nivel_padrao FROM proj_perfis ORDER BY codigo;
SELECT u.email, pf.codigo AS perfil, COALESCE(o.codigo, '(projeto inteiro)') AS escopo, c.nivel FROM proj_concessoes c JOIN users u ON u.id = c.user_id JOIN proj_perfis pf ON pf.id = c.perfil_id LEFT JOIN proj_operacoes o ON o.id = c.operacao_id WHERE c.cancelado_em IS NULL;