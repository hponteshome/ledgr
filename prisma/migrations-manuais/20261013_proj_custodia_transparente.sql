-- prisma/migrations-manuais/20261013_proj_custodia_transparente.sql
-- Custodia transparente (13/10/2026): a classificacao do Anexo V passa a aceitar o pagamento direto validado da custodia
-- (custodia_lancamento_id; exatamente um alvo por vinculo) e entra a natureza Transacao PGFN - Solsys (despesa da Hotelsys,
-- nao baixa passivo). O PEPS, o Fluxo e a tela do Anexo V foram ajustados no mesmo commit.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE proj_aplicacao_anexo_v ALTER COLUMN aplicacao_id DROP NOT NULL;
ALTER TABLE proj_aplicacao_anexo_v ADD COLUMN IF NOT EXISTS custodia_lancamento_id uuid REFERENCES proj_custodia_lancamentos(id);
ALTER TABLE proj_aplicacao_anexo_v DROP CONSTRAINT IF EXISTS proj_aplicacao_anexo_v_alvo_ck;
ALTER TABLE proj_aplicacao_anexo_v ADD CONSTRAINT proj_aplicacao_anexo_v_alvo_ck CHECK ((aplicacao_id IS NULL) <> (custodia_lancamento_id IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS proj_aplicacao_anexo_v_custodia_vigente_uq ON proj_aplicacao_anexo_v (custodia_lancamento_id)
  WHERE cancelado_em IS NULL AND custodia_lancamento_id IS NOT NULL;

CREATE OR REPLACE FUNCTION proj_aplicacao_anexo_v_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a record; i record; op uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.cancelado_em IS NOT NULL OR ROW(NEW.aplicacao_id, NEW.custodia_lancamento_id, NEW.item_id, NEW.fora_anexo, NEW.consta_reconciliacao, NEW.motivo)
       IS DISTINCT FROM ROW(OLD.aplicacao_id, OLD.custodia_lancamento_id, OLD.item_id, OLD.fora_anexo, OLD.consta_reconciliacao, OLD.motivo) THEN
      RAISE EXCEPTION 'Anexo V: o vinculo e imutavel; so pode ser encerrado (com motivo)'; END IF;
    IF NEW.cancelado_em IS NOT NULL AND COALESCE(length(trim(NEW.motivo_cancelamento)), 0) < 10 THEN
      RAISE EXCEPTION 'Anexo V: o encerramento do vinculo exige motivo'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.aplicacao_id IS NOT NULL THEN
    SELECT * INTO a FROM proj_aplicacoes WHERE id = NEW.aplicacao_id;
    IF a.id IS NULL OR a.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Anexo V: a aplicacao precisa estar vigente'; END IF;
    op := a.operacao_id;
  ELSE
    SELECT l.id, l.tipo, l.situacao, l.cancelado_em, cu.operacao_id INTO a
      FROM proj_custodia_lancamentos l JOIN proj_custodias cu ON cu.id = l.custodia_id WHERE l.id = NEW.custodia_lancamento_id;
    IF a.id IS NULL OR a.cancelado_em IS NOT NULL OR a.tipo <> 'PAGAMENTO_DIRETO' OR a.situacao <> 'VALIDADO' THEN
      RAISE EXCEPTION 'Anexo V: o pagamento direto da custodia precisa estar validado e vigente'; END IF;
    op := a.operacao_id;
  END IF;
  IF NEW.item_id IS NOT NULL THEN
    SELECT * INTO i FROM proj_anexo_v_itens WHERE id = NEW.item_id;
    IF i.operacao_id <> op THEN RAISE EXCEPTION 'Anexo V: item e lancamento precisam ser da mesma operacao'; END IF;
  END IF;
  RETURN NEW;
END $$;

INSERT INTO proj_naturezas_aplicacao (id, codigo, nome, tipo, paga_passivo, ativo, criado_em)
SELECT gen_random_uuid(), 'TRANSACAO_PGFN_SOLSYS', U&'Transa\00e7\00e3o PGFN - Solsys', 'APLICACAO', false, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM proj_naturezas_aplicacao WHERE codigo = 'TRANSACAO_PGFN_SOLSYS');
COMMIT;