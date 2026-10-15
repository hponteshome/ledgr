-- prisma/migrations-manuais/20261014_proj_aplicacao_rateio.sql
-- Rateio da saida do extrato (14/10/2026): uma saida pode ter varias aplicacoes (partes com natureza e valor proprios), desde
-- que a soma das vigentes nao passe do valor da saida (antes: uma aplicacao por saida, pelo valor cheio). Reclassificar ou
-- ratear = encerrar a aplicacao (imutavel) e criar as partes, na mesma transacao (API). Natureza nova Despesa propria da
-- Sunsys (folha, bancarias e PJ da propria Sunsys): fica fora do E3 do Fluxo (sem mutuo com a Hotelsys).
\set ON_ERROR_STOP on
BEGIN;
DROP INDEX IF EXISTS proj_aplicacoes_transacao_vigente_uq;
CREATE INDEX IF NOT EXISTS proj_aplicacoes_transacao_idx ON proj_aplicacoes (bank_transaction_id) WHERE cancelado_em IS NULL;

CREATE OR REPLACE FUNCTION proj_aplicacoes_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_total numeric;
  v_usado numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT t.amount INTO v_total FROM bank_transactions t
      JOIN proj_participacoes pp ON pp.company_id = t.company_id AND pp.operacao_id = NEW.operacao_id AND pp.cancelado_em IS NULL
      JOIN proj_papeis pa ON pa.id = pp.papel_id AND pa.codigo = 'RECEBEDORA_FINANCEIRA'
      WHERE t.id = NEW.bank_transaction_id AND t.type::text = 'DEBIT' LIMIT 1;
    IF v_total IS NULL THEN
      RAISE EXCEPTION 'A aplicacao precisa ser uma saida na conta da recebedora da operacao';
    END IF;
    IF NEW.valor IS NULL OR NEW.valor <= 0 THEN
      RAISE EXCEPTION 'A aplicacao precisa de valor positivo';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('proj_aplicacao:' || NEW.bank_transaction_id::text));
    SELECT coalesce(sum(a.valor), 0) INTO v_usado FROM proj_aplicacoes a
      WHERE a.bank_transaction_id = NEW.bank_transaction_id AND a.cancelado_em IS NULL;
    IF v_usado + NEW.valor > v_total THEN
      RAISE EXCEPTION 'As aplicacoes da saida passam do valor do extrato (saida %, ja aplicado %, nova parte %)', v_total, v_usado, NEW.valor;
    END IF;
    IF NEW.credito_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM proj_creditos c WHERE c.id = NEW.credito_id AND c.operacao_id = NEW.operacao_id) THEN
      RAISE EXCEPTION 'O credito informado nao pertence a operacao';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.cancelado_em IS NOT NULL OR NEW.cancelado_em IS NULL
     OR NEW.operacao_id IS DISTINCT FROM OLD.operacao_id OR NEW.bank_transaction_id IS DISTINCT FROM OLD.bank_transaction_id
     OR NEW.natureza_id IS DISTINCT FROM OLD.natureza_id OR NEW.valor IS DISTINCT FROM OLD.valor
     OR NEW.data_aplicacao IS DISTINCT FROM OLD.data_aplicacao OR NEW.beneficiario_id IS DISTINCT FROM OLD.beneficiario_id
     OR NEW.credito_id IS DISTINCT FROM OLD.credito_id OR NEW.motivo IS DISTINCT FROM OLD.motivo
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Aplicacao e imutavel: so pode ser encerrada, com motivo';
  END IF;
  IF NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10 THEN
    RAISE EXCEPTION 'Encerramento de aplicacao exige motivo (minimo 10 caracteres)';
  END IF;
  RETURN NEW;
END $$;

INSERT INTO proj_naturezas_aplicacao (id, codigo, nome, tipo, paga_passivo, ativo, criado_em)
SELECT gen_random_uuid(), 'DESPESA_PROPRIA_SUNSYS', U&'Despesa pr\00f3pria da Sunsys (folha, banc\00e1rias, PJ)', 'APLICACAO', false, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM proj_naturezas_aplicacao WHERE codigo = 'DESPESA_PROPRIA_SUNSYS');
COMMIT;