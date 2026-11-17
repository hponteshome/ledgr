-- 17/11/2026 - Pro-labore de Diretoria: configuracao ligada ao QSA (company_shareholders)
ALTER TABLE pro_labore_configs ADD COLUMN IF NOT EXISTS shareholder_id uuid NULL;
ALTER TABLE pro_labore_configs ADD COLUMN IF NOT EXISTS categoria_esocial varchar(3) NOT NULL DEFAULT '723';
ALTER TABLE pro_labore_configs ADD COLUMN IF NOT EXISTS cbo varchar(6) NULL;
ALTER TABLE pro_labore_configs ADD COLUMN IF NOT EXISTS dia_pagamento smallint NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pro_labore_configs_shareholder_id_fkey') THEN
    ALTER TABLE pro_labore_configs ADD CONSTRAINT pro_labore_configs_shareholder_id_fkey
      FOREIGN KEY (shareholder_id) REFERENCES company_shareholders(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS pro_labore_configs_shareholder_id_idx ON pro_labore_configs(shareholder_id);
