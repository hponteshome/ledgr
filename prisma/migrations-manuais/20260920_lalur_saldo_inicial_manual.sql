-- LALUR Parte B nativa: saldo inicial informado manualmente (null = automatico)
ALTER TABLE lalur_part_b_nativo ADD COLUMN IF NOT EXISTS saldo_inicial_manual numeric(18,2);
