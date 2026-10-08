-- prisma/migrations-manuais/20261008_proj_comprovantes_fiscais.sql
-- Comprovantes fiscais (08/10/2026): DARFs do relatorio de pagamentos da RFB, vinculados as aplicacoes que os pagaram.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS proj_comprovantes_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  tipo varchar(12) NOT NULL CHECK (tipo IN ('DARF')), contribuinte_cnpj varchar(18) NOT NULL, contribuinte_nome varchar(160),
  data_arrecadacao date NOT NULL, receita varchar(10) NOT NULL, numero_documento varchar(30) NOT NULL, periodo_apuracao date,
  principal numeric(18,2) NOT NULL DEFAULT 0, multa numeric(18,2) NOT NULL DEFAULT 0, juros numeric(18,2) NOT NULL DEFAULT 0,
  total numeric(18,2) NOT NULL CHECK (total > 0), arquivo_nome text, arquivo_sha256 char(64),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, criado_por_id uuid, cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text,
  CONSTRAINT proj_comprovantes_total_ck CHECK (total = principal + multa + juros));
CREATE UNIQUE INDEX IF NOT EXISTS proj_comprovantes_doc_uq ON proj_comprovantes_fiscais (tipo, numero_documento) WHERE cancelado_em IS NULL;
CREATE TABLE IF NOT EXISTS proj_comprovante_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), comprovante_id uuid NOT NULL REFERENCES proj_comprovantes_fiscais(id),
  aplicacao_id uuid NOT NULL REFERENCES proj_aplicacoes(id), valor numeric(18,2) NOT NULL CHECK (valor > 0),
  motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, criado_por_id uuid, cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text);
CREATE OR REPLACE FUNCTION proj_comprovante_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.cancelado_em IS NOT NULL OR ROW(NEW.operacao_id, NEW.tipo, NEW.numero_documento, NEW.data_arrecadacao, NEW.receita, NEW.total)
     IS DISTINCT FROM ROW(OLD.operacao_id, OLD.tipo, OLD.numero_documento, OLD.data_arrecadacao, OLD.receita, OLD.total) THEN
    RAISE EXCEPTION 'Comprovante fiscal e imutavel; so pode ser encerrado (com motivo)'; END IF;
  IF NEW.cancelado_em IS NOT NULL AND COALESCE(length(trim(NEW.motivo_cancelamento)), 0) < 10 THEN RAISE EXCEPTION 'Comprovante: encerramento exige motivo'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_comprovante_imutavel_trg ON proj_comprovantes_fiscais;
CREATE TRIGGER proj_comprovante_imutavel_trg BEFORE UPDATE ON proj_comprovantes_fiscais FOR EACH ROW EXECUTE FUNCTION proj_comprovante_imutavel();
CREATE OR REPLACE FUNCTION proj_comprovante_vinc_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record; a record; usado numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.cancelado_em IS NOT NULL OR NEW.comprovante_id IS DISTINCT FROM OLD.comprovante_id OR NEW.aplicacao_id IS DISTINCT FROM OLD.aplicacao_id
       OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.motivo IS DISTINCT FROM OLD.motivo THEN
      RAISE EXCEPTION 'Comprovante: o vinculo e imutavel; so pode ser encerrado (com motivo)'; END IF;
    IF NEW.cancelado_em IS NOT NULL AND COALESCE(length(trim(NEW.motivo_cancelamento)), 0) < 10 THEN RAISE EXCEPTION 'Comprovante: o encerramento do vinculo exige motivo'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO c FROM proj_comprovantes_fiscais WHERE id = NEW.comprovante_id;
  SELECT * INTO a FROM proj_aplicacoes WHERE id = NEW.aplicacao_id;
  IF c.id IS NULL OR c.cancelado_em IS NOT NULL OR a.id IS NULL OR a.cancelado_em IS NOT NULL OR a.operacao_id <> c.operacao_id THEN
    RAISE EXCEPTION 'Comprovante e aplicacao precisam estar vigentes e na mesma operacao'; END IF;
  SELECT COALESCE(sum(valor), 0) INTO usado FROM proj_comprovante_vinculos WHERE comprovante_id = NEW.comprovante_id AND cancelado_em IS NULL;
  IF usado + NEW.valor > c.total THEN RAISE EXCEPTION 'Comprovante: o vinculo excede o valor do documento (disponivel %)', c.total - usado; END IF;
  SELECT COALESCE(sum(valor), 0) INTO usado FROM proj_comprovante_vinculos WHERE aplicacao_id = NEW.aplicacao_id AND cancelado_em IS NULL;
  IF usado + NEW.valor > a.valor THEN RAISE EXCEPTION 'Comprovante: o vinculo excede o valor da aplicacao (disponivel %)', a.valor - usado; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_comprovante_vinc_validar_trg ON proj_comprovante_vinculos;
CREATE TRIGGER proj_comprovante_vinc_validar_trg BEFORE INSERT OR UPDATE ON proj_comprovante_vinculos FOR EACH ROW EXECUTE FUNCTION proj_comprovante_vinc_validar();
ALTER TABLE proj_comprovantes_fiscais ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_comprovantes_fiscais FORCE ROW LEVEL SECURITY;
ALTER TABLE proj_comprovante_vinculos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_comprovante_vinculos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_comprovantes_master ON proj_comprovantes_fiscais;
DROP POLICY IF EXISTS proj_comprovante_vinc_master ON proj_comprovante_vinculos;
CREATE POLICY proj_comprovantes_master ON proj_comprovantes_fiscais FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
CREATE POLICY proj_comprovante_vinc_master ON proj_comprovante_vinculos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
GRANT SELECT, INSERT, UPDATE ON proj_comprovantes_fiscais, proj_comprovante_vinculos TO ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_comprovantes_fiscais, proj_comprovante_vinculos FROM ledgr_api;
COMMIT;