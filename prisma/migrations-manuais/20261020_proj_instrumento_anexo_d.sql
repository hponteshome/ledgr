-- prisma/migrations-manuais/20261020_proj_instrumento_anexo_d.sql
-- Instrumentos do plano (20/10/2026): AnexoD - Termo de responsabilidade e declaracao da VAL Investimentos (Doc. 21),
-- para juntada ao proc. 1419/26.2T8STR. VAL declara; F5 intervem (n.o 4); Massa da RM toma ciencia. Reexecutavel.
SET client_encoding = 'UTF8';
BEGIN;
SELECT set_config('app.user_id', (SELECT id::text FROM users WHERE email = 'hpontes@ledgr.com'), true);
INSERT INTO proj_instrumentos (projeto_id, codigo, ordem, titulo, item_planilha, tipo, lei, requer_assinatura, requer_registro, orgao_registro_previsto, referencia_minuta)
SELECT p.id, 'AnexoD', 12, 'Termo de responsabilidade e declaração da VAL Investimentos (Anexo D - Doc. 21)', NULL, 'DECLARACAO', 'BR_PT', true, true,
       'Juntada ao proc. 1419/26.2T8STR', 'Anexo D - Doc. 21 (Word revisado em 20/10/2026)'
FROM proj_projetos p WHERE p.codigo = 'RECIFE-OCEAN'
ON CONFLICT (projeto_id, codigo) DO NOTHING;
INSERT INTO proj_instrumento_partes (instrumento_id, ordem, nome, papel, documento, jurisdicao, forma_assinatura)
SELECT i.id, x.ordem, x.nome, x.papel, x.doc, x.jur, x.forma
FROM (VALUES
  (1, 'VAL INVESTIMENTOS S/A', 'PARTE', '55016325000154', 'BR', 'CLICKSIGN'),
  (2, 'F5 PARTICIPAÇÕES S/A', 'INTERVENIENTE', '33652701000164', 'BR', 'CLICKSIGN'),
  (3, 'Massa Insolvente da Real Mouchão Lombo do Tejo, Sociedade Agropecuária, S.A.', 'CIENCIA', '503382582', 'PT', 'A_DEFINIR')
) AS x(ordem, nome, papel, doc, jur, forma)
JOIN proj_instrumentos i ON i.codigo = 'AnexoD' JOIN proj_projetos p ON p.id = i.projeto_id AND p.codigo = 'RECIFE-OCEAN'
WHERE NOT EXISTS (SELECT 1 FROM proj_instrumento_partes q WHERE q.instrumento_id = i.id AND q.nome = x.nome AND q.papel = x.papel);
COMMIT;
SELECT i.codigo, i.situacao, (SELECT count(*) FROM proj_instrumento_partes q WHERE q.instrumento_id = i.id AND q.cancelado_em IS NULL) AS partes
FROM proj_instrumentos i WHERE i.codigo = 'AnexoD';
