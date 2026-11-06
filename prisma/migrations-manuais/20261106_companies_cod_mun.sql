-- B-NFSE-LOC-3A - 20261106_companies_cod_mun.sql
UPDATE companies SET cod_mun = '3550308'
 WHERE COALESCE(cod_mun,'') = '' AND upper(translate(city, 'ÃÁÀÂÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC')) = 'SAO PAULO' AND state = 'SP';
UPDATE companies SET cod_mun = '2607901'
 WHERE COALESCE(cod_mun,'') = '' AND upper(translate(city, 'ÃÁÀÂÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC')) = 'JABOATAO DOS GUARARAPES' AND state = 'PE';
SELECT legal_name, city, state, cod_mun, tax_regime FROM companies WHERE deleted_at IS NULL ORDER BY 1;