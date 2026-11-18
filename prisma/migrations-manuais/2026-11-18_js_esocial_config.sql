-- 2026-11-18_js_esocial_config.sql
-- JS-AGO-02: parametros eSocial da Jose Silva Sociedade Individual de Advocacia (Lucro Real; sem empregados).
-- Mesmo padrao da LM: FPAS 515, terceiros 0115 (so incidem sobre folha de empregados), lotacao 001 (tpLotacao 01),
-- classTrib 99, tabela de rubricas LEDGR. S-1000 com iniValid 2026-08 (primeira competencia enviada pelo LEDGR).
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO esocial_s13_config (company_id, class_trib, ini_valid_s1000, fpas, cod_tercs, cod_lotacao, ide_tab_rubr)
SELECT 'ca9ba513-06ae-4579-b546-ebc457f33452', '99', '2026-08', '515', '0115', '001', 'LEDGR'
WHERE NOT EXISTS (SELECT 1 FROM esocial_s13_config WHERE company_id = 'ca9ba513-06ae-4579-b546-ebc457f33452');
COMMIT;
\echo == conferencia ==
SELECT (SELECT legal_name FROM companies c WHERE c.id = x.company_id) AS empresa, class_trib, ini_valid_s1000, fpas, cod_tercs, cod_lotacao, ide_tab_rubr
  FROM esocial_s13_config x ORDER BY 1;