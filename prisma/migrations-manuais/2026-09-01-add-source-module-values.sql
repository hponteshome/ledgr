-- Migracao manual: adiciona 4 valores ao enum source_module
-- PROVISION/ADJUSTMENT: ja eram referenciados pelo frontend (bug real, faltavam)
-- RESULT_TRANSFER/OTHER: novos, para tags de origem de lancamento

ALTER TYPE source_module ADD VALUE IF NOT EXISTS 'PROVISION';
ALTER TYPE source_module ADD VALUE IF NOT EXISTS 'ADJUSTMENT';
ALTER TYPE source_module ADD VALUE IF NOT EXISTS 'RESULT_TRANSFER';
ALTER TYPE source_module ADD VALUE IF NOT EXISTS 'OTHER';
