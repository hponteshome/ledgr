-- B-FA-CIB-DADOS - 20261105_fixed_assets_cib_dados.sql
BEGIN;
UPDATE fixed_assets SET iptu_registration = '101.389.0132-4',
       description = 'Cobertura 1V e 2 vagas, Edificio Loft Sao Paulo I, Torre Village, Bloco B, Rua Dom Armando Lombardi, 800, Vila Progredior, Sao Paulo-SP, CEP 05616-011'
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = 'LoftSP';

UPDATE fixed_assets SET ibge_code = v.ibge
  FROM (VALUES ('São Paulo','3550308'), ('Curitiba','4106902'), ('Bertioga','3506359'),
               ('Campos do Jordão','3509700'), ('Cotia','3513009'), ('Florianópolis','4205407'),
               ('Guarujá','3518701'), ('Piraquara','4119509')) AS v(cidade, ibge)
 WHERE fixed_assets.company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a'
   AND fixed_assets.city = v.cidade AND fixed_assets.ibge_code IS NULL;

UPDATE fixed_assets SET nbs_locacao = '1.1002.10.00'
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a'
   AND internal_code IN ('LoftSP','Mare62','Mare88','Mare92','NorthYork','Ecoville','StParis','PalaysRoyal','Floripa','Campos');
UPDATE fixed_assets SET nbs_locacao = '1.1002.20.00'
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a'
   AND internal_code IN ('137-A','138-A','139-A','Conj32','Conj33');
COMMIT;

SELECT internal_code, city, ibge_code, nbs_locacao, iptu_registration, cib
  FROM fixed_assets
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND deleted_at IS NULL AND "group" = 'REAL_ESTATE'
 ORDER BY internal_code;