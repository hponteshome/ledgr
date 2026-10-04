-- prisma/migrations-manuais/20261004_proj_1_11a_aplicacoes.sql
-- Fase 1.11 parte A - aplicacoes de recursos (saidas do extrato ligadas a operacao), naturezas, papel de intermediario,
-- decisao "transferencia interna" e anotacoes da planilha do Financeiro (so apoio, inacessiveis direto pela API).
BEGIN;
INSERT INTO proj_papeis (codigo, nome, descricao, aplica_a, criado_por_id)
SELECT 'INTERMEDIARIO', 'Intermediário do Adquirente', 'Recebe ou repassa recursos em nome do Adquirente (ex.: devoluções)', 'CONTRAPARTE', (SELECT id FROM users WHERE email = 'hpontes@ledgr.com')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS proj_naturezas_aplicacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(30) NOT NULL UNIQUE,
  nome varchar(120) NOT NULL,
  tipo varchar(15) NOT NULL CHECK (tipo IN ('APLICACAO', 'DEVOLUCAO')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO proj_naturezas_aplicacao (codigo, nome, tipo) VALUES
  ('IMPOSTOS', 'Impostos e parcelamentos', 'APLICACAO'),
  ('TRABALHISTA', 'Acordos e verbas trabalhistas', 'APLICACAO'),
  ('HONORARIOS', 'Honorários e serviços', 'APLICACAO'),
  ('SALARIOS', 'Salários e encargos', 'APLICACAO'),
  ('REEMBOLSOS', 'Reembolsos e bloqueios judiciais', 'APLICACAO'),
  ('OUTRAS', 'Outras despesas por conta da beneficiária', 'APLICACAO'),
  ('DEVOLUCAO_ADQUIRENTE', 'Devolução ao Adquirente', 'DEVOLUCAO')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS proj_aplicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  bank_transaction_id uuid NOT NULL REFERENCES bank_transactions(id),
  natureza_id uuid NOT NULL REFERENCES proj_naturezas_aplicacao(id),
  data_aplicacao date NOT NULL,
  valor numeric(18,2) NOT NULL CHECK (valor > 0),
  beneficiario_id uuid REFERENCES proj_contrapartes(id),
  credito_id uuid REFERENCES proj_creditos(id),
  descricao text,
  motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_aplicacoes_transacao_vigente_uq ON proj_aplicacoes (bank_transaction_id) WHERE cancelado_em IS NULL;
CREATE INDEX IF NOT EXISTS proj_aplicacoes_operacao_idx ON proj_aplicacoes (operacao_id);

CREATE OR REPLACE FUNCTION proj_aplicacoes_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM bank_transactions t
      JOIN proj_participacoes pp ON pp.company_id = t.company_id AND pp.operacao_id = NEW.operacao_id AND pp.cancelado_em IS NULL
      JOIN proj_papeis pa ON pa.id = pp.papel_id AND pa.codigo = 'RECEBEDORA_FINANCEIRA'
      WHERE t.id = NEW.bank_transaction_id AND t.type::text = 'DEBIT' AND t.amount = NEW.valor
    ) THEN
      RAISE EXCEPTION 'A aplicacao precisa ser uma saida do mesmo valor, na conta da recebedora da operacao';
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
DROP TRIGGER IF EXISTS proj_aplicacoes_validar_trg ON proj_aplicacoes;
CREATE TRIGGER proj_aplicacoes_validar_trg BEFORE INSERT OR UPDATE ON proj_aplicacoes FOR EACH ROW EXECUTE FUNCTION proj_aplicacoes_validar();
ALTER TABLE proj_aplicacoes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_aplicacoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_aplicacoes_ler ON proj_aplicacoes;
DROP POLICY IF EXISTS proj_aplicacoes_inserir ON proj_aplicacoes;
DROP POLICY IF EXISTS proj_aplicacoes_encerrar ON proj_aplicacoes;
CREATE POLICY proj_aplicacoes_ler ON proj_aplicacoes FOR SELECT USING (EXISTS (SELECT 1 FROM proj_operacoes o WHERE o.id = operacao_id));
CREATE POLICY proj_aplicacoes_inserir ON proj_aplicacoes FOR INSERT WITH CHECK (proj_ctx_master());
CREATE POLICY proj_aplicacoes_encerrar ON proj_aplicacoes FOR UPDATE USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
REVOKE DELETE, TRUNCATE ON proj_aplicacoes FROM ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_naturezas_aplicacao FROM ledgr_api;

ALTER TABLE proj_extrato_decisoes ALTER COLUMN decisao TYPE varchar(30);
ALTER TABLE proj_extrato_decisoes DROP CONSTRAINT IF EXISTS proj_extrato_decisoes_decisao_check;
ALTER TABLE proj_extrato_decisoes ADD CONSTRAINT proj_extrato_decisoes_decisao_check CHECK (decisao IN ('NAO_PERTENCE', 'TRANSFERENCIA_INTERNA'));

-- Anotacoes da planilha do Financeiro: SO apoio a decisao. A API nao le a tabela direto (sem privilegio);
-- so pela funcao, que devolve as anotacoes de UMA empresa (a ativa, ja validada pelo CompanyInterceptor).
CREATE TABLE IF NOT EXISTS proj_anotacoes_extrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id uuid NOT NULL UNIQUE REFERENCES bank_transactions(id),
  texto text NOT NULL,
  arquivo_sha256 char(64),
  carregado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON proj_anotacoes_extrato FROM ledgr_api;
CREATE OR REPLACE FUNCTION proj_anotacoes_da_empresa(p_company uuid)
RETURNS TABLE (bank_transaction_id uuid, texto text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.bank_transaction_id, a.texto FROM proj_anotacoes_extrato a JOIN bank_transactions t ON t.id = a.bank_transaction_id WHERE t.company_id = p_company
$$;
REVOKE ALL ON FUNCTION proj_anotacoes_da_empresa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION proj_anotacoes_da_empresa(uuid) TO ledgr_api;

CREATE OR REPLACE FUNCTION proj_transacoes_destinadas(p_company uuid)
RETURNS TABLE (bank_transaction_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.bank_transaction_id FROM proj_credito_provas p JOIN bank_transactions t ON t.id = p.bank_transaction_id
   WHERE p.cancelado_em IS NULL AND t.company_id = p_company
  UNION
  SELECT d.bank_transaction_id FROM proj_extrato_decisoes d JOIN bank_transactions t ON t.id = d.bank_transaction_id
   WHERE d.cancelado_em IS NULL AND t.company_id = p_company
  UNION
  SELECT ap.bank_transaction_id FROM proj_aplicacoes ap JOIN bank_transactions t ON t.id = ap.bank_transaction_id
   WHERE ap.cancelado_em IS NULL AND t.company_id = p_company
$$;

INSERT INTO sidebar_items (path, label, module, icon, parent_id, ordem, action_type, resource)
SELECT '/app/projetos/saidas', 'Classificar saídas', 'projetos', 'FiTrendingDown', g.id, 3, 'link', 'proj-saidas'
FROM sidebar_items g WHERE g.path = '/app/projetos' AND NOT EXISTS (SELECT 1 FROM sidebar_items WHERE path = '/app/projetos/saidas');
COMMIT;
SELECT codigo, nome, tipo FROM proj_naturezas_aplicacao ORDER BY tipo, nome;