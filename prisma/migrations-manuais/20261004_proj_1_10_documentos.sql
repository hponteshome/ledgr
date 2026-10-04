-- prisma/migrations-manuais/20261004_proj_1_10_documentos.sql
-- Fase 1.10 - documentos do projeto: arquivos fora de pasta publica, enderecados por SHA-256; registros imutaveis.
BEGIN;
CREATE TABLE IF NOT EXISTS proj_documento_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(30) NOT NULL UNIQUE,
  nome varchar(120) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid
);
INSERT INTO proj_documento_tipos (codigo, nome, criado_por_id)
SELECT v.codigo, v.nome, (SELECT id FROM users WHERE email = 'hpontes@ledgr.com')
FROM (VALUES
  ('TERMO', 'Termo, contrato ou aditivo'),
  ('ANEXO', 'Anexo de instrumento'),
  ('SOCIETARIO', 'Documento societário'),
  ('IDENTIFICACAO', 'Identificação de pessoa ou empresa'),
  ('COMPROVANTE', 'Comprovante de pagamento ou transferência'),
  ('CORRESPONDENCIA', 'Correspondência ou notificação'),
  ('LAUDO', 'Laudo, parecer ou relatório'),
  ('OUTRO', 'Outro')
) AS v(codigo, nome)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS proj_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  tipo_id uuid NOT NULL REFERENCES proj_documento_tipos(id),
  titulo varchar(200) NOT NULL,
  descricao text,
  data_documento date,
  credito_id uuid REFERENCES proj_creditos(id),
  contraparte_id uuid REFERENCES proj_contrapartes(id),
  arquivo_nome varchar(255) NOT NULL,
  mime varchar(120),
  tamanho integer NOT NULL CHECK (tamanho > 0),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  chave_armazenamento varchar(200) NOT NULL,
  versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  documento_origem_id uuid REFERENCES proj_documentos(id),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text,
  CONSTRAINT proj_documentos_alvo_ck CHECK (credito_id IS NULL OR contraparte_id IS NULL)
);
CREATE INDEX IF NOT EXISTS proj_documentos_operacao_idx ON proj_documentos (operacao_id);

CREATE OR REPLACE FUNCTION proj_documentos_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF OLD.cancelado_em IS NOT NULL OR NEW.cancelado_em IS NULL
     OR NEW.operacao_id IS DISTINCT FROM OLD.operacao_id OR NEW.tipo_id IS DISTINCT FROM OLD.tipo_id
     OR NEW.titulo IS DISTINCT FROM OLD.titulo OR NEW.descricao IS DISTINCT FROM OLD.descricao
     OR NEW.data_documento IS DISTINCT FROM OLD.data_documento OR NEW.credito_id IS DISTINCT FROM OLD.credito_id
     OR NEW.contraparte_id IS DISTINCT FROM OLD.contraparte_id OR NEW.arquivo_nome IS DISTINCT FROM OLD.arquivo_nome
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.chave_armazenamento IS DISTINCT FROM OLD.chave_armazenamento
     OR NEW.versao IS DISTINCT FROM OLD.versao OR NEW.criado_em IS DISTINCT FROM OLD.criado_em
     OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Documento e imutavel: so pode ser cancelado ou substituido por nova versao, com motivo';
  END IF;
  IF NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10 THEN
    RAISE EXCEPTION 'Cancelamento de documento exige motivo (minimo 10 caracteres)';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_documentos_validar_trg ON proj_documentos;
CREATE TRIGGER proj_documentos_validar_trg BEFORE INSERT OR UPDATE ON proj_documentos FOR EACH ROW EXECUTE FUNCTION proj_documentos_validar();

ALTER TABLE proj_documentos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_documentos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_documentos_ler ON proj_documentos;
DROP POLICY IF EXISTS proj_documentos_inserir ON proj_documentos;
DROP POLICY IF EXISTS proj_documentos_encerrar ON proj_documentos;
CREATE POLICY proj_documentos_ler ON proj_documentos FOR SELECT USING (EXISTS (SELECT 1 FROM proj_operacoes o WHERE o.id = operacao_id));
CREATE POLICY proj_documentos_inserir ON proj_documentos FOR INSERT WITH CHECK (proj_ctx_master());
CREATE POLICY proj_documentos_encerrar ON proj_documentos FOR UPDATE USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
REVOKE DELETE, TRUNCATE ON proj_documentos FROM ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_documento_tipos FROM ledgr_api;
COMMIT;
SELECT codigo, nome FROM proj_documento_tipos ORDER BY nome;