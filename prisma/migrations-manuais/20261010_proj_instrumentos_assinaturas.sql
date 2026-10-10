-- prisma/migrations-manuais/20261010_proj_instrumentos_assinaturas.sql
-- Etapa 3 dos instrumentos do plano: envios para assinatura (ClickSign), assinaturas por parte e validacoes de PDF assinado.
-- Tudo entra na trilha encadeada; o instrumento nao sai de Em assinatura com envio aberto.
BEGIN;
SELECT set_config('app.user_id', (SELECT id::text FROM users WHERE email = 'hpontes@ledgr.com'), true);

CREATE TABLE IF NOT EXISTS proj_instrumento_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrumento_id uuid NOT NULL REFERENCES proj_instrumentos(id),
  versao_id uuid NOT NULL REFERENCES proj_instrumento_versoes(id),
  canal varchar(12) NOT NULL CHECK (canal IN ('CLICKSIGN')),
  chave_externa varchar(80) NOT NULL,
  situacao varchar(12) NOT NULL DEFAULT 'ENVIADO' CHECK (situacao IN ('ENVIADO','CONCLUIDO','CANCELADO')),
  prazo timestamp(6),
  concluido_em timestamp(6),
  versao_assinada_id uuid REFERENCES proj_instrumento_versoes(id),
  ultima_consulta_em timestamp(6),
  ultima_resposta jsonb,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_instr_envio_ativo_uq ON proj_instrumento_envios (instrumento_id) WHERE situacao = 'ENVIADO';

CREATE TABLE IF NOT EXISTS proj_instrumento_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id uuid NOT NULL REFERENCES proj_instrumento_envios(id),
  parte_id uuid NOT NULL REFERENCES proj_instrumento_partes(id),
  email varchar(200) NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  chave_signatario varchar(80),
  chave_lista varchar(80),
  situacao varchar(12) NOT NULL DEFAULT 'PENDENTE' CHECK (situacao IN ('PENDENTE','ASSINADO','RECUSADO')),
  assinado_em timestamp(6),
  evidencia jsonb,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proj_instrumento_validacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrumento_id uuid NOT NULL REFERENCES proj_instrumentos(id),
  versao_id uuid NOT NULL REFERENCES proj_instrumento_versoes(id),
  valido boolean NOT NULL,
  qtd_assinaturas integer NOT NULL,
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  resultado jsonb NOT NULL,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user()
);

ALTER TABLE proj_instrumento_eventos DROP CONSTRAINT IF EXISTS proj_instrumento_eventos_tipo_check;
ALTER TABLE proj_instrumento_eventos ADD CONSTRAINT proj_instrumento_eventos_tipo_check CHECK (tipo IN (
  'CRIADO','EDITADO','SITUACAO','VERSAO','VERSAO_ENCERRADO','PARTE','PARTE_ENCERRADO','DEPENDENCIA','DEPENDENCIA_ENCERRADO',
  'REGISTRO','REGISTRO_ENCERRADO','VALOR','VALOR_ENCERRADO','VALOR_CONGELADO','COMENTARIO',
  'ENVIO_ASSINATURA','ENVIO_CONCLUIDO','ENVIO_CANCELADO','ASSINATURA_PARTE','VALIDACAO'));

-- ---------- validacoes de integridade ----------
CREATE OR REPLACE FUNCTION proj_instr_envios_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.situacao <> 'ENVIADO' THEN RAISE EXCEPTION 'Envio nasce como ENVIADO'; END IF;
    IF NOT EXISTS (SELECT 1 FROM proj_instrumentos i WHERE i.id = NEW.instrumento_id AND i.situacao = 'EM_ASSINATURA') THEN
      RAISE EXCEPTION 'Envio para assinatura so com o instrumento Em assinatura';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.instrumento_id IS DISTINCT FROM OLD.instrumento_id OR NEW.versao_id IS DISTINCT FROM OLD.versao_id
     OR NEW.canal IS DISTINCT FROM OLD.canal OR NEW.chave_externa IS DISTINCT FROM OLD.chave_externa
     OR NEW.prazo IS DISTINCT FROM OLD.prazo OR NEW.criado_em IS DISTINCT FROM OLD.criado_em
     OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Dados do envio sao imutaveis';
  END IF;
  IF OLD.situacao <> 'ENVIADO' THEN RAISE EXCEPTION 'Envio encerrado nao pode ser alterado'; END IF;
  IF NEW.situacao = 'CANCELADO' AND length(trim(coalesce(NEW.motivo_cancelamento, ''))) < 10 THEN
    RAISE EXCEPTION 'Cancelamento do envio exige motivo (minimo 10 caracteres)';
  END IF;
  IF NEW.situacao = 'CONCLUIDO' AND NEW.versao_assinada_id IS NULL THEN
    RAISE EXCEPTION 'Conclusao do envio exige a versao assinada';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_instr_envios_validar_trg ON proj_instrumento_envios;
CREATE TRIGGER proj_instr_envios_validar_trg BEFORE INSERT OR UPDATE ON proj_instrumento_envios FOR EACH ROW EXECUTE FUNCTION proj_instr_envios_validar();

CREATE OR REPLACE FUNCTION proj_instr_assinaturas_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.situacao <> 'PENDENTE' THEN RAISE EXCEPTION 'Assinatura nasce PENDENTE'; END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'situacao' - 'assinado_em' - 'evidencia') <> (to_jsonb(OLD) - 'situacao' - 'assinado_em' - 'evidencia') THEN
    RAISE EXCEPTION 'Dados da assinatura sao imutaveis';
  END IF;
  IF OLD.situacao <> 'PENDENTE' THEN RAISE EXCEPTION 'Assinatura ja registrada'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_instr_assinaturas_validar_trg ON proj_instrumento_assinaturas;
CREATE TRIGGER proj_instr_assinaturas_validar_trg BEFORE INSERT OR UPDATE ON proj_instrumento_assinaturas FOR EACH ROW EXECUTE FUNCTION proj_instr_assinaturas_validar();

CREATE OR REPLACE FUNCTION proj_instr_validacoes_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Validacao registrada e imutavel';
END $$;
DROP TRIGGER IF EXISTS proj_instr_validacoes_imutavel_trg ON proj_instrumento_validacoes;
CREATE TRIGGER proj_instr_validacoes_imutavel_trg BEFORE UPDATE OR DELETE ON proj_instrumento_validacoes FOR EACH ROW EXECUTE FUNCTION proj_instr_validacoes_imutavel();

CREATE OR REPLACE FUNCTION proj_instr_envio_guarda() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.situacao = 'EM_ASSINATURA' AND NEW.situacao IS DISTINCT FROM OLD.situacao
     AND EXISTS (SELECT 1 FROM proj_instrumento_envios e WHERE e.instrumento_id = NEW.id AND e.situacao = 'ENVIADO') THEN
    RAISE EXCEPTION 'Ha um envio de assinatura em andamento: atualize ate concluir ou cancele o envio antes';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_instrumentos_envio_guarda_trg ON proj_instrumentos;
CREATE TRIGGER proj_instrumentos_envio_guarda_trg BEFORE UPDATE ON proj_instrumentos FOR EACH ROW EXECUTE FUNCTION proj_instr_envio_guarda();

-- ---------- eventos na trilha ----------
CREATE OR REPLACE FUNCTION proj_instr_envios_evento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM proj_instr_evento(NEW.instrumento_id, 'ENVIO_ASSINATURA', NULL, NULL, NEW.id,
      jsonb_build_object('canal', NEW.canal, 'chave', NEW.chave_externa, 'prazo', NEW.prazo, 'versao_id', NEW.versao_id), NULL);
  ELSIF NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    PERFORM proj_instr_evento(NEW.instrumento_id, CASE NEW.situacao WHEN 'CONCLUIDO' THEN 'ENVIO_CONCLUIDO' ELSE 'ENVIO_CANCELADO' END,
      NULL, NULL, NEW.id, jsonb_build_object('canal', NEW.canal, 'chave', NEW.chave_externa, 'versao_assinada_id', NEW.versao_assinada_id),
      NEW.motivo_cancelamento);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS proj_instr_envios_evento_trg ON proj_instrumento_envios;
CREATE TRIGGER proj_instr_envios_evento_trg AFTER INSERT OR UPDATE ON proj_instrumento_envios FOR EACH ROW EXECUTE FUNCTION proj_instr_envios_evento();

CREATE OR REPLACE FUNCTION proj_instr_assinaturas_evento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_inst uuid; v_nome text;
BEGIN
  IF NEW.situacao IS NOT DISTINCT FROM OLD.situacao THEN RETURN NULL; END IF;
  SELECT e.instrumento_id INTO v_inst FROM proj_instrumento_envios e WHERE e.id = NEW.envio_id;
  SELECT p.nome INTO v_nome FROM proj_instrumento_partes p WHERE p.id = NEW.parte_id;
  PERFORM proj_instr_evento(v_inst, 'ASSINATURA_PARTE', NULL, NULL, NEW.id,
    jsonb_build_object('nome', v_nome, 'email', NEW.email, 'situacao', NEW.situacao, 'assinado_em', NEW.assinado_em, 'envio_id', NEW.envio_id), NULL);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS proj_instr_assinaturas_evento_trg ON proj_instrumento_assinaturas;
CREATE TRIGGER proj_instr_assinaturas_evento_trg AFTER UPDATE ON proj_instrumento_assinaturas FOR EACH ROW EXECUTE FUNCTION proj_instr_assinaturas_evento();

CREATE OR REPLACE FUNCTION proj_instr_validacoes_evento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM proj_instr_evento(NEW.instrumento_id, 'VALIDACAO', NULL, NULL, NEW.id,
    jsonb_build_object('valido', NEW.valido, 'assinaturas', NEW.qtd_assinaturas, 'sha256', NEW.sha256, 'versao_id', NEW.versao_id,
      'signatarios', (SELECT jsonb_agg(x->>'nome') FROM jsonb_array_elements(COALESCE(NEW.resultado->'assinaturas', '[]'::jsonb)) x)), NULL);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS proj_instr_validacoes_evento_trg ON proj_instrumento_validacoes;
CREATE TRIGGER proj_instr_validacoes_evento_trg AFTER INSERT ON proj_instrumento_validacoes FOR EACH ROW EXECUTE FUNCTION proj_instr_validacoes_evento();

-- ---------- RLS ----------
ALTER TABLE proj_instrumento_envios ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_instrumento_envios FORCE ROW LEVEL SECURITY;
ALTER TABLE proj_instrumento_assinaturas ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_instrumento_assinaturas FORCE ROW LEVEL SECURITY;
ALTER TABLE proj_instrumento_validacoes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_instrumento_validacoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_instr_envios_ler ON proj_instrumento_envios;
DROP POLICY IF EXISTS proj_instr_envios_gravar ON proj_instrumento_envios;
DROP POLICY IF EXISTS proj_instr_assinaturas_ler ON proj_instrumento_assinaturas;
DROP POLICY IF EXISTS proj_instr_assinaturas_gravar ON proj_instrumento_assinaturas;
DROP POLICY IF EXISTS proj_instr_validacoes_ler ON proj_instrumento_validacoes;
DROP POLICY IF EXISTS proj_instr_validacoes_gravar ON proj_instrumento_validacoes;
CREATE POLICY proj_instr_envios_ler ON proj_instrumento_envios FOR SELECT USING (EXISTS (SELECT 1 FROM proj_instrumentos i WHERE i.id = instrumento_id));
CREATE POLICY proj_instr_envios_gravar ON proj_instrumento_envios FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
CREATE POLICY proj_instr_assinaturas_ler ON proj_instrumento_assinaturas FOR SELECT USING (EXISTS (SELECT 1 FROM proj_instrumento_envios e WHERE e.id = envio_id));
CREATE POLICY proj_instr_assinaturas_gravar ON proj_instrumento_assinaturas FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
CREATE POLICY proj_instr_validacoes_ler ON proj_instrumento_validacoes FOR SELECT USING (EXISTS (SELECT 1 FROM proj_instrumentos i WHERE i.id = instrumento_id));
CREATE POLICY proj_instr_validacoes_gravar ON proj_instrumento_validacoes FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());

GRANT SELECT, INSERT, UPDATE ON proj_instrumento_envios, proj_instrumento_assinaturas TO ledgr_api;
GRANT SELECT, INSERT ON proj_instrumento_validacoes TO ledgr_api;
REVOKE UPDATE ON proj_instrumento_validacoes FROM ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_instrumento_envios, proj_instrumento_assinaturas, proj_instrumento_validacoes FROM ledgr_api;
COMMIT;
SELECT 'envios' AS tabela, count(*) FROM proj_instrumento_envios UNION ALL SELECT 'assinaturas', count(*) FROM proj_instrumento_assinaturas
UNION ALL SELECT 'validacoes', count(*) FROM proj_instrumento_validacoes;
