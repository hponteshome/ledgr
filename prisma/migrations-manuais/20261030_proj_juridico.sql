-- prisma/migrations-manuais/20261030_proj_juridico.sql
-- Juridico RM (30/10/2026): processos, remessas (protocolos Citius), documentos do indice, arquivos protocolados
-- (imutaveis, por SHA-256, so encerrados com motivo) e prazos. Leitura: 'ver' ou 'revisar' no projeto. Escrita: Master.
BEGIN;
SELECT set_config('app.user_id', (SELECT id::text FROM users WHERE email = 'hpontes@ledgr.com'), true);

CREATE TABLE IF NOT EXISTS proj_jur_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES proj_projetos(id),
  codigo varchar(20) NOT NULL,
  numero varchar(60) NOT NULL,
  tribunal varchar(200),
  juizo varchar(200),
  natureza varchar(300),
  partes text,
  mandatarios text,
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text,
  UNIQUE (projeto_id, codigo)
);

CREATE TABLE IF NOT EXISTS proj_jur_remessas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES proj_jur_processos(id),
  ordem integer NOT NULL CHECK (ordem >= 1),
  data_protocolo date NOT NULL,
  ref_citius varchar(30),
  situacao varchar(20) NOT NULL CHECK (situacao IN ('PROTOCOLADA','REF_PENDENTE')),
  descricao text NOT NULL,
  comprovativo_nome varchar(255), comprovativo_mime varchar(120), comprovativo_tamanho integer,
  comprovativo_sha256 char(64) CHECK (comprovativo_sha256 IS NULL OR comprovativo_sha256 ~ '^[0-9a-f]{64}$'),
  comprovativo_chave varchar(200),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text,
  UNIQUE (processo_id, ordem),
  CHECK ((situacao = 'REF_PENDENTE') = (ref_citius IS NULL))
);

CREATE TABLE IF NOT EXISTS proj_jur_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES proj_jur_processos(id),
  numero varchar(30) NOT NULL,
  sub varchar(10) NOT NULL DEFAULT '',
  ordem numeric(8,2) NOT NULL,
  titulo varchar(300) NOT NULL,
  situacao varchar(20) NOT NULL CHECK (situacao IN ('JUNTO','SUBSTITUIDO','SEM_EFEITO','A_JUNTAR')),
  situacao_motivo text,
  prazo date,
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text,
  UNIQUE (processo_id, numero, sub)
);

CREATE TABLE IF NOT EXISTS proj_jur_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES proj_jur_documentos(id),
  remessa_id uuid NOT NULL REFERENCES proj_jur_remessas(id),
  posicao_citius varchar(60),
  versao integer NOT NULL DEFAULT 1 CHECK (versao >= 1),
  arquivo_nome varchar(255) NOT NULL,
  nome_origem varchar(400),
  mime varchar(120),
  tamanho integer NOT NULL CHECK (tamanho > 0),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  chave_armazenamento varchar(200) NOT NULL,
  substitui_arquivo_id uuid REFERENCES proj_jur_arquivos(id),
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_jur_arquivos_uq ON proj_jur_arquivos (documento_id, remessa_id, sha256) WHERE cancelado_em IS NULL;
CREATE INDEX IF NOT EXISTS proj_jur_arquivos_doc_idx ON proj_jur_arquivos (documento_id);

CREATE TABLE IF NOT EXISTS proj_jur_prazos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES proj_jur_processos(id),
  descricao text NOT NULL,
  data_limite date NOT NULL,
  situacao varchar(20) NOT NULL DEFAULT 'ABERTO' CHECK (situacao IN ('ABERTO','CUMPRIDO','DISPENSADO')),
  cumprido_remessa_id uuid REFERENCES proj_jur_remessas(id),
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  atualizado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- regras de imutabilidade ----------
CREATE OR REPLACE FUNCTION proj_jur_arquivos_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_n jsonb := to_jsonb(NEW); v_o jsonb := to_jsonb(OLD);
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Arquivo protocolado nao pode ser apagado (encerre com motivo)'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Registro novo nao pode nascer encerrado'; END IF;
    NEW.criado_por_id := COALESCE(NEW.criado_por_id, proj_ctx_user());
    RETURN NEW;
  END IF;
  IF OLD.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Arquivo ja encerrado'; END IF;
  IF NEW.cancelado_em IS NULL OR (v_n - 'cancelado_em' - 'cancelado_por_id' - 'motivo_cancelamento') <> (v_o - 'cancelado_em' - 'cancelado_por_id' - 'motivo_cancelamento') THEN
    RAISE EXCEPTION 'Arquivo protocolado e imutavel: so pode ser encerrado, com motivo';
  END IF;
  IF length(trim(coalesce(NEW.motivo_cancelamento, ''))) < 10 THEN RAISE EXCEPTION 'Encerramento exige motivo (minimo 10 caracteres)'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_jur_arquivos_validar_trg ON proj_jur_arquivos;
CREATE TRIGGER proj_jur_arquivos_validar_trg BEFORE INSERT OR UPDATE OR DELETE ON proj_jur_arquivos FOR EACH ROW EXECUTE FUNCTION proj_jur_arquivos_validar();

CREATE OR REPLACE FUNCTION proj_jur_remessas_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_n jsonb := to_jsonb(NEW); v_o jsonb := to_jsonb(OLD);
  v_livres text[] := ARRAY['ref_citius','situacao','comprovativo_nome','comprovativo_mime','comprovativo_tamanho','comprovativo_sha256','comprovativo_chave'];
  v_k text;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Remessa nao pode ser apagada (encerre com motivo)'; END IF;
  IF TG_OP = 'INSERT' THEN NEW.criado_por_id := COALESCE(NEW.criado_por_id, proj_ctx_user()); RETURN NEW; END IF;
  IF OLD.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Remessa ja encerrada'; END IF;
  IF NEW.cancelado_em IS NOT NULL THEN
    IF (v_n - 'cancelado_em' - 'cancelado_por_id' - 'motivo_cancelamento') <> (v_o - 'cancelado_em' - 'cancelado_por_id' - 'motivo_cancelamento') THEN
      RAISE EXCEPTION 'Encerramento nao altera outros campos'; END IF;
    IF length(trim(coalesce(NEW.motivo_cancelamento, ''))) < 10 THEN RAISE EXCEPTION 'Encerramento exige motivo (minimo 10 caracteres)'; END IF;
    RETURN NEW;
  END IF;
  -- fora o encerramento, so se completa o que estava vazio: referencia Citius pendente e comprovativo
  FOREACH v_k IN ARRAY v_livres LOOP v_n := v_n - v_k; v_o := v_o - v_k; END LOOP;
  IF v_n <> v_o THEN RAISE EXCEPTION 'Remessa protocolada e imutavel (so se completa a referencia ou o comprovativo)'; END IF;
  IF OLD.ref_citius IS NOT NULL AND NEW.ref_citius IS DISTINCT FROM OLD.ref_citius THEN RAISE EXCEPTION 'Referencia Citius ja informada'; END IF;
  IF OLD.comprovativo_sha256 IS NOT NULL AND NEW.comprovativo_sha256 IS DISTINCT FROM OLD.comprovativo_sha256 THEN RAISE EXCEPTION 'Comprovativo ja informado'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_jur_remessas_validar_trg ON proj_jur_remessas;
CREATE TRIGGER proj_jur_remessas_validar_trg BEFORE INSERT OR UPDATE OR DELETE ON proj_jur_remessas FOR EACH ROW EXECUTE FUNCTION proj_jur_remessas_validar();

CREATE OR REPLACE FUNCTION proj_jur_documentos_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Documento do indice nao pode ser apagado'; END IF;
  IF TG_OP = 'INSERT' THEN NEW.criado_por_id := COALESCE(NEW.criado_por_id, proj_ctx_user()); RETURN NEW; END IF;
  IF NEW.processo_id IS DISTINCT FROM OLD.processo_id OR NEW.numero IS DISTINCT FROM OLD.numero OR NEW.sub IS DISTINCT FROM OLD.sub THEN
    RAISE EXCEPTION 'Numero do documento e imutavel'; END IF;
  IF NEW.situacao IS DISTINCT FROM OLD.situacao AND length(trim(coalesce(NEW.situacao_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Mudanca de situacao exige motivo (minimo 10 caracteres)'; END IF;
  NEW.atualizado_em := clock_timestamp();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_jur_documentos_validar_trg ON proj_jur_documentos;
CREATE TRIGGER proj_jur_documentos_validar_trg BEFORE INSERT OR UPDATE OR DELETE ON proj_jur_documentos FOR EACH ROW EXECUTE FUNCTION proj_jur_documentos_validar();

-- ---------- RLS ----------
ALTER TABLE proj_jur_processos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_jur_processos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_jur_processos_ler ON proj_jur_processos;
DROP POLICY IF EXISTS proj_jur_processos_gravar ON proj_jur_processos;
CREATE POLICY proj_jur_processos_ler ON proj_jur_processos FOR SELECT USING (proj_tem_acao(projeto_id, 'ver') OR proj_tem_acao(projeto_id, 'revisar'));
CREATE POLICY proj_jur_processos_gravar ON proj_jur_processos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['proj_jur_remessas','proj_jur_documentos','proj_jur_prazos'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_ler', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (EXISTS (SELECT 1 FROM proj_jur_processos p WHERE p.id = processo_id))', t || '_ler', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_gravar', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master())', t || '_gravar', t);
  END LOOP;
END $$;
ALTER TABLE proj_jur_arquivos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_jur_arquivos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_jur_arquivos_ler ON proj_jur_arquivos;
DROP POLICY IF EXISTS proj_jur_arquivos_gravar ON proj_jur_arquivos;
CREATE POLICY proj_jur_arquivos_ler ON proj_jur_arquivos FOR SELECT USING (EXISTS (SELECT 1 FROM proj_jur_documentos d WHERE d.id = documento_id));
CREATE POLICY proj_jur_arquivos_gravar ON proj_jur_arquivos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
GRANT SELECT, INSERT, UPDATE ON proj_jur_processos, proj_jur_remessas, proj_jur_documentos, proj_jur_arquivos, proj_jur_prazos TO ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_jur_processos, proj_jur_remessas, proj_jur_documentos, proj_jur_arquivos, proj_jur_prazos FROM ledgr_api;

-- ---------- carga: processo, remessas e prazos ----------
DO $$
DECLARE v_proj uuid; v_proc uuid; v_r3 uuid;
BEGIN
  SELECT id INTO v_proj FROM proj_projetos WHERE codigo = 'RECIFE-OCEAN' AND cancelado_em IS NULL;
  IF v_proj IS NULL THEN RAISE EXCEPTION 'Projeto RECIFE-OCEAN nao encontrado'; END IF;
  INSERT INTO proj_jur_processos (projeto_id, codigo, numero, tribunal, juizo, natureza, partes, mandatarios)
  VALUES (v_proj, 'RM-1419', '1419/26.2T8STR-C', 'Tribunal Judicial da Comarca de Santarém', 'Juízo de Comércio de Santarém - Juiz 3',
    'Apenso de Verificação e Graduação de Créditos - Insolvência de Real Mouchão Lombo do Tejo, Sociedade Agropecuária, S.A. (NIPC 503 382 582)',
    'Impugnante: F5 Participações S/A. Insolvente: Real Mouchão Lombo do Tejo, Sociedade Agropecuária, S.A.',
    'António Carneiro Pacheco (Céd. Prof. n.º 9434L); Tomás Alvim Almas (Advogado Estagiário)')
  ON CONFLICT (projeto_id, codigo) DO NOTHING;
  SELECT id INTO v_proc FROM proj_jur_processos WHERE projeto_id = v_proj AND codigo = 'RM-1419';
  INSERT INTO proj_jur_remessas (processo_id, ordem, data_protocolo, ref_citius, situacao, descricao)
  SELECT v_proc, x.ordem, x.dt, x.ref, x.sit, x.descr FROM (VALUES
    (1, DATE '2026-10-23', '58007275'::varchar, 'PROTOCOLADA'::varchar, 'Requerimento da Impugnante e documentos (1.ª remessa)'::text),
    (2, DATE '2026-10-23', '58008395', 'PROTOCOLADA', 'Requerimento complementar e documentos (completa a ref. 58007275)'),
    (3, DATE '2026-10-30', NULL, 'REF_PENDENTE', 'Requerimento de retificação e junção de documentos: Fls. 9 e 10 substitutas, Doc. 8 retificado e Docs. 12 (parte), 13, 14, 16 a 20 e 22')
  ) AS x(ordem, dt, ref, sit, descr)
  WHERE NOT EXISTS (SELECT 1 FROM proj_jur_remessas r WHERE r.processo_id = v_proc AND r.ordem = x.ordem);
  SELECT id INTO v_r3 FROM proj_jur_remessas WHERE processo_id = v_proc AND ordem = 3;
  INSERT INTO proj_jur_prazos (processo_id, descricao, data_limite, observacao)
  SELECT v_proc, x.d, DATE '2026-11-14', 'Prazo de 15 dias contado do requerimento de 30/10/2026; 14/11/2026 é sábado - confirmar a contagem com o advogado.'
  FROM (VALUES
    ('Juntar os comprovativos bancários das linhas 3, 5, 9, 11 e 14 do Quadro 2 do Doc. 8, de R$ 15.000,00 da linha 7 e de R$ 743,31 da linha 2 - total R$ 279.587,17 (art. 3.º-A)'::text),
    ('Juntar a procuração de Helenilto Aureliano Pontes como Doc. 26 (art. 10.º-B)')
  ) AS x(d)
  WHERE NOT EXISTS (SELECT 1 FROM proj_jur_prazos p WHERE p.processo_id = v_proc AND p.descricao = x.d);
END $$;
COMMIT;

SELECT p.codigo, p.numero, (SELECT count(*) FROM proj_jur_remessas r WHERE r.processo_id = p.id) AS remessas,
       (SELECT count(*) FROM proj_jur_prazos z WHERE z.processo_id = p.id) AS prazos
FROM proj_jur_processos p;
SELECT ordem, data_protocolo, coalesce(ref_citius, '(pendente)') AS ref, situacao FROM proj_jur_remessas ORDER BY ordem;