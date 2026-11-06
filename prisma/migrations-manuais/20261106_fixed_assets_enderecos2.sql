-- B-FA-ENDERECOS2 - 20261106_fixed_assets_enderecos2.sql
BEGIN;
UPDATE fixed_assets SET street = 'Rua Dom Armando Lombardi',
       complement = 'Cobertura 1V - Ed. Loft Sao Paulo I - Torre Village Bl B',
       neighborhood = COALESCE(NULLIF(neighborhood,''), 'Vila Progredior')
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = 'LoftSP';
UPDATE fixed_assets SET iptu_registration = replace(iptu_registration, ',', '.')
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = 'Conj33';
UPDATE fixed_assets SET street = 'Avenida das Nacoes Unidas',
       complement = 'CJ 137 A - Landmark Nacoes Unidas Torre C'
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = '137-A';
COMMIT;
SELECT internal_code, street, number, complement, neighborhood, iptu_registration
  FROM fixed_assets
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code IN ('LoftSP','Conj33','137-A')
 ORDER BY 1;