-- prisma/migrations-manuais/20261003_proj_1_1_carga.sql
-- Fase 1.1 - carga inicial idempotente: projeto Recife Ocean, empresas, Operacao Ancora, papeis, contraparte provisoria, participacoes.
BEGIN;
INSERT INTO proj_projetos (codigo, nome, descricao, status, criado_por_id)
SELECT 'RECIFE-OCEAN', 'Recife Ocean Residences', 'Plataforma integrada de gestão do empreendimento (bússola: docs/LEDGR-OceanProject.md).', 'ATIVO', hp.id
FROM (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO proj_projeto_empresas (projeto_id, company_id, observacao, criado_por_id)
SELECT p.id, c.id, x.obs, hp.id
FROM proj_projetos p
CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
JOIN (VALUES ('ad8ad459-40b4-47f5-8a9a-7e4688487b4f'::uuid, 'SUNRISE - controladora'),
             ('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'HOTELSYS'),
             ('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'SUNSYS')) AS x(cid, obs) ON true
JOIN companies c ON c.id = x.cid
WHERE p.codigo = 'RECIFE-OCEAN'
ON CONFLICT (projeto_id, company_id) DO NOTHING;

INSERT INTO proj_operacoes (projeto_id, codigo, nome, tipo, status, data_base, valor_controle, descricao, criado_por_id)
SELECT p.id, 'ANCORA', 'Operação Âncora', 'ANTECIPACAO_AQUISICAO', 'ATIVA', DATE '2025-12-31', 3495791.15,
       'Marco inicial: saldo consolidado de 58 créditos bancários em 31/12/2025. O valor de controle serve apenas para conferência; o saldo é sempre calculado a partir dos créditos.', hp.id
FROM proj_projetos p CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE p.codigo = 'RECIFE-OCEAN'
ON CONFLICT (projeto_id, codigo) DO NOTHING;

INSERT INTO proj_papeis (codigo, nome, descricao, aplica_a, criado_por_id)
SELECT v.codigo, v.nome, v.descricao, v.aplica_a, hp.id
FROM (VALUES
  ('BENEFICIARIA_ECONOMICA', 'Beneficiária econômica', 'Titular econômica da operação', 'AMBOS'),
  ('RECEBEDORA_FINANCEIRA', 'Recebedora financeira', 'Titular da conta que recebe os recursos da operação', 'AMBOS'),
  ('PAGADORA_POR_CONTA', 'Pagadora por conta de terceiro', 'Paga obrigações e despesas por conta da beneficiária', 'AMBOS'),
  ('INTERVENIENTE', 'Interveniente', 'Parte interveniente nos instrumentos da operação', 'AMBOS'),
  ('CONTROLADORA', 'Controladora', 'Controladora societária com papel na operação', 'EMPRESA'),
  ('ADQUIRENTE', 'Adquirente', 'Titular da Conta Individual', 'CONTRAPARTE'),
  ('REMETENTE', 'Remetente', 'Remetente bancário de créditos (pode ser terceiro)', 'CONTRAPARTE'),
  ('FORNECEDOR', 'Fornecedor', 'Fornecedor ou prestador vinculado à operação', 'CONTRAPARTE'),
  ('CREDOR', 'Credor', 'Credor de obrigação vinculada à operação', 'AMBOS')
) AS v(codigo, nome, descricao, aplica_a)
CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO proj_contrapartes (tipo_pessoa, documento, nome, observacoes, criado_por_id)
SELECT NULL, NULL, 'Adquirente Âncora (identificação provisória)', 'Completar nome, tipo de pessoa e CPF/CNPJ com os dados do Termo da Operação Âncora.', hp.id
FROM (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE NOT EXISTS (SELECT 1 FROM proj_contrapartes WHERE nome LIKE 'Adquirente Âncora%' AND cancelado_em IS NULL);

INSERT INTO proj_participacoes (operacao_id, papel_id, company_id, observacao, criado_por_id)
SELECT o.id, pa.id, x.cid, x.obs, hp.id
FROM proj_operacoes o
JOIN proj_projetos p ON p.id = o.projeto_id AND p.codigo = 'RECIFE-OCEAN'
CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
JOIN (VALUES ('c2d48edc-28b7-4fd8-9272-b486449ab2cc'::uuid, 'BENEFICIARIA_ECONOMICA', 'Responsável pela relação de antecipações para futura aquisição'),
             ('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'RECEBEDORA_FINANCEIRA', 'Recebe os créditos da operação'),
             ('6a13e876-7056-4076-a403-9610f7dc37b1'::uuid, 'PAGADORA_POR_CONTA', 'Paga obrigações e despesas por conta da HOTELSYS'),
             ('ad8ad459-40b4-47f5-8a9a-7e4688487b4f'::uuid, 'INTERVENIENTE', 'Controladora/interveniente')) AS x(cid, papel, obs) ON true
JOIN proj_papeis pa ON pa.codigo = x.papel
WHERE o.codigo = 'ANCORA'
  AND NOT EXISTS (SELECT 1 FROM proj_participacoes pp WHERE pp.operacao_id = o.id AND pp.papel_id = pa.id AND pp.company_id = x.cid AND pp.cancelado_em IS NULL);

INSERT INTO proj_participacoes (operacao_id, papel_id, contraparte_id, observacao, criado_por_id)
SELECT o.id, pa.id, ct.id, 'Titular da Conta Individual', hp.id
FROM proj_operacoes o
JOIN proj_projetos p ON p.id = o.projeto_id AND p.codigo = 'RECIFE-OCEAN'
JOIN proj_papeis pa ON pa.codigo = 'ADQUIRENTE'
JOIN proj_contrapartes ct ON ct.nome LIKE 'Adquirente Âncora%' AND ct.cancelado_em IS NULL
CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE o.codigo = 'ANCORA'
  AND NOT EXISTS (SELECT 1 FROM proj_participacoes pp WHERE pp.operacao_id = o.id AND pp.papel_id = pa.id AND pp.contraparte_id = ct.id AND pp.cancelado_em IS NULL);

INSERT INTO audit_logs (actor_id, acao, target_id, depois)
SELECT hp.id, 'PROJ_CARGA_INICIAL', p.id::text,
       jsonb_build_object('projeto', p.codigo, 'operacoes', (SELECT COUNT(*) FROM proj_operacoes WHERE projeto_id = p.id),
                          'participacoes', (SELECT COUNT(*) FROM proj_participacoes), 'item', 'Fase 1.1')
FROM proj_projetos p CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE p.codigo = 'RECIFE-OCEAN' AND NOT EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'PROJ_CARGA_INICIAL' AND target_id = p.id::text);
COMMIT;

SELECT pa.nome AS papel, COALESCE(NULLIF(c.trade_name, ''), c.legal_name, ct.nome) AS participante,
       CASE WHEN pp.company_id IS NOT NULL THEN 'empresa' ELSE 'contraparte' END AS tipo, pp.observacao
FROM proj_participacoes pp
JOIN proj_papeis pa ON pa.id = pp.papel_id
LEFT JOIN companies c ON c.id = pp.company_id
LEFT JOIN proj_contrapartes ct ON ct.id = pp.contraparte_id
WHERE pp.cancelado_em IS NULL ORDER BY tipo, pa.nome;
SELECT o.codigo, o.nome, o.data_base, o.valor_controle, (SELECT COUNT(*) FROM proj_projeto_empresas) AS empresas_no_projeto, (SELECT COUNT(*) FROM proj_papeis) AS papeis
FROM proj_operacoes o;