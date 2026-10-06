-- prisma/migrations-manuais/20261006_proj_custodia_etapaA.sql
-- Custodia Josi - Etapa A (06/10/2026): tabelas, decisao CUSTODIA e lote dos envios/devolucoes do extrato da SUNSYS.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS proj_custodias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operacao_id uuid NOT NULL REFERENCES proj_operacoes(id), codigo varchar(40) NOT NULL,
  nome varchar(160) NOT NULL, descricao text, prazo_dias integer NOT NULL DEFAULT 30 CHECK (prazo_dias > 0),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, criado_por_id uuid, cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text);
CREATE UNIQUE INDEX IF NOT EXISTS proj_custodias_codigo_uq ON proj_custodias (operacao_id, codigo) WHERE cancelado_em IS NULL;
CREATE TABLE IF NOT EXISTS proj_custodia_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), custodia_id uuid NOT NULL REFERENCES proj_custodias(id),
  tipo varchar(24) NOT NULL CHECK (tipo IN ('ENVIO', 'DEVOLUCAO', 'PAGAMENTO_DIRETO', 'RECEBIMENTO_TERCEIRO')),
  bank_transaction_id uuid REFERENCES bank_transactions(id), data date NOT NULL, valor numeric(18,2) NOT NULL CHECK (valor > 0),
  natureza_id uuid REFERENCES proj_naturezas_aplicacao(id), favorecido text, descricao text, documento_id uuid,
  situacao varchar(12) NOT NULL DEFAULT 'REGISTRADO' CHECK (situacao IN ('REGISTRADO', 'VALIDADO', 'RECUSADO')),
  validado_por_id uuid, validado_em timestamp(6), motivo_validacao text, motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, criado_por_id uuid, cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text,
  CONSTRAINT proj_custodia_lanc_extrato_ck CHECK ((tipo IN ('ENVIO', 'DEVOLUCAO')) = (bank_transaction_id IS NOT NULL)),
  CONSTRAINT proj_custodia_lanc_natureza_ck CHECK (tipo <> 'PAGAMENTO_DIRETO' OR natureza_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS proj_custodia_lanc_tx_uq ON proj_custodia_lancamentos (bank_transaction_id) WHERE cancelado_em IS NULL AND bank_transaction_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS proj_custodia_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), custodia_id uuid NOT NULL REFERENCES proj_custodias(id),
  origem_id uuid NOT NULL REFERENCES proj_custodia_lancamentos(id), destino_id uuid NOT NULL REFERENCES proj_custodia_lancamentos(id),
  valor numeric(18,2) NOT NULL CHECK (valor > 0),
  situacao varchar(12) NOT NULL DEFAULT 'REGISTRADO' CHECK (situacao IN ('REGISTRADO', 'VALIDADO', 'RECUSADO')),
  validado_por_id uuid, validado_em timestamp(6), motivo_validacao text, motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, criado_por_id uuid, cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text);

CREATE OR REPLACE FUNCTION proj_custodia_lanc_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.bank_transaction_id IS NOT NULL THEN
      SELECT type::text AS tipo, amount, transaction_date::date AS data INTO t FROM bank_transactions WHERE id = NEW.bank_transaction_id;
      IF (NEW.tipo = 'ENVIO' AND t.tipo <> 'DEBIT') OR (NEW.tipo = 'DEVOLUCAO' AND t.tipo <> 'CREDIT') OR t.amount <> NEW.valor OR t.data <> NEW.data THEN
        RAISE EXCEPTION 'Envio/devolucao da custodia precisa bater com o extrato (tipo, valor e data)'; END IF;
    ELSIF NEW.situacao <> 'REGISTRADO' THEN RAISE EXCEPTION 'Lancamento manual da custodia nasce como REGISTRADO e so depois e validado'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Lancamento encerrado e imutavel'; END IF;
  IF NEW.custodia_id IS DISTINCT FROM OLD.custodia_id OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.bank_transaction_id IS DISTINCT FROM OLD.bank_transaction_id
     OR NEW.data IS DISTINCT FROM OLD.data OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.natureza_id IS DISTINCT FROM OLD.natureza_id OR NEW.motivo IS DISTINCT FROM OLD.motivo THEN
    RAISE EXCEPTION 'Lancamento da custodia e imutavel: so pode ser validado, recusado ou encerrado'; END IF;
  IF NEW.cancelado_em IS NOT NULL AND (NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10) THEN RAISE EXCEPTION 'Encerramento exige motivo'; END IF;
  IF NEW.situacao IS DISTINCT FROM OLD.situacao AND (OLD.situacao <> 'REGISTRADO' OR NEW.validado_por_id IS NULL OR (NEW.situacao = 'RECUSADO' AND COALESCE(length(trim(NEW.motivo_validacao)), 0) < 10)) THEN
    RAISE EXCEPTION 'Validacao: so de REGISTRADO para VALIDADO ou RECUSADO (recusa com motivo)'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_custodia_lanc_validar_trg ON proj_custodia_lancamentos;
CREATE TRIGGER proj_custodia_lanc_validar_trg BEFORE INSERT OR UPDATE ON proj_custodia_lancamentos FOR EACH ROW EXECUTE FUNCTION proj_custodia_lanc_validar();

CREATE OR REPLACE FUNCTION proj_custodia_aloc_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o record; d record; usado numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.origem_id IS DISTINCT FROM OLD.origem_id OR NEW.destino_id IS DISTINCT FROM OLD.destino_id OR NEW.valor IS DISTINCT FROM OLD.valor OR OLD.cancelado_em IS NOT NULL) THEN
    RAISE EXCEPTION 'Alocacao e imutavel: so pode ser validada, recusada ou encerrada'; END IF;
  IF NEW.cancelado_em IS NOT NULL OR NEW.situacao = 'RECUSADO' THEN RETURN NEW; END IF;
  SELECT * INTO o FROM proj_custodia_lancamentos WHERE id = NEW.origem_id;
  SELECT * INTO d FROM proj_custodia_lancamentos WHERE id = NEW.destino_id;
  IF o.tipo NOT IN ('ENVIO', 'RECEBIMENTO_TERCEIRO') OR d.tipo NOT IN ('DEVOLUCAO', 'PAGAMENTO_DIRETO') OR o.custodia_id <> NEW.custodia_id OR d.custodia_id <> NEW.custodia_id
     OR o.cancelado_em IS NOT NULL OR d.cancelado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Alocacao: origem (envio ou recebimento de terceiro) e destino (devolucao ou pagamento direto) da mesma custodia, vigentes'; END IF;
  SELECT COALESCE(sum(valor), 0) INTO usado FROM proj_custodia_alocacoes WHERE origem_id = NEW.origem_id AND id <> NEW.id AND cancelado_em IS NULL AND situacao <> 'RECUSADO';
  IF usado + NEW.valor > o.valor THEN RAISE EXCEPTION 'Alocacao excede o valor da origem'; END IF;
  SELECT COALESCE(sum(valor), 0) INTO usado FROM proj_custodia_alocacoes WHERE destino_id = NEW.destino_id AND id <> NEW.id AND cancelado_em IS NULL AND situacao <> 'RECUSADO';
  IF usado + NEW.valor > d.valor THEN RAISE EXCEPTION 'Alocacao excede o valor do destino'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_custodia_aloc_validar_trg ON proj_custodia_alocacoes;
CREATE TRIGGER proj_custodia_aloc_validar_trg BEFORE INSERT OR UPDATE ON proj_custodia_alocacoes FOR EACH ROW EXECUTE FUNCTION proj_custodia_aloc_validar();

ALTER TABLE proj_custodias ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_custodias FORCE ROW LEVEL SECURITY;
ALTER TABLE proj_custodia_lancamentos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_custodia_lancamentos FORCE ROW LEVEL SECURITY;
ALTER TABLE proj_custodia_alocacoes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_custodia_alocacoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_custodias_master ON proj_custodias;
DROP POLICY IF EXISTS proj_custodia_lanc_master ON proj_custodia_lancamentos;
DROP POLICY IF EXISTS proj_custodia_aloc_master ON proj_custodia_alocacoes;
CREATE POLICY proj_custodias_master ON proj_custodias FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
CREATE POLICY proj_custodia_lanc_master ON proj_custodia_lancamentos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
CREATE POLICY proj_custodia_aloc_master ON proj_custodia_alocacoes FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
REVOKE DELETE, TRUNCATE ON proj_custodias, proj_custodia_lancamentos, proj_custodia_alocacoes FROM ledgr_api;

ALTER TABLE proj_extrato_decisoes DROP CONSTRAINT IF EXISTS proj_extrato_decisoes_decisao_check;
ALTER TABLE proj_extrato_decisoes ADD CONSTRAINT proj_extrato_decisoes_decisao_check CHECK (decisao IN ('NAO_PERTENCE', 'TRANSFERENCIA_INTERNA', 'ESTORNO_BANCARIO', 'CUSTODIA'));

-- ---------------- lote
CREATE TEMP TABLE c_ctx ON COMMIT DROP AS
SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') AS master, pp.company_id AS empresa, o.id AS operacao
FROM proj_participacoes pp JOIN proj_papeis pa ON pa.id = pp.papel_id JOIN proj_operacoes o ON o.id = pp.operacao_id
WHERE o.codigo = 'ANCORA' AND pa.codigo = 'RECEBEDORA_FINANCEIRA' AND pp.cancelado_em IS NULL LIMIT 1;
CREATE TEMP TABLE c_mov ON COMMIT DROP AS
SELECT bt.id, CASE bt.type::text WHEN 'DEBIT' THEN 'ENVIO' ELSE 'DEVOLUCAO' END AS tipo, bt.transaction_date::date AS data, bt.amount AS valor,
       COALESCE(NULLIF(trim(split_part(COALESCE(a.texto, ''), '|', 1)), ''), '-') AS categoria
FROM bank_transactions bt JOIN c_ctx x ON x.empresa = bt.company_id LEFT JOIN proj_anotacoes_extrato a ON a.bank_transaction_id = bt.id
WHERE NOT EXISTS (SELECT 1 FROM proj_extrato_decisoes e WHERE e.bank_transaction_id = bt.id AND e.cancelado_em IS NULL AND e.decisao = 'ESTORNO_BANCARIO')
  AND ((bt.type::text = 'DEBIT' AND trim(split_part(COALESCE(a.texto, ''), '|', 1)) IN ('Josi', 'PROTEGER A CONTA'))
    OR (bt.type::text = 'CREDIT' AND (bt.counterparty_name ILIKE 'JOSIVANI%' OR bt.counterparty_name ILIKE 'ALDENIR%' OR trim(split_part(COALESCE(a.texto, ''), '|', 1)) = 'Josi'))
    OR (bt.type::text = 'CREDIT' AND EXISTS (SELECT 1 FROM proj_creditos c JOIN proj_operacoes o ON o.id = c.operacao_id AND o.codigo = 'ANCORA'
                 WHERE c.cancelado_em IS NULL AND c.numero_ordem IN (31, 32, 33, 39, 43, 44, 45, 46)
                   AND c.data_credito = bt.transaction_date::date AND c.valor = bt.amount)));
SELECT tipo, count(*) AS qtd, to_char(sum(valor), 'FM999G999G990D00') AS total FROM c_mov GROUP BY tipo ORDER BY tipo DESC;
DO $$ BEGIN
  IF (SELECT count(*) FROM c_mov WHERE tipo = 'ENVIO') <> 11 OR (SELECT sum(valor) FROM c_mov WHERE tipo = 'ENVIO') <> 555334.00
     OR (SELECT count(*) FROM c_mov WHERE tipo = 'DEVOLUCAO') <> 34 OR (SELECT sum(valor) FROM c_mov WHERE tipo = 'DEVOLUCAO') <> 1139611.04 THEN
    RAISE EXCEPTION 'quantidades/totais diferentes da previa: envios % / %, devolucoes % / %',
      (SELECT count(*) FROM c_mov WHERE tipo = 'ENVIO'), (SELECT sum(valor) FROM c_mov WHERE tipo = 'ENVIO'),
      (SELECT count(*) FROM c_mov WHERE tipo = 'DEVOLUCAO'), (SELECT sum(valor) FROM c_mov WHERE tipo = 'DEVOLUCAO');
  END IF;
END $$;
SELECT 'convertidas: ' || (SELECT count(*) FROM proj_extrato_decisoes d WHERE d.cancelado_em IS NULL AND d.bank_transaction_id IN (SELECT id FROM c_mov)) || ' decisao(oes), '
       || (SELECT count(*) FROM proj_aplicacoes a WHERE a.cancelado_em IS NULL AND a.bank_transaction_id IN (SELECT id FROM c_mov)) || ' aplicacao(oes), '
       || (SELECT count(*) FROM proj_creditos c WHERE c.cancelado_em IS NULL AND c.operacao_id = (SELECT operacao FROM c_ctx) AND c.numero_ordem IN (31, 32, 33, 39, 43, 44, 45, 46)) || ' credito(s)' AS conversao;
UPDATE proj_extrato_decisoes d SET cancelado_em = now(), cancelado_por_id = (SELECT master FROM c_ctx),
  motivo_cancelamento = 'Substituida pela decisao CUSTODIA: movimento da custodia da Josi (Josivani e Aldenir), 06/10/2026.'
WHERE d.cancelado_em IS NULL AND d.bank_transaction_id IN (SELECT id FROM c_mov);
UPDATE proj_aplicacoes a SET cancelado_em = now(), cancelado_por_id = (SELECT master FROM c_ctx),
  motivo_cancelamento = 'Envio a custodia da Josi: a justificativa (pagamento direto) sera registrada na prestacao de contas, 06/10/2026.'
WHERE a.cancelado_em IS NULL AND a.bank_transaction_id IN (SELECT id FROM c_mov);
UPDATE proj_creditos c SET cancelado_em = now(), cancelado_por_id = (SELECT master FROM c_ctx),
  motivo_cancelamento = 'Devolucao da custodia da Josi (nao e aporte do Cliente Ancora), 06/10/2026.'
WHERE c.cancelado_em IS NULL AND c.operacao_id = (SELECT operacao FROM c_ctx) AND c.numero_ordem IN (31, 32, 33, 39, 43, 44, 45, 46);
INSERT INTO proj_custodias (operacao_id, codigo, nome, descricao, prazo_dias, criado_por_id)
SELECT operacao, 'JOSI', 'Custódia Josi (Josivani e Aldenir)',
       'Recursos enviados às contas de Josivani e Aldenir para proteção contra bloqueio judicial; prestação de contas com devoluções, pagamentos diretos e recebimentos de terceiros.', 30, master
FROM c_ctx WHERE NOT EXISTS (SELECT 1 FROM proj_custodias WHERE codigo = 'JOSI' AND cancelado_em IS NULL);
INSERT INTO proj_extrato_decisoes (operacao_id, bank_transaction_id, decisao, motivo, criado_por_id)
SELECT x.operacao, m.id, 'CUSTODIA', 'Custodia da Josi (Josivani e Aldenir): ' || lower(m.tipo) || ' (categoria "' || m.categoria || '" da planilha).', x.master
FROM c_mov m CROSS JOIN c_ctx x;
WITH ins AS (
  INSERT INTO proj_custodia_lancamentos (custodia_id, tipo, bank_transaction_id, data, valor, situacao, validado_por_id, validado_em, motivo, criado_por_id)
  SELECT (SELECT id FROM proj_custodias WHERE codigo = 'JOSI' AND cancelado_em IS NULL), m.tipo, m.id, m.data, m.valor, 'VALIDADO', x.master, now(),
         'Lancamento do extrato da SUNSYS (prova bancaria), categoria "' || m.categoria || '" da planilha.', x.master
  FROM c_mov m CROSS JOIN c_ctx x RETURNING id, tipo, valor, bank_transaction_id)
INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
SELECT gen_random_uuid(), (SELECT master FROM c_ctx), 'PROJ_CUSTODIA_LANCAMENTO_REGISTRADO', ins.id::text,
       jsonb_build_object('custodia', 'JOSI', 'tipo', ins.tipo, 'valor', to_char(ins.valor, 'FM9999999990.00'), 'bankTransactionId', ins.bank_transaction_id, 'lote', 'custodia-josi-20261006'), now()
FROM ins;
SELECT 'envios: ' || to_char(sum(valor) FILTER (WHERE tipo = 'ENVIO'), 'FM999G999G990D00') || ' | devolucoes: ' || to_char(sum(valor) FILTER (WHERE tipo = 'DEVOLUCAO'), 'FM999G999G990D00')
       || ' | devolvido a mais (a justificar): ' || to_char(sum(valor) FILTER (WHERE tipo = 'DEVOLUCAO') - sum(valor) FILTER (WHERE tipo = 'ENVIO'), 'FM999G999G990D00') AS custodia
FROM proj_custodia_lancamentos WHERE cancelado_em IS NULL;
COMMIT;