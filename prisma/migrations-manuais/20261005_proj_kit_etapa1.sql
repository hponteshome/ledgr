-- prisma/migrations-manuais/20261005_proj_kit_etapa1.sql
-- Kit do Investidor - Etapa 1: contraparte estrangeira, papeis, operacao da REAL e premissas versionadas.
BEGIN;
ALTER TABLE proj_contrapartes ADD COLUMN IF NOT EXISTS pais char(2) NOT NULL DEFAULT 'BR';
ALTER TABLE proj_contrapartes ADD COLUMN IF NOT EXISTS tipo_documento varchar(10);
UPDATE proj_contrapartes SET tipo_documento = CASE length(documento) WHEN 11 THEN 'CPF' WHEN 14 THEN 'CNPJ' ELSE 'OUTRO' END WHERE documento IS NOT NULL AND tipo_documento IS NULL;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = 'proj_contrapartes'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%documento%' LOOP
    EXECUTE format('ALTER TABLE proj_contrapartes DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'restricao antiga de documento removida: %', r.conname;
  END LOOP;
END $$;
ALTER TABLE proj_contrapartes ADD CONSTRAINT proj_contrapartes_documento_ck CHECK (
  documento IS NULL
  OR (tipo_documento = 'CPF' AND documento ~ '^[0-9]{11}$')
  OR (tipo_documento = 'CNPJ' AND documento ~ '^[0-9]{14}$')
  OR (tipo_documento = 'NIPC' AND documento ~ '^[0-9]{9}$')
  OR (tipo_documento = 'OUTRO'));

INSERT INTO proj_papeis (codigo, nome, descricao, aplica_a, criado_por_id)
SELECT x.codigo, x.nome, x.descricao, x.aplica, (SELECT id FROM users WHERE email = 'hpontes@ledgr.com')
FROM (VALUES ('INVESTIDOR_ESTRATEGICO', 'Investidor Estratégico', 'Participação exclusivamente econômica nos resultados elegíveis', 'CONTRAPARTE'),
             ('DESENVOLVEDORA', 'Desenvolvedora e gestora', 'Condução do projeto, comercialização, custos e gestão dos ativos', 'EMPRESA')) AS x(codigo, nome, descricao, aplica)
ON CONFLICT (codigo) DO NOTHING;

DO $$
DECLARE v_proj uuid; v_op uuid; v_real uuid; v_hot uuid; v_master uuid;
BEGIN
  SELECT id INTO v_master FROM users WHERE email = 'hpontes@ledgr.com';
  SELECT id INTO v_proj FROM proj_projetos WHERE codigo = 'RECIFE-OCEAN';
  SELECT id INTO v_hot FROM companies WHERE legal_name ILIKE '%HOTELSYS%' ORDER BY legal_name LIMIT 1;
  IF v_proj IS NULL OR v_hot IS NULL THEN RAISE EXCEPTION 'projeto RECIFE-OCEAN ou empresa HOTELSYS nao encontrados'; END IF;
  SELECT id INTO v_op FROM proj_operacoes WHERE projeto_id = v_proj AND codigo = 'REAL';
  IF v_op IS NULL THEN
    INSERT INTO proj_operacoes (projeto_id, codigo, nome, tipo, descricao, data_base, status, criado_por_id)
    VALUES (v_proj, 'REAL', 'Participação Econômica REAL', 'PARTICIPACAO_ECONOMICA',
            'Investidor Estratégico: assunção do passivo de referência em 31/10/2025; participação exclusivamente econômica nos resultados elegíveis, a partir de data a definir após a Estruturação (jan/2027).',
            DATE '2025-10-31', 'ATIVA', v_master) RETURNING id INTO v_op;
  END IF;
  SELECT id INTO v_real FROM proj_contrapartes WHERE documento = '503382582' AND cancelado_em IS NULL;
  IF v_real IS NULL THEN
    INSERT INTO proj_contrapartes (tipo_pessoa, tipo_documento, pais, documento, nome, observacoes, criado_por_id)
    VALUES ('PJ', 'NIPC', 'PT', '503382582', 'Real Mouchão Lombo do Tejo, Sociedade Agropecuária, S.A.', 'Sociedade estabelecida em Portugal (NIPC).', v_master) RETURNING id INTO v_real;
  END IF;
  INSERT INTO proj_participacoes (operacao_id, papel_id, contraparte_id, observacao, criado_por_id)
  SELECT v_op, p.id, v_real, 'Passivo de referência de R$ 54 mi assumido em 31/10/2025', v_master FROM proj_papeis p
  WHERE p.codigo = 'INVESTIDOR_ESTRATEGICO' AND NOT EXISTS (SELECT 1 FROM proj_participacoes x WHERE x.operacao_id = v_op AND x.papel_id = p.id AND x.contraparte_id = v_real AND x.cancelado_em IS NULL);
  INSERT INTO proj_participacoes (operacao_id, papel_id, company_id, observacao, criado_por_id)
  SELECT v_op, p.id, v_hot, 'Gestão estratégica, comercial, operacional e imobiliária', v_master FROM proj_papeis p
  WHERE p.codigo = 'DESENVOLVEDORA' AND NOT EXISTS (SELECT 1 FROM proj_participacoes x WHERE x.operacao_id = v_op AND x.papel_id = p.id AND x.company_id = v_hot AND x.cancelado_em IS NULL);
END $$;

CREATE TABLE IF NOT EXISTS proj_premissa_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES proj_projetos(id),
  numero integer NOT NULL,
  descricao text NOT NULL,
  data_base date NOT NULL,
  arquivo_origem text,
  arquivo_sha256 char(64),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text,
  UNIQUE (projeto_id, numero)
);
CREATE TABLE IF NOT EXISTS proj_premissas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES proj_premissa_versoes(id),
  operacao_id uuid REFERENCES proj_operacoes(id),
  grupo varchar(40) NOT NULL,
  codigo varchar(60) NOT NULL,
  nome varchar(160) NOT NULL,
  valor_num numeric(24,10),
  valor_texto text,
  valor_data date,
  unidade varchar(20),
  fonte text NOT NULL,
  ordem integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_premissas_codigo_uq ON proj_premissas (versao_id, codigo, COALESCE(operacao_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE OR REPLACE FUNCTION proj_premissa_versoes_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF OLD.cancelado_em IS NOT NULL OR NEW.cancelado_em IS NULL OR NEW.numero IS DISTINCT FROM OLD.numero OR NEW.projeto_id IS DISTINCT FROM OLD.projeto_id
     OR NEW.data_base IS DISTINCT FROM OLD.data_base OR NEW.arquivo_sha256 IS DISTINCT FROM OLD.arquivo_sha256 OR NEW.descricao IS DISTINCT FROM OLD.descricao THEN
    RAISE EXCEPTION 'Versao de premissas e imutavel: so pode ser encerrada, com motivo';
  END IF;
  IF NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10 THEN RAISE EXCEPTION 'Encerramento de versao exige motivo (minimo 10 caracteres)'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_premissa_versoes_validar_trg ON proj_premissa_versoes;
CREATE TRIGGER proj_premissa_versoes_validar_trg BEFORE INSERT OR UPDATE ON proj_premissa_versoes FOR EACH ROW EXECUTE FUNCTION proj_premissa_versoes_validar();
ALTER TABLE proj_premissa_versoes ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_premissa_versoes FORCE ROW LEVEL SECURITY;
ALTER TABLE proj_premissas ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_premissas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_premissa_versoes_master ON proj_premissa_versoes;
DROP POLICY IF EXISTS proj_premissas_master ON proj_premissas;
CREATE POLICY proj_premissa_versoes_master ON proj_premissa_versoes FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
CREATE POLICY proj_premissas_master ON proj_premissas FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
REVOKE DELETE, TRUNCATE ON proj_premissa_versoes FROM ledgr_api;
REVOKE UPDATE, DELETE, TRUNCATE ON proj_premissas FROM ledgr_api;
COMMIT;
SELECT o.codigo AS operacao, pa.nome AS papel, COALESCE(c.legal_name, ct.nome) AS participante, ct.tipo_documento, ct.pais
FROM proj_participacoes pp JOIN proj_operacoes o ON o.id = pp.operacao_id JOIN proj_papeis pa ON pa.id = pp.papel_id
LEFT JOIN companies c ON c.id = pp.company_id LEFT JOIN proj_contrapartes ct ON ct.id = pp.contraparte_id
WHERE o.codigo = 'REAL' AND pp.cancelado_em IS NULL;