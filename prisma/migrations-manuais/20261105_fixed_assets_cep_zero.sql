-- B-FA-CIB-UI-INSP - 20261105_fixed_assets_cep_zero.sql
UPDATE fixed_assets SET zip_code = lpad(regexp_replace(zip_code, '\D', '', 'g'), 8, '0')
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a'
   AND length(regexp_replace(zip_code, '\D', '', 'g')) = 7;
SELECT internal_code, zip_code FROM fixed_assets
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND zip_code IS NOT NULL ORDER BY 1;