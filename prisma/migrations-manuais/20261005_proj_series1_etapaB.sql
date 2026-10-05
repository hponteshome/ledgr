-- prisma/migrations-manuais/20261005_proj_series1_etapaB.sql
-- Series#1 - Etapa B: papeis, operacao Series#1, registro de quotas (Quota no 1 = Ancora), REAL como divida e participacao,
-- tipo de saldo informado para o estoque de passivos da HOTELSYS.
BEGIN;
INSERT INTO proj_papeis (codigo, nome, descricao, aplica_a, criado_por_id)
SELECT x.codigo, x.nome, x.descricao, x.aplica, (SELECT id FROM users WHERE email = 'hpontes@ledgr.com')
FROM (VALUES ('EMISSORA', 'Emissora das quotas', 'Emite, coloca e gere as quotas da série', 'EMPRESA'),
             ('OFERTANTE', 'Ofertante', 'Oferta a série junto com a emissora', 'EMPRESA'),
             ('COTISTA', 'Cotista', 'Titular de quota de participação econômica', 'CONTRAPARTE'),
             ('CREDORA', 'Credora', 'Credora da dívida', 'AMBOS'),
             ('DEVEDORA', 'Devedora', 'Devedora da dívida', 'AMBOS'),
             ('CONCEDENTE', 'Concedente da participação', 'Concede a participação econômica nos resultados', 'EMPRESA')) AS x(codigo, nome, descricao, aplica)
ON CONFLICT (codigo) DO NOTHING;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = 'proj_saldos_informados'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%tipo%' LOOP
    EXECUTE format('ALTER TABLE proj_saldos_informados DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE proj_saldos_informados ADD CONSTRAINT proj_saldos_informados_tipo_ck CHECK (tipo IN ('CONTA_INDIVIDUAL', 'INTERCOMPANY_RECEBEDORA', 'INTERCOMPANY_BENEFICIARIA', 'PASSIVOS_EMPREENDIMENTO'));

CREATE TABLE IF NOT EXISTS proj_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  numero integer NOT NULL CHECK (numero > 0),
  subscritor_id uuid NOT NULL REFERENCES proj_contrapartes(id),
  valor numeric(18,2) NOT NULL CHECK (valor > 0),
  data_subscricao date NOT NULL,
  data_ingresso date NOT NULL,
  operacao_origem_id uuid REFERENCES proj_operacoes(id),
  observacao text,
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_quotas_numero_uq ON proj_quotas (operacao_id, numero) WHERE cancelado_em IS NULL;
CREATE OR REPLACE FUNCTION proj_quotas_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF OLD.cancelado_em IS NOT NULL OR NEW.cancelado_em IS NULL OR NEW.operacao_id IS DISTINCT FROM OLD.operacao_id OR NEW.numero IS DISTINCT FROM OLD.numero
     OR NEW.subscritor_id IS DISTINCT FROM OLD.subscritor_id OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.data_subscricao IS DISTINCT FROM OLD.data_subscricao
     OR NEW.data_ingresso IS DISTINCT FROM OLD.data_ingresso OR NEW.operacao_origem_id IS DISTINCT FROM OLD.operacao_origem_id THEN
    RAISE EXCEPTION 'Quota e imutavel: so pode ser encerrada, com motivo';
  END IF;
  IF NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10 THEN RAISE EXCEPTION 'Encerramento de quota exige motivo (minimo 10 caracteres)'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_quotas_validar_trg ON proj_quotas;
CREATE TRIGGER proj_quotas_validar_trg BEFORE INSERT OR UPDATE ON proj_quotas FOR EACH ROW EXECUTE FUNCTION proj_quotas_validar();
ALTER TABLE proj_quotas ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_quotas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_quotas_ler ON proj_quotas;
DROP POLICY IF EXISTS proj_quotas_inserir ON proj_quotas;
DROP POLICY IF EXISTS proj_quotas_encerrar ON proj_quotas;
CREATE POLICY proj_quotas_ler ON proj_quotas FOR SELECT USING (EXISTS (SELECT 1 FROM proj_operacoes o WHERE o.id = operacao_id));
CREATE POLICY proj_quotas_inserir ON proj_quotas FOR INSERT WITH CHECK (proj_ctx_master());
CREATE POLICY proj_quotas_encerrar ON proj_quotas FOR UPDATE USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
REVOKE DELETE, TRUNCATE ON proj_quotas FROM ledgr_api;

DO $$
DECLARE v_proj uuid; v_master uuid; v_anc uuid; v_s1 uuid; v_real uuid; v_f5 uuid; v_sun uuid; v_hot uuid; v_val uuid; v_realct uuid; n int; lista text;
BEGIN
  SELECT id INTO v_master FROM users WHERE email = 'hpontes@ledgr.com';
  SELECT id INTO v_proj FROM proj_projetos WHERE codigo = 'RECIFE-OCEAN';
  SELECT id INTO v_anc FROM proj_operacoes WHERE projeto_id = v_proj AND codigo = 'ANCORA';
  SELECT id INTO v_real FROM proj_operacoes WHERE projeto_id = v_proj AND codigo = 'REAL';
  SELECT count(*), string_agg(legal_name, '; ') INTO n, lista FROM companies WHERE legal_name ILIKE 'F5%';
  IF n <> 1 THEN RAISE EXCEPTION 'F5: % empresa(s) com razao social iniciada por F5 (%); ajuste o filtro', n, COALESCE(lista, 'nenhuma'); END IF;
  SELECT id INTO v_f5 FROM companies WHERE legal_name ILIKE 'F5%';
  SELECT pp.company_id INTO v_sun FROM proj_participacoes pp JOIN companies c ON c.id = pp.company_id
   WHERE pp.operacao_id = v_anc AND c.legal_name ILIKE '%SUNRISE%' AND pp.cancelado_em IS NULL LIMIT 1;
  SELECT id INTO v_hot FROM companies WHERE legal_name ILIKE '%HOTELSYS%' ORDER BY legal_name LIMIT 1;
  SELECT pp.contraparte_id INTO v_val FROM proj_participacoes pp JOIN proj_papeis pa ON pa.id = pp.papel_id
   WHERE pp.operacao_id = v_anc AND pa.codigo = 'ADQUIRENTE' AND pp.cancelado_em IS NULL LIMIT 1;
  SELECT id INTO v_realct FROM proj_contrapartes WHERE documento = '503382582' AND cancelado_em IS NULL;
  IF v_proj IS NULL OR v_anc IS NULL OR v_real IS NULL OR v_sun IS NULL OR v_hot IS NULL OR v_val IS NULL OR v_realct IS NULL THEN
    RAISE EXCEPTION 'faltam referencias: projeto %, ancora %, real %, sunrise %, hotelsys %, val %, real(contraparte) %', v_proj, v_anc, v_real, v_sun, v_hot, v_val, v_realct;
  END IF;
  SELECT id INTO v_s1 FROM proj_operacoes WHERE projeto_id = v_proj AND codigo = 'SERIES1';
  IF v_s1 IS NULL THEN
    INSERT INTO proj_operacoes (projeto_id, codigo, nome, tipo, descricao, data_base, status, criado_por_id)
    VALUES (v_proj, 'SERIES1', 'Series#1 - Quotas F5', 'EMISSAO_QUOTAS',
            'Quotas de participação econômica nos resultados do Hotel Recife emitidas pela F5 (SPE de comercialização); cotistas subordinados à quitação dos passivos da HOTELSYS.',
            DATE '2026-10-01', 'ATIVA', v_master) RETURNING id INTO v_s1;
  END IF;
  INSERT INTO proj_participacoes (operacao_id, papel_id, company_id, contraparte_id, observacao, criado_por_id)
  SELECT v_s1, pa.id, x.cid, x.ctid, x.obs, v_master
  FROM (VALUES ('EMISSORA', v_f5, NULL::uuid, 'Emite, coloca e gere as quotas (SPE de comercialização)'),
               ('OFERTANTE', v_hot, NULL::uuid, 'Ofertante; operação hoteleira'),
               ('OFERTANTE', v_sun, NULL::uuid, 'Ofertante; proprietária do ativo'),
               ('COTISTA', NULL::uuid, v_val, 'Quota nº 1 (Operação Âncora)')) AS x(papel, cid, ctid, obs)
  JOIN proj_papeis pa ON pa.codigo = x.papel
  WHERE NOT EXISTS (SELECT 1 FROM proj_participacoes p WHERE p.operacao_id = v_s1 AND p.papel_id = pa.id AND p.company_id IS NOT DISTINCT FROM x.cid AND p.contraparte_id IS NOT DISTINCT FROM x.ctid AND p.cancelado_em IS NULL);
  UPDATE proj_operacoes SET nome = 'Dívida e Participação REAL', tipo = 'DIVIDA_PARTICIPACAO',
    descricao = 'Dívida confessada pela REAL em favor da F5 em 31/10/2025 (EUR 8.748.947,11, fixada em R$ 54.418.451,00); participação econômica concedida pela SUNRISE (10% de cada aporte), compensada com a dívida até a quitação.',
    atualizado_por_id = v_master, atualizado_em = now()
  WHERE id = v_real AND tipo <> 'DIVIDA_PARTICIPACAO';
  UPDATE proj_participacoes p SET cancelado_em = now(), cancelado_por_id = v_master,
    motivo_cancelamento = 'Reestruturacao pela Series#1 (book e termo de 31/10/2025): a REAL e devedora da F5; papeis substituidos por DEVEDORA, CREDORA e CONCEDENTE.'
  FROM proj_papeis pa WHERE pa.id = p.papel_id AND p.operacao_id = v_real AND p.cancelado_em IS NULL AND pa.codigo IN ('INVESTIDOR_ESTRATEGICO', 'DESENVOLVEDORA');
  INSERT INTO proj_participacoes (operacao_id, papel_id, company_id, contraparte_id, observacao, criado_por_id)
  SELECT v_real, pa.id, x.cid, x.ctid, x.obs, v_master
  FROM (VALUES ('DEVEDORA', NULL::uuid, v_realct, 'Dívida confessada de R$ 54.418.451,00 (EUR 8.748.947,11)'),
               ('CREDORA', v_f5, NULL::uuid, 'Credora da dívida confessada pela REAL'),
               ('CONCEDENTE', v_sun, NULL::uuid, 'Concede a participação econômica (termo de 31/10/2025)')) AS x(papel, cid, ctid, obs)
  JOIN proj_papeis pa ON pa.codigo = x.papel
  WHERE NOT EXISTS (SELECT 1 FROM proj_participacoes p WHERE p.operacao_id = v_real AND p.papel_id = pa.id AND p.company_id IS NOT DISTINCT FROM x.cid AND p.contraparte_id IS NOT DISTINCT FROM x.ctid AND p.cancelado_em IS NULL);
  INSERT INTO proj_quotas (operacao_id, numero, subscritor_id, valor, data_subscricao, data_ingresso, operacao_origem_id, observacao, criado_por_id)
  SELECT v_s1, 1, v_val, 5000000, DATE '2024-08-01', DATE '2026-10-01', v_anc, 'Quota nº 1: aportes da Operação Âncora (cota sênior); ingresso na Series#1 em 01/10/2026.', v_master
  WHERE NOT EXISTS (SELECT 1 FROM proj_quotas q WHERE q.operacao_id = v_s1 AND q.numero = 1 AND q.cancelado_em IS NULL);
END $$;
COMMIT;
SELECT o.codigo AS operacao, o.nome, pa.nome AS papel, COALESCE(c.legal_name, ct.nome) AS participante
FROM proj_participacoes pp JOIN proj_operacoes o ON o.id = pp.operacao_id JOIN proj_papeis pa ON pa.id = pp.papel_id
LEFT JOIN companies c ON c.id = pp.company_id LEFT JOIN proj_contrapartes ct ON ct.id = pp.contraparte_id
WHERE o.codigo IN ('SERIES1', 'REAL') AND pp.cancelado_em IS NULL ORDER BY o.codigo, pa.nome;
SELECT q.numero, ct.nome AS subscritor, q.valor, q.data_subscricao, q.data_ingresso FROM proj_quotas q JOIN proj_contrapartes ct ON ct.id = q.subscritor_id;