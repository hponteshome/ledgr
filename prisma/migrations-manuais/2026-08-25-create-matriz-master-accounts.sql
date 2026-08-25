-- prisma/migrations-manuais/2026-08-25-create-matriz-master-accounts.sql
CREATE TABLE matriz_master_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR NOT NULL,
  reduced_code   VARCHAR(10),
  name           VARCHAR NOT NULL,
  level          INT NOT NULL,
  type           account_type NOT NULL,
  nature         account_nature NOT NULL,
  is_analytic    BOOLEAN NOT NULL DEFAULT false,
  bloco          VARCHAR(30) NOT NULL DEFAULT 'NUCLEO',
  parent_id      UUID REFERENCES matriz_master_accounts(id),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by_id  UUID REFERENCES users(id),
  updated_by_id  UUID REFERENCES users(id),
  created_at     TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP(6) NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMP(6)
);

-- indice unico PARCIAL desde a criacao (licao de 24/08/2026: constraint simples
-- e incompativel com soft-delete)
CREATE UNIQUE INDEX matriz_master_accounts_code_active_key
  ON matriz_master_accounts (code)
  WHERE deleted_at IS NULL;

CREATE INDEX matriz_master_accounts_bloco_idx ON matriz_master_accounts (bloco);

SELECT table_name FROM information_schema.tables WHERE table_name = 'matriz_master_accounts';
