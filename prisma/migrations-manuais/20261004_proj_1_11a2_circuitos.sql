-- prisma/migrations-manuais/20261004_proj_1_11a2_circuitos.sql
-- Fase 1.11 parte A2 - transferencias internas (neutras) com rotulo de circuito, nas duas pontas (saida e entrada).
BEGIN;
ALTER TABLE proj_extrato_decisoes ADD COLUMN IF NOT EXISTS circuito varchar(80);
ALTER TABLE proj_extrato_decisoes DROP CONSTRAINT IF EXISTS proj_extrato_decisoes_circuito_ck;
ALTER TABLE proj_extrato_decisoes ADD CONSTRAINT proj_extrato_decisoes_circuito_ck CHECK (decisao <> 'TRANSFERENCIA_INTERNA' OR circuito IS NOT NULL) NOT VALID;
CREATE OR REPLACE FUNCTION proj_extrato_decisoes_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF OLD.cancelado_em IS NOT NULL OR NEW.cancelado_em IS NULL
     OR NEW.operacao_id IS DISTINCT FROM OLD.operacao_id OR NEW.bank_transaction_id IS DISTINCT FROM OLD.bank_transaction_id
     OR NEW.decisao IS DISTINCT FROM OLD.decisao OR NEW.circuito IS DISTINCT FROM OLD.circuito OR NEW.motivo IS DISTINCT FROM OLD.motivo
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Decisao sobre extrato e imutavel: so pode ser encerrada, com motivo';
  END IF;
  IF NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10 THEN
    RAISE EXCEPTION 'Encerramento de decisao exige motivo (minimo 10 caracteres)';
  END IF;
  RETURN NEW;
END $$;
INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, action_type, resource)
SELECT '/app/projetos/circuitos', 'Circuitos neutros', 'projetos', 'FiRepeat', g.id, 4, 'link', 'proj-circuitos'
FROM sidebar_items g WHERE g.path = '/app/projetos' AND NOT EXISTS (SELECT 1 FROM sidebar_items WHERE path = '/app/projetos/circuitos');
COMMIT;
SELECT decisao, count(*) AS vigentes, count(circuito) AS com_circuito FROM proj_extrato_decisoes WHERE cancelado_em IS NULL GROUP BY 1;