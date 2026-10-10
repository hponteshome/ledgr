-- prisma/migrations-manuais/20261010_proj_instrumentos.sql
-- Instrumentos do plano (contratos, termos, aditivos): ciclo de vida, versoes por SHA-256, partes, dependencias,
-- registros, valores vinculados (congelados na aprovacao) e trilha de eventos encadeada por hash.
-- Perfil REVISOR (acao 'revisar'): le, comenta e envia versoes REVISAO com o instrumento Em revisao.
BEGIN;
SELECT set_config('app.user_id', (SELECT id::text FROM users WHERE email = 'hpontes@ledgr.com'), true);

INSERT INTO proj_perfis (codigo, nome, descricao, acoes, nivel_padrao, criado_por_id)
VALUES ('REVISOR', 'Revisor de instrumentos',
        'Le os instrumentos do plano, comenta e envia versoes revisadas. Nao aprova, nao assina e nao registra.',
        '{revisar}', 'OPERACAO', proj_ctx_user())
ON CONFLICT (codigo) DO NOTHING;

CREATE OR REPLACE FUNCTION proj_tem_acao(p_projeto uuid, p_acao text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT proj_ctx_master() OR EXISTS (
    SELECT 1 FROM proj_concessoes c JOIN proj_perfis pf ON pf.id = c.perfil_id
    WHERE c.user_id = proj_ctx_user() AND c.projeto_id = p_projeto AND c.cancelado_em IS NULL
      AND c.valido_de <= now() AND (c.valido_ate IS NULL OR c.valido_ate > now()) AND pf.ativo
      AND p_acao = ANY (pf.acoes)
  )
$$;

CREATE TABLE IF NOT EXISTS proj_instrumentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES proj_projetos(id),
  codigo varchar(10) NOT NULL,
  ordem integer NOT NULL,
  titulo varchar(200) NOT NULL,
  item_planilha varchar(30),
  tipo varchar(30) NOT NULL CHECK (tipo IN ('CONTRATO','ESCRITURA','ADITIVO','DECLARACAO','ALTERACAO_CONTRATUAL','CLAUSULAS_PLANO','NOTA_EXPLICATIVA','TERMO_REFERENCIA','OUTRO')),
  lei varchar(5) NOT NULL CHECK (lei IN ('BR','PT','BR_PT')),
  requer_assinatura boolean NOT NULL DEFAULT true,
  requer_registro boolean NOT NULL DEFAULT false,
  orgao_registro_previsto varchar(160),
  referencia_minuta text,
  situacao varchar(20) NOT NULL DEFAULT 'RASCUNHO' CHECK (situacao IN ('RASCUNHO','EM_REVISAO','APROVADO','EM_ASSINATURA','ASSINADO','REGISTRADO','VIGENTE','SUBSTITUIDO','ENCERRADO')),
  situacao_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  versao_aprovada_id uuid,
  substituido_por_id uuid REFERENCES proj_instrumentos(id),
  motivo_ultima_transicao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  UNIQUE (projeto_id, codigo)
);

CREATE TABLE IF NOT EXISTS proj_instrumento_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrumento_id uuid NOT NULL REFERENCES proj_instrumentos(id),
  numero integer NOT NULL CHECK (numero >= 1),
  tipo varchar(12) NOT NULL CHECK (tipo IN ('MINUTA','REVISAO','FINAL','ASSINADA')),
  versao_base_id uuid REFERENCES proj_instrumento_versoes(id),
  arquivo_nome varchar(255) NOT NULL,
  mime varchar(120),
  tamanho integer NOT NULL CHECK (tamanho > 0),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  chave_armazenamento varchar(200) NOT NULL,
  comentario text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text,
  UNIQUE (instrumento_id, numero)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proj_instrumentos_versao_aprovada_fk') THEN
    ALTER TABLE proj_instrumentos ADD CONSTRAINT proj_instrumentos_versao_aprovada_fk FOREIGN KEY (versao_aprovada_id) REFERENCES proj_instrumento_versoes(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS proj_instrumento_partes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrumento_id uuid NOT NULL REFERENCES proj_instrumentos(id),
  ordem integer NOT NULL DEFAULT 1,
  nome varchar(200) NOT NULL,
  papel varchar(15) NOT NULL CHECK (papel IN ('PARTE','FIADOR','INTERVENIENTE','CIENCIA','TESTEMUNHA')),
  documento varchar(30),
  email varchar(200),
  jurisdicao varchar(5) CHECK (jurisdicao IN ('BR','PT','OUTRA')),
  forma_assinatura varchar(20) NOT NULL DEFAULT 'A_DEFINIR' CHECK (forma_assinatura IN ('CLICKSIGN','ICP_BRASIL','QUALIFICADA_EU','MANUSCRITA','A_DEFINIR')),
  contraparte_id uuid REFERENCES proj_contrapartes(id),
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);

CREATE TABLE IF NOT EXISTS proj_instrumento_dependencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrumento_id uuid NOT NULL REFERENCES proj_instrumentos(id),
  depende_de_id uuid NOT NULL REFERENCES proj_instrumentos(id),
  exige_situacao varchar(20) NOT NULL DEFAULT 'ASSINADO' CHECK (exige_situacao IN ('APROVADO','ASSINADO','REGISTRADO','VIGENTE')),
  justificativa text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text,
  CHECK (instrumento_id <> depende_de_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_instr_dep_ativa_uq ON proj_instrumento_dependencias (instrumento_id, depende_de_id) WHERE cancelado_em IS NULL;

CREATE TABLE IF NOT EXISTS proj_instrumento_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrumento_id uuid NOT NULL REFERENCES proj_instrumentos(id),
  orgao varchar(160) NOT NULL,
  protocolo varchar(80),
  data_registro date NOT NULL,
  arquivo_nome varchar(255),
  mime varchar(120),
  tamanho integer CHECK (tamanho IS NULL OR tamanho > 0),
  sha256 char(64) CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  chave_armazenamento varchar(200),
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);

CREATE TABLE IF NOT EXISTS proj_instrumento_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrumento_id uuid NOT NULL REFERENCES proj_instrumentos(id),
  rotulo varchar(160) NOT NULL,
  marcador varchar(80),
  valor numeric(20,2) NOT NULL,
  moeda char(3) NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL','EUR','USD')),
  origem varchar(20) NOT NULL CHECK (origem IN ('ANEXO_I','ANEXO_V','CONFISSAO','PLANILHA_NEI','SIMULADOR','MANUAL')),
  origem_ref jsonb,
  apurado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  congelado_em timestamp(6),
  congelado_versao_id uuid REFERENCES proj_instrumento_versoes(id),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid DEFAULT proj_ctx_user(),
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);

CREATE TABLE IF NOT EXISTS proj_instrumento_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES proj_projetos(id),
  instrumento_id uuid NOT NULL REFERENCES proj_instrumentos(id),
  seq integer NOT NULL CHECK (seq >= 1),
  tipo varchar(30) NOT NULL CHECK (tipo IN ('CRIADO','EDITADO','SITUACAO','VERSAO','VERSAO_ENCERRADO','PARTE','PARTE_ENCERRADO',
        'DEPENDENCIA','DEPENDENCIA_ENCERRADO','REGISTRO','REGISTRO_ENCERRADO','VALOR','VALOR_ENCERRADO','VALOR_CONGELADO','COMENTARIO')),
  de_situacao varchar(20),
  para_situacao varchar(20),
  ref_id uuid,
  detalhe jsonb,
  motivo text,
  criado_em timestamp(6) NOT NULL,
  criado_por_id uuid,
  hash_anterior char(64) NOT NULL CHECK (hash_anterior ~ '^[0-9a-f]{64}$'),
  hash char(64) NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  UNIQUE (instrumento_id, seq)
);
CREATE INDEX IF NOT EXISTS proj_instr_eventos_inst_idx ON proj_instrumento_eventos (instrumento_id, seq);

-- ---------- funcoes ----------
CREATE OR REPLACE FUNCTION proj_instr_rank(p text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p WHEN 'RASCUNHO' THEN 0 WHEN 'EM_REVISAO' THEN 1 WHEN 'APROVADO' THEN 2 WHEN 'EM_ASSINATURA' THEN 3
    WHEN 'ASSINADO' THEN 4 WHEN 'REGISTRADO' THEN 5 WHEN 'VIGENTE' THEN 6 ELSE -1 END
$$;

CREATE OR REPLACE FUNCTION proj_instr_pendencias(p_inst uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(d2.codigo || ' (' || d2.situacao || ', exige ' || d.exige_situacao || ')', '; ' ORDER BY d2.ordem)
  FROM proj_instrumento_dependencias d JOIN proj_instrumentos d2 ON d2.id = d.depende_de_id
  WHERE d.instrumento_id = p_inst AND d.cancelado_em IS NULL
    AND proj_instr_rank(d2.situacao) < proj_instr_rank(d.exige_situacao)
$$;

CREATE OR REPLACE FUNCTION proj_instrumento_evento_hash(p_inst uuid, p_seq int, p_tipo text, p_de text, p_para text, p_ref uuid,
    p_det jsonb, p_motivo text, p_em timestamp, p_por uuid, p_ant text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT encode(sha256(convert_to(concat_ws('|', p_inst::text, p_seq::text, p_tipo, coalesce(p_de, ''), coalesce(p_para, ''),
    coalesce(p_ref::text, ''), coalesce(p_det::text, ''), coalesce(p_motivo, ''),
    to_char(p_em, 'YYYY-MM-DD"T"HH24:MI:SS.US'), coalesce(p_por::text, ''), p_ant), 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION proj_instrumento_eventos_encadear() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_ant text; v_seq int;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Trilha do instrumento e imutavel'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('proj_instr_ev:' || NEW.instrumento_id::text));
  SELECT e.seq, e.hash INTO v_seq, v_ant FROM proj_instrumento_eventos e
   WHERE e.instrumento_id = NEW.instrumento_id ORDER BY e.seq DESC LIMIT 1;
  SELECT i.projeto_id INTO NEW.projeto_id FROM proj_instrumentos i WHERE i.id = NEW.instrumento_id;
  NEW.seq := COALESCE(v_seq, 0) + 1;
  NEW.hash_anterior := COALESCE(v_ant, repeat('0', 64));
  NEW.criado_em := clock_timestamp()::timestamp(6);
  NEW.criado_por_id := COALESCE(NEW.criado_por_id, proj_ctx_user());
  NEW.hash := proj_instrumento_evento_hash(NEW.instrumento_id, NEW.seq, NEW.tipo, NEW.de_situacao, NEW.para_situacao, NEW.ref_id,
                NEW.detalhe, NEW.motivo, NEW.criado_em, NEW.criado_por_id, NEW.hash_anterior);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_instr_eventos_trg ON proj_instrumento_eventos;
CREATE TRIGGER proj_instr_eventos_trg BEFORE INSERT OR UPDATE OR DELETE ON proj_instrumento_eventos
  FOR EACH ROW EXECUTE FUNCTION proj_instrumento_eventos_encadear();

CREATE OR REPLACE FUNCTION proj_instrumento_verificar(p_inst uuid) RETURNS TABLE (ev_seq int, ev_ok boolean) LANGUAGE sql STABLE AS $$
  SELECT e.seq,
         (e.hash = proj_instrumento_evento_hash(e.instrumento_id, e.seq, e.tipo, e.de_situacao, e.para_situacao, e.ref_id,
                     e.detalhe, e.motivo, e.criado_em, e.criado_por_id, e.hash_anterior)
          AND e.hash_anterior = COALESCE(lag(e.hash) OVER (ORDER BY e.seq), repeat('0', 64))
          AND e.seq = row_number() OVER (ORDER BY e.seq))
  FROM proj_instrumento_eventos e WHERE e.instrumento_id = p_inst ORDER BY e.seq
$$;

CREATE OR REPLACE FUNCTION proj_instr_evento(p_inst uuid, p_tipo text, p_de text, p_para text, p_ref uuid, p_det jsonb, p_motivo text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO proj_instrumento_eventos (projeto_id, instrumento_id, seq, tipo, de_situacao, para_situacao, ref_id, detalhe, motivo,
                                        criado_em, hash_anterior, hash)
  VALUES (NULL, p_inst, 1, p_tipo, p_de, p_para, p_ref, p_det, p_motivo, NULL, NULL, NULL)
$$;

CREATE OR REPLACE FUNCTION proj_instrumentos_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_ok boolean; v_pend text; v_motivo text := trim(coalesce(NEW.motivo_ultima_transicao, ''));
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.situacao := 'RASCUNHO'; NEW.versao_aprovada_id := NULL; NEW.substituido_por_id := NULL;
    NEW.criado_por_id := COALESCE(NEW.criado_por_id, proj_ctx_user()); NEW.situacao_em := clock_timestamp();
    RETURN NEW;
  END IF;
  IF NEW.projeto_id IS DISTINCT FROM OLD.projeto_id OR NEW.codigo IS DISTINCT FROM OLD.codigo OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.lei IS DISTINCT FROM OLD.lei OR NEW.requer_assinatura IS DISTINCT FROM OLD.requer_assinatura
     OR NEW.requer_registro IS DISTINCT FROM OLD.requer_registro OR NEW.criado_em IS DISTINCT FROM OLD.criado_em
     OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Campos estruturais do instrumento sao imutaveis (encerre e crie outro)';
  END IF;
  IF OLD.situacao IN ('SUBSTITUIDO','ENCERRADO') THEN RAISE EXCEPTION 'Instrumento encerrado nao pode ser alterado'; END IF;
  IF NEW.situacao = OLD.situacao THEN
    IF NEW.versao_aprovada_id IS DISTINCT FROM OLD.versao_aprovada_id OR NEW.substituido_por_id IS DISTINCT FROM OLD.substituido_por_id THEN
      RAISE EXCEPTION 'Versao aprovada e substituto so mudam junto com a situacao';
    END IF;
    RETURN NEW;
  END IF;
  v_ok := CASE OLD.situacao
    WHEN 'RASCUNHO' THEN NEW.situacao IN ('EM_REVISAO','ENCERRADO')
    WHEN 'EM_REVISAO' THEN NEW.situacao IN ('RASCUNHO','APROVADO','ENCERRADO')
    WHEN 'APROVADO' THEN NEW.situacao IN ('EM_REVISAO','EM_ASSINATURA','REGISTRADO','VIGENTE','ENCERRADO')
    WHEN 'EM_ASSINATURA' THEN NEW.situacao IN ('APROVADO','ASSINADO','ENCERRADO')
    WHEN 'ASSINADO' THEN NEW.situacao IN ('REGISTRADO','VIGENTE','ENCERRADO')
    WHEN 'REGISTRADO' THEN NEW.situacao IN ('VIGENTE','ENCERRADO')
    WHEN 'VIGENTE' THEN NEW.situacao IN ('SUBSTITUIDO','ENCERRADO')
    ELSE false END;
  IF NOT v_ok THEN RAISE EXCEPTION 'Transicao nao permitida: % -> %', OLD.situacao, NEW.situacao; END IF;
  IF proj_instr_rank(NEW.situacao) < proj_instr_rank(OLD.situacao) AND length(v_motivo) < 10 THEN
    RAISE EXCEPTION 'Retorno, encerramento ou substituicao exige motivo (minimo 10 caracteres)';
  END IF;
  IF NEW.situacao = 'APROVADO' AND OLD.situacao = 'EM_REVISAO' THEN
    IF NOT EXISTS (SELECT 1 FROM proj_instrumento_versoes v WHERE v.id = NEW.versao_aprovada_id AND v.instrumento_id = NEW.id
                   AND v.tipo = 'FINAL' AND v.cancelado_em IS NULL) THEN
      RAISE EXCEPTION 'Aprovacao exige uma versao FINAL vigente deste instrumento';
    END IF;
  ELSIF NEW.situacao = 'EM_REVISAO' AND OLD.situacao = 'APROVADO' THEN
    NEW.versao_aprovada_id := NULL;
  ELSIF NEW.versao_aprovada_id IS DISTINCT FROM OLD.versao_aprovada_id THEN
    RAISE EXCEPTION 'Versao aprovada so muda na aprovacao';
  END IF;
  IF OLD.situacao = 'APROVADO' AND NEW.situacao IN ('EM_ASSINATURA','REGISTRADO','VIGENTE') THEN
    IF NEW.situacao = 'EM_ASSINATURA' AND NOT NEW.requer_assinatura THEN RAISE EXCEPTION 'Este instrumento nao exige assinatura'; END IF;
    IF NEW.situacao IN ('REGISTRADO','VIGENTE') AND NEW.requer_assinatura THEN RAISE EXCEPTION 'Este instrumento precisa ser assinado antes'; END IF;
    v_pend := proj_instr_pendencias(NEW.id);
    IF v_pend IS NOT NULL THEN RAISE EXCEPTION 'Dependencias pendentes: %', v_pend; END IF;
  END IF;
  IF NEW.situacao = 'ASSINADO' AND NOT EXISTS (SELECT 1 FROM proj_instrumento_versoes v WHERE v.instrumento_id = NEW.id
       AND v.tipo = 'ASSINADA' AND v.cancelado_em IS NULL) THEN
    RAISE EXCEPTION 'Assinatura exige a versao ASSINADA (PDF) enviada';
  END IF;
  IF NEW.situacao = 'REGISTRADO' THEN
    IF NOT NEW.requer_registro THEN RAISE EXCEPTION 'Este instrumento nao exige registro'; END IF;
    IF NOT EXISTS (SELECT 1 FROM proj_instrumento_registros r WHERE r.instrumento_id = NEW.id AND r.cancelado_em IS NULL) THEN
      RAISE EXCEPTION 'Informe o registro (orgao, protocolo e data) antes';
    END IF;
  END IF;
  IF NEW.situacao = 'VIGENTE' AND OLD.situacao IN ('APROVADO','ASSINADO') AND NEW.requer_registro THEN
    RAISE EXCEPTION 'Este instrumento precisa ser registrado antes';
  END IF;
  IF NEW.situacao = 'SUBSTITUIDO' THEN
    IF NEW.substituido_por_id IS NULL OR NEW.substituido_por_id = NEW.id THEN RAISE EXCEPTION 'Informe o instrumento substituto'; END IF;
  ELSIF NEW.substituido_por_id IS DISTINCT FROM OLD.substituido_por_id THEN
    RAISE EXCEPTION 'Substituto so e informado na substituicao';
  END IF;
  NEW.situacao_em := clock_timestamp();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_instrumentos_validar_trg ON proj_instrumentos;
CREATE TRIGGER proj_instrumentos_validar_trg BEFORE INSERT OR UPDATE ON proj_instrumentos FOR EACH ROW EXECUTE FUNCTION proj_instrumentos_validar();

CREATE OR REPLACE FUNCTION proj_instrumentos_evento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_mot text := NULLIF(trim(coalesce(NEW.motivo_ultima_transicao, '')), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM proj_instr_evento(NEW.id, 'CRIADO', NULL, NEW.situacao, NULL,
      jsonb_build_object('codigo', NEW.codigo, 'titulo', NEW.titulo, 'tipo', NEW.tipo, 'lei', NEW.lei, 'item_planilha', NEW.item_planilha,
                         'requer_assinatura', NEW.requer_assinatura, 'requer_registro', NEW.requer_registro), NULL);
    RETURN NULL;
  END IF;
  IF NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    PERFORM proj_instr_evento(NEW.id, 'SITUACAO', OLD.situacao, NEW.situacao, COALESCE(NEW.substituido_por_id, NEW.versao_aprovada_id), NULL, v_mot);
    IF NEW.situacao = 'APROVADO' AND OLD.situacao = 'EM_REVISAO' THEN
      UPDATE proj_instrumento_valores SET congelado_em = clock_timestamp(), congelado_versao_id = NEW.versao_aprovada_id
       WHERE instrumento_id = NEW.id AND cancelado_em IS NULL AND congelado_em IS NULL;
    END IF;
  ELSIF NEW.titulo IS DISTINCT FROM OLD.titulo OR NEW.orgao_registro_previsto IS DISTINCT FROM OLD.orgao_registro_previsto
     OR NEW.referencia_minuta IS DISTINCT FROM OLD.referencia_minuta OR NEW.item_planilha IS DISTINCT FROM OLD.item_planilha THEN
    PERFORM proj_instr_evento(NEW.id, 'EDITADO', NULL, NULL, NULL,
      jsonb_build_object('antes', jsonb_build_object('titulo', OLD.titulo, 'orgao', OLD.orgao_registro_previsto, 'referencia', OLD.referencia_minuta, 'item', OLD.item_planilha),
                         'depois', jsonb_build_object('titulo', NEW.titulo, 'orgao', NEW.orgao_registro_previsto, 'referencia', NEW.referencia_minuta, 'item', NEW.item_planilha)), v_mot);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS proj_instrumentos_evento_trg ON proj_instrumentos;
CREATE TRIGGER proj_instrumentos_evento_trg AFTER INSERT OR UPDATE ON proj_instrumentos FOR EACH ROW EXECUTE FUNCTION proj_instrumentos_evento();

CREATE OR REPLACE FUNCTION proj_instr_versoes_numerar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('proj_instr_ver:' || NEW.instrumento_id::text));
  SELECT COALESCE(MAX(v.numero), 0) + 1 INTO NEW.numero FROM proj_instrumento_versoes v WHERE v.instrumento_id = NEW.instrumento_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_instr_versoes_a_numerar_trg ON proj_instrumento_versoes;
CREATE TRIGGER proj_instr_versoes_a_numerar_trg BEFORE INSERT ON proj_instrumento_versoes FOR EACH ROW EXECUTE FUNCTION proj_instr_versoes_numerar();

CREATE OR REPLACE FUNCTION proj_instr_filhos_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_sit text; v_n jsonb := to_jsonb(NEW); v_o jsonb; v_t text := TG_TABLE_NAME;
BEGIN
  SELECT i.situacao INTO v_sit FROM proj_instrumentos i WHERE i.id = NEW.instrumento_id;
  IF v_sit IS NULL THEN RAISE EXCEPTION 'Instrumento nao encontrado'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF (v_n->>'cancelado_em') IS NOT NULL THEN RAISE EXCEPTION 'Registro novo nao pode nascer encerrado'; END IF;
    IF v_sit IN ('SUBSTITUIDO','ENCERRADO') THEN RAISE EXCEPTION 'Instrumento encerrado'; END IF;
    IF v_t = 'proj_instrumento_versoes' THEN
      IF (v_n->>'tipo') IN ('MINUTA','REVISAO') AND v_sit NOT IN ('RASCUNHO','EM_REVISAO') THEN
        RAISE EXCEPTION 'Minuta ou revisao so com o instrumento em Rascunho ou Em revisao'; END IF;
      IF (v_n->>'tipo') = 'FINAL' AND v_sit <> 'EM_REVISAO' THEN RAISE EXCEPTION 'Versao final so com o instrumento Em revisao'; END IF;
      IF (v_n->>'tipo') = 'ASSINADA' AND v_sit <> 'EM_ASSINATURA' THEN RAISE EXCEPTION 'Versao assinada so com o instrumento Em assinatura'; END IF;
    ELSIF v_t IN ('proj_instrumento_partes','proj_instrumento_dependencias') AND v_sit NOT IN ('RASCUNHO','EM_REVISAO','APROVADO') THEN
      RAISE EXCEPTION 'Partes e dependencias so ate a aprovacao';
    ELSIF v_t = 'proj_instrumento_valores' AND (v_sit NOT IN ('RASCUNHO','EM_REVISAO') OR (v_n->>'congelado_em') IS NOT NULL OR (v_n->>'congelado_versao_id') IS NOT NULL) THEN
      RAISE EXCEPTION 'Valores so ate a aprovacao, e nascem nao congelados';
    ELSIF v_t = 'proj_instrumento_registros' AND v_sit NOT IN ('APROVADO','ASSINADO') THEN
      RAISE EXCEPTION 'Registro so depois da aprovacao (instrumento sem assinatura) ou da assinatura';
    END IF;
    RETURN NEW;
  END IF;
  v_o := to_jsonb(OLD);
  IF v_t = 'proj_instrumento_valores' AND (v_o->>'congelado_em') IS NOT NULL THEN RAISE EXCEPTION 'Valor congelado na aprovacao e imutavel'; END IF;
  IF v_t = 'proj_instrumento_valores' AND (v_n->>'congelado_em') IS NOT NULL THEN
    IF (v_n - 'congelado_em' - 'congelado_versao_id') <> (v_o - 'congelado_em' - 'congelado_versao_id') THEN
      RAISE EXCEPTION 'Congelamento nao altera o valor'; END IF;
    RETURN NEW;
  END IF;
  IF (v_o->>'cancelado_em') IS NOT NULL THEN RAISE EXCEPTION 'Registro ja encerrado'; END IF;
  IF (v_n->>'cancelado_em') IS NULL
     OR (v_n - 'cancelado_em' - 'cancelado_por_id' - 'motivo_cancelamento') <> (v_o - 'cancelado_em' - 'cancelado_por_id' - 'motivo_cancelamento') THEN
    RAISE EXCEPTION 'Registro imutavel: so pode ser encerrado, com motivo';
  END IF;
  IF length(trim(coalesce(v_n->>'motivo_cancelamento', ''))) < 10 THEN RAISE EXCEPTION 'Encerramento exige motivo (minimo 10 caracteres)'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION proj_instr_filhos_evento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_tipo text; v_n jsonb := to_jsonb(NEW); v_o jsonb;
BEGIN
  v_tipo := CASE TG_TABLE_NAME WHEN 'proj_instrumento_versoes' THEN 'VERSAO' WHEN 'proj_instrumento_partes' THEN 'PARTE'
              WHEN 'proj_instrumento_dependencias' THEN 'DEPENDENCIA' WHEN 'proj_instrumento_registros' THEN 'REGISTRO' ELSE 'VALOR' END;
  IF TG_OP = 'UPDATE' THEN
    v_o := to_jsonb(OLD);
    IF (v_n->>'cancelado_em') IS NOT NULL AND (v_o->>'cancelado_em') IS NULL THEN v_tipo := v_tipo || '_ENCERRADO';
    ELSIF (v_n->>'congelado_em') IS NOT NULL AND (v_o->>'congelado_em') IS NULL THEN v_tipo := 'VALOR_CONGELADO';
    ELSE RETURN NULL; END IF;
  END IF;
  PERFORM proj_instr_evento(NEW.instrumento_id, v_tipo, NULL, NULL, NEW.id, v_n - 'criado_em' - 'criado_por_id', v_n->>'motivo_cancelamento');
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['proj_instrumento_versoes','proj_instrumento_partes','proj_instrumento_dependencias','proj_instrumento_registros','proj_instrumento_valores'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_b_validar_trg', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION proj_instr_filhos_validar()', t || '_b_validar_trg', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_evento_trg', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION proj_instr_filhos_evento()', t || '_evento_trg', t);
  END LOOP;
END $$;

-- ---------- RLS ----------
ALTER TABLE proj_instrumentos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_instrumentos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_instrumentos_ler ON proj_instrumentos;
DROP POLICY IF EXISTS proj_instrumentos_gravar ON proj_instrumentos;
CREATE POLICY proj_instrumentos_ler ON proj_instrumentos FOR SELECT USING (proj_tem_acao(projeto_id, 'revisar'));
CREATE POLICY proj_instrumentos_gravar ON proj_instrumentos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['proj_instrumento_versoes','proj_instrumento_partes','proj_instrumento_dependencias','proj_instrumento_registros','proj_instrumento_valores','proj_instrumento_eventos'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_ler', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (EXISTS (SELECT 1 FROM proj_instrumentos i WHERE i.id = instrumento_id))', t || '_ler', t);
    IF t <> 'proj_instrumento_eventos' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_gravar', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master())', t || '_gravar', t);
    END IF;
  END LOOP;
END $$;
DROP POLICY IF EXISTS proj_instrumento_versoes_revisor ON proj_instrumento_versoes;
CREATE POLICY proj_instrumento_versoes_revisor ON proj_instrumento_versoes FOR INSERT WITH CHECK (
  tipo = 'REVISAO' AND EXISTS (SELECT 1 FROM proj_instrumentos i WHERE i.id = instrumento_id AND i.situacao = 'EM_REVISAO'
                               AND proj_tem_acao(i.projeto_id, 'revisar')));
DROP POLICY IF EXISTS proj_instrumento_eventos_inserir ON proj_instrumento_eventos;
CREATE POLICY proj_instrumento_eventos_inserir ON proj_instrumento_eventos FOR INSERT WITH CHECK (
  proj_ctx_master() OR (tipo IN ('VERSAO','COMENTARIO') AND proj_tem_acao(projeto_id, 'revisar')));

GRANT SELECT, INSERT, UPDATE ON proj_instrumentos, proj_instrumento_versoes, proj_instrumento_partes, proj_instrumento_dependencias,
  proj_instrumento_registros, proj_instrumento_valores TO ledgr_api;
GRANT SELECT, INSERT ON proj_instrumento_eventos TO ledgr_api;
REVOKE UPDATE ON proj_instrumento_eventos FROM ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_instrumentos, proj_instrumento_versoes, proj_instrumento_partes, proj_instrumento_dependencias,
  proj_instrumento_registros, proj_instrumento_valores, proj_instrumento_eventos FROM ledgr_api;

-- ---------- carga: 11 instrumentos do plano, partes e dependencias ----------
DO $$
DECLARE v_proj uuid; v_n int;
BEGIN
  SELECT count(DISTINCT o.projeto_id), min(o.projeto_id::text)::uuid INTO v_n, v_proj
    FROM proj_anexo_v_itens i JOIN proj_operacoes o ON o.id = i.operacao_id;
  IF v_n <> 1 THEN RAISE EXCEPTION 'Esperado 1 projeto com Anexo V, encontrado %', v_n; END IF;

  INSERT INTO proj_instrumentos (projeto_id, codigo, ordem, titulo, item_planilha, tipo, lei, requer_assinatura, requer_registro, orgao_registro_previsto, referencia_minuta)
  SELECT v_proj, x.codigo, x.ordem, x.titulo, x.item, x.tipo, x.lei, x.ass, x.reg, x.orgao, x.ref
  FROM (VALUES
    ('I01'::varchar, 1, 'Compromisso de pagamento por conta de terceiro e reconhecimento de crédito (F5 - Sunrise)'::varchar, '1'::varchar, 'CONTRATO'::varchar, 'BR'::varchar, true, false, NULL::varchar, 'Doc Minutas do plano, aba 1'::text),
    ('I02', 2, 'Contrato de investimento e título de crédito (F5 - VAL)', '2', 'CONTRATO', 'BR', true, false, NULL, 'Doc Minutas do plano, aba 2'),
    ('I03', 3, 'Escritura de debêntures Series #1', '3', 'ESCRITURA', 'BR', true, true, 'JUCEPE e registro da oferta (CVM/B3)', 'Doc Minutas do plano, aba 3'),
    ('I04', 4, 'Contrato de depósito em conta escrow (Massa RM - F5 - Banco)', '4', 'CONTRATO', 'PT', true, false, NULL, 'Doc Minutas do plano, aba 4'),
    ('I05', 5, 'Declaração unilateral e irrevogável da F5 à Massa da RM', '5', 'DECLARACAO', 'PT', true, true, 'Juntada ao proc. 1419/26.2T8STR', 'Doc Minutas do plano, aba 5'),
    ('I06', 6, 'Primeiro aditivo ao Termo de Participação - programa de amortização', '14', 'ADITIVO', 'BR_PT', true, true, 'Juntada ao proc. 1419/26.2T8STR', 'Doc Minutas do plano, aba 6'),
    ('I07', 7, 'Cláusulas do plano de insolvência da RM', '7', 'CLAUSULAS_PLANO', 'PT', false, true, 'Homologação no proc. 1419/26.2T8STR (Juízo de Comércio de Santarém)', 'Doc Minutas do plano, aba 7'),
    ('I08', 8, 'Alteração contratual da Sunrise - transferência de quotas à F5', '8', 'ALTERACAO_CONTRATUAL', 'BR', true, true, 'JUCEPE', 'Doc Minutas do plano, aba 8'),
    ('I09', 9, 'Declarações de origem dos recursos (remetentes)', '12', 'DECLARACAO', 'BR', true, false, NULL, 'Doc Minutas do plano, aba 9'),
    ('I10', 10, 'Nota explicativa conjunta - operação de 31/10/2025', '9', 'NOTA_EXPLICATIVA', 'BR', false, false, NULL, 'Doc Minutas do plano, aba 10'),
    ('I11', 11, 'Termos de referência dos pareceres (BR, PT e contábil)', '10, 11, 13', 'TERMO_REFERENCIA', 'BR_PT', false, false, NULL, 'Doc Minutas do plano, aba 11')
  ) AS x(codigo, ordem, titulo, item, tipo, lei, ass, reg, orgao, ref)
  ON CONFLICT (projeto_id, codigo) DO NOTHING;

  INSERT INTO proj_instrumento_partes (instrumento_id, ordem, nome, papel, documento, jurisdicao, forma_assinatura)
  SELECT i.id, p.ordem, p.nome, p.papel, p.documento, p.jur, p.forma
  FROM (VALUES
    ('I01'::varchar, 1, 'F5'::varchar, 'PARTE'::varchar, NULL::varchar, 'BR'::varchar, 'CLICKSIGN'::varchar),
    ('I01', 2, 'Sunrise', 'PARTE', NULL, 'BR', 'CLICKSIGN'),
    ('I01', 3, 'Massa Insolvente da Real Mouchão Lombo do Tejo, Sociedade Agropecuária, S.A.', 'CIENCIA', '503382582', 'PT', 'A_DEFINIR'),
    ('I02', 1, 'F5', 'PARTE', NULL, 'BR', 'CLICKSIGN'),
    ('I02', 2, 'VAL INVESTIMENTOS S/A', 'PARTE', '55016325000154', 'BR', 'CLICKSIGN'),
    ('I03', 1, 'Emissora das debêntures [a definir]', 'PARTE', NULL, 'BR', 'CLICKSIGN'),
    ('I03', 2, 'Agente fiduciário [a definir]', 'PARTE', NULL, 'BR', 'CLICKSIGN'),
    ('I03', 3, 'F5', 'FIADOR', NULL, 'BR', 'CLICKSIGN'),
    ('I04', 1, 'Massa Insolvente da Real Mouchão Lombo do Tejo, Sociedade Agropecuária, S.A.', 'PARTE', '503382582', 'PT', 'A_DEFINIR'),
    ('I04', 2, 'F5', 'PARTE', NULL, 'BR', 'CLICKSIGN'),
    ('I04', 3, 'Banco depositário [a definir]', 'PARTE', NULL, 'PT', 'A_DEFINIR'),
    ('I05', 1, 'F5', 'PARTE', NULL, 'BR', 'A_DEFINIR'),
    ('I05', 2, 'Massa Insolvente da Real Mouchão Lombo do Tejo, Sociedade Agropecuária, S.A.', 'CIENCIA', '503382582', 'PT', 'A_DEFINIR'),
    ('I06', 1, 'Massa Insolvente da Real Mouchão Lombo do Tejo, Sociedade Agropecuária, S.A.', 'PARTE', '503382582', 'PT', 'A_DEFINIR'),
    ('I06', 2, 'Sunrise', 'PARTE', NULL, 'BR', 'CLICKSIGN'),
    ('I06', 3, 'F5', 'FIADOR', NULL, 'BR', 'CLICKSIGN'),
    ('I08', 1, 'Antonio Vieira', 'PARTE', NULL, NULL, 'A_DEFINIR'),
    ('I08', 2, 'F5', 'PARTE', NULL, 'BR', 'ICP_BRASIL'),
    ('I09', 1, 'VAL INVESTIMENTOS S/A', 'INTERVENIENTE', '55016325000154', 'BR', 'CLICKSIGN')
  ) AS p(codigo, ordem, nome, papel, documento, jur, forma)
  JOIN proj_instrumentos i ON i.projeto_id = v_proj AND i.codigo = p.codigo
  WHERE NOT EXISTS (SELECT 1 FROM proj_instrumento_partes x WHERE x.instrumento_id = i.id AND x.nome = p.nome AND x.papel = p.papel);

  INSERT INTO proj_instrumento_dependencias (instrumento_id, depende_de_id, exige_situacao, justificativa)
  SELECT a.id, b.id, 'ASSINADO', d.just
  FROM (VALUES
    ('I02'::varchar, 'I01'::varchar, 'O título da VAL é pago com o crédito reconhecido no instrumento F5-Sunrise'::text),
    ('I03', 'I04', 'A conta escrow precisa existir antes da primeira captação'),
    ('I03', 'I05', 'A destinação de 20% ao escrow cumpre a declaração da F5'),
    ('I07', 'I04', 'O plano paga pelo escrow'),
    ('I07', 'I05', 'O plano incorpora a declaração e as renúncias da F5'),
    ('I07', 'I06', 'O plano incorpora o programa anual da Sunrise'),
    ('I10', 'I01', 'A nota descreve o crédito reconhecido'),
    ('I10', 'I02', 'A nota descreve o título da VAL'),
    ('I10', 'I05', 'A nota descreve o spread e as renúncias')
  ) AS d(de, para, just)
  JOIN proj_instrumentos a ON a.projeto_id = v_proj AND a.codigo = d.de
  JOIN proj_instrumentos b ON b.projeto_id = v_proj AND b.codigo = d.para
  WHERE NOT EXISTS (SELECT 1 FROM proj_instrumento_dependencias x WHERE x.instrumento_id = a.id AND x.depende_de_id = b.id AND x.cancelado_em IS NULL);
END $$;
COMMIT;

SELECT i.codigo, i.situacao, (SELECT count(*) FROM proj_instrumento_partes p WHERE p.instrumento_id = i.id) AS partes,
       (SELECT count(*) FROM proj_instrumento_dependencias d WHERE d.instrumento_id = i.id) AS deps,
       (SELECT count(*) FROM proj_instrumento_eventos e WHERE e.instrumento_id = i.id) AS eventos,
       (SELECT bool_and(ev_ok) FROM proj_instrumento_verificar(i.id)) AS trilha_ok
FROM proj_instrumentos i ORDER BY i.ordem;
