-- prisma/migrations-manuais/20261003_proj_1_6_adquirente.sql
-- Fase 1.6 - identificacao do Adquirente Ancora (informada pelo Hpontes em 03/10/2026). PJ: dado publico.
BEGIN;
INSERT INTO audit_logs (actor_id, acao, target_id, antes, depois)
SELECT hp.id, 'PROJ_CONTRAPARTE_ATUALIZADA', ct.id::text,
       jsonb_build_object('nome', ct.nome, 'tipo_pessoa', ct.tipo_pessoa, 'documento', ct.documento),
       jsonb_build_object('nome', 'VAL INVESTIMENTOS S/A', 'tipo_pessoa', 'PJ', 'documento', '55016325000154')
FROM proj_contrapartes ct CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE ct.nome LIKE 'Adquirente Âncora%' AND ct.cancelado_em IS NULL;
UPDATE proj_contrapartes
   SET tipo_pessoa = 'PJ', documento = '55016325000154', nome = 'VAL INVESTIMENTOS S/A',
       observacoes = 'Adquirente Âncora - titular da Conta Individual. Sociedade por ações.',
       atualizado_em = now(), atualizado_por_id = (SELECT id FROM users WHERE email = 'hpontes@ledgr.com')
 WHERE nome LIKE 'Adquirente Âncora%' AND cancelado_em IS NULL;
COMMIT;
SELECT ct.nome, ct.tipo_pessoa, ct.documento, pa.nome AS papel FROM proj_contrapartes ct JOIN proj_participacoes pp ON pp.contraparte_id = ct.id JOIN proj_papeis pa ON pa.id = pp.papel_id WHERE pa.codigo = 'ADQUIRENTE';