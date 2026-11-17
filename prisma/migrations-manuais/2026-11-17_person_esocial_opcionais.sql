-- 17/11/2026 - Pessoa: campos opcionais do eSocial (raca/cor por autodeclaracao e grau de instrucao)
ALTER TABLE persons ADD COLUMN IF NOT EXISTS raca_cor varchar(1) NULL;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS grau_instrucao varchar(2) NULL;
