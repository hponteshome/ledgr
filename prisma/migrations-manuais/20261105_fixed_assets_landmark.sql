-- B-FA-CIB-UI2 - 20261105_fixed_assets_landmark.sql
UPDATE fixed_assets SET
  cib = COALESCE(NULLIF(cib,''), 'T5ATBSZ7'),
  iptu_registration = COALESCE(NULLIF(iptu_registration,''), '085.641.2151-4'),
  complement = COALESCE(NULLIF(complement,''), 'CJ 137 A - Landmark Nacoes Unidas Torre C')
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = '137-A';
UPDATE fixed_assets SET
  street = COALESCE(NULLIF(street,''), 'Avenida das Nacoes Unidas'),
  number = COALESCE(NULLIF(number,''), '12399'),
  neighborhood = COALESCE(NULLIF(neighborhood,''), 'Itaim Bibi')
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code IN ('137-A','138-A','139-A');
UPDATE fixed_assets SET complement = COALESCE(NULLIF(complement,''), 'CJ 138 A - Landmark Nacoes Unidas Torre C')
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = '138-A';
UPDATE fixed_assets SET complement = COALESCE(NULLIF(complement,''), 'CJ 139 A - Landmark Nacoes Unidas Torre C')
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = '139-A';
SELECT internal_code, street, number, complement, neighborhood, zip_code, iptu_registration, cib, ibge_code, nbs_locacao
  FROM fixed_assets WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code IN ('137-A','138-A','139-A') ORDER BY 1;