-- B-FA-CIB - 20261105_fixed_assets_cib.sql
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS cib         VARCHAR(8);
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS ibge_code   VARCHAR(7);
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS nbs_locacao VARCHAR(12);
UPDATE fixed_assets SET iptu_registration = '97.152.011.062'
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = 'Mare88'
   AND (iptu_registration IS NULL OR iptu_registration = '');
UPDATE fixed_assets SET iptu_registration = '97.152.011.040'
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = 'Mare62'
   AND (iptu_registration IS NULL OR iptu_registration = '');
SELECT internal_code, iptu_registration, cib, ibge_code, nbs_locacao, city
  FROM fixed_assets
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND deleted_at IS NULL
   AND "group" = 'REAL_ESTATE'
 ORDER BY internal_code;