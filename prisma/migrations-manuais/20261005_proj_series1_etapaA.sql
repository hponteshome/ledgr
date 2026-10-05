-- prisma/migrations-manuais/20261005_proj_series1_etapaA.sql
-- Series#1 - Etapa A: natureza que nao paga passivo, versao 2 das premissas (book + termo + decisoes do Hpontes).
-- Hashes dos documentos chegam por variaveis do psql (book_sha, termo_sha, book_nome, termo_nome).
BEGIN;
ALTER TABLE proj_naturezas_aplicacao ADD COLUMN IF NOT EXISTS paga_passivo boolean NOT NULL DEFAULT true;
UPDATE proj_naturezas_aplicacao SET paga_passivo = false WHERE codigo = 'DEVOLUCAO_ADQUIRENTE';
INSERT INTO proj_naturezas_aplicacao (codigo, nome, tipo, paga_passivo) VALUES ('MANUTENCAO_OPERACAO', 'Manutenção da Operação', 'APLICACAO', false)
ON CONFLICT (codigo) DO UPDATE SET paga_passivo = false;
SELECT set_config('kit.book_sha', :'book_sha', false), set_config('kit.termo_sha', :'termo_sha', false), set_config('kit.book_nome', :'book_nome', false), set_config('kit.termo_nome', :'termo_nome', false);
DO $$
DECLARE v_proj uuid; v_master uuid; v_v1 uuid; v_v2 uuid; v_real uuid; v_n int;
  DEC text := 'Decisao do Hpontes em 05/10/2026';
  BK text := 'Book Series#1 (' || current_setting('kit.book_nome') || ', sha256 ' || left(current_setting('kit.book_sha'), 16) || ')';
  TR text := 'Termo de participacao Sunrise x Real Mouchao de 31/10/2025 (' || current_setting('kit.termo_nome') || ', sha256 ' || left(current_setting('kit.termo_sha'), 16) || ')';
BEGIN
  SELECT id INTO v_proj FROM proj_projetos WHERE codigo = 'RECIFE-OCEAN';
  SELECT id INTO v_master FROM users WHERE email = 'hpontes@ledgr.com';
  SELECT id INTO v_real FROM proj_operacoes WHERE projeto_id = v_proj AND codigo = 'REAL';
  IF EXISTS (SELECT 1 FROM proj_premissa_versoes WHERE projeto_id = v_proj AND arquivo_sha256 = current_setting('kit.book_sha') AND cancelado_em IS NULL) THEN
    RAISE NOTICE 'versao com este book ja carregada - nada alterado'; RETURN;
  END IF;
  SELECT id INTO v_v1 FROM proj_premissa_versoes WHERE projeto_id = v_proj AND numero = 1 AND cancelado_em IS NULL;
  IF v_v1 IS NULL THEN RAISE EXCEPTION 'versao 1 vigente nao encontrada'; END IF;
  UPDATE proj_premissa_versoes SET cancelado_em = now(), cancelado_por_id = v_master,
    motivo_cancelamento = 'Substituida pela versao 2: as faixas progressivas sao dos cotistas da Series#1 (book), nao da REAL; a REAL e devedora da F5 (termo de 31/10/2025) com contrapartida de 10% dos aportes.'
  WHERE id = v_v1;
  SELECT COALESCE(max(numero), 0) + 1 INTO v_n FROM proj_premissa_versoes WHERE projeto_id = v_proj;
  INSERT INTO proj_premissa_versoes (projeto_id, numero, descricao, data_base, arquivo_origem, arquivo_sha256, criado_por_id)
  VALUES (v_proj, v_n, 'Series#1 (book) + divida e participacao da REAL (termo) + BP reconferido da v1; decisoes do Hpontes em 05/10/2026',
          DATE '2025-12-31', current_setting('kit.book_nome') || ' + ' || current_setting('kit.termo_nome'), current_setting('kit.book_sha'), v_master)
  RETURNING id INTO v_v2;
  INSERT INTO proj_premissas (versao_id, operacao_id, grupo, codigo, nome, valor_num, valor_texto, valor_data, unidade, fonte, ordem)
  SELECT v_v2, p.operacao_id, p.grupo, p.codigo, p.nome, p.valor_num, p.valor_texto, p.valor_data, p.unidade, p.fonte || ' (reaproveitada da v1, conferida contra a planilha)', p.ordem
  FROM proj_premissas p WHERE p.versao_id = v_v1 AND p.grupo IN ('BP_2018', 'REEXPRESSAO', 'PRODUTO', 'SENSIBILIDADE', 'META_ANCORA');
  INSERT INTO proj_premissas (versao_id, operacao_id, grupo, codigo, nome, valor_num, valor_texto, valor_data, unidade, fonte, ordem)
  SELECT v_v2, CASE WHEN x.op = 'REAL' THEN v_real END, x.grupo, x.codigo, x.nome, x.num, x.txt, x.dt, x.un, x.fonte, 100 + x.ord
  FROM (VALUES
    ('SERIES1', 'SERIES1_VALOR_QUOTA', 'Valor da quota sênior', 5000000::numeric, NULL, NULL::date, 'R$', BK || ', secao 4', 1, NULL),
    ('SERIES1', 'SERIES1_PCT_CDE_COTISTAS', 'Parte do CDE destinada aos cotistas', 0.80, NULL, NULL, '%', BK || ', secao 6', 2, NULL),
    ('SERIES1', 'SERIES1_PCT_CDE_F5', 'Parte do CDE destinada à F5', 0.20, NULL, NULL, '%', DEC, 3, NULL),
    ('SERIES1', 'SERIES1_REGRA_PCT_QUOTA', 'Regra do percentual por quota', NULL, '80% x valor da quota / resultado do BP (201 unidades)', NULL, NULL, DEC, 4, NULL),
    ('SERIES1', 'SERIES1_PCT_QUOTA_BOOK', 'Percentual por quota citado no book (referência, substituído pela regra)', 0.010582, NULL, NULL, '%', BK || ', secoes 4 e 7', 5, NULL),
    ('SERIES1', 'SERIES1_FAIXA_1_PCT', 'Faixa I: parte do cotista no CDE', 1.00, NULL, NULL, '%', BK || ', secao 6', 10, NULL),
    ('SERIES1', 'SERIES1_FAIXA_1_ATE_MOIC', 'Faixa I: até o múltiplo do capital', 1.00, NULL, NULL, 'x', BK || ', secao 6', 11, NULL),
    ('SERIES1', 'SERIES1_FAIXA_1_MULTIPLO_ESPERADO', 'Faixa I: múltiplo acumulado esperado', 1.00, NULL, NULL, 'x', BK || ', secao 6 (quarta coluna)', 12, NULL),
    ('SERIES1', 'SERIES1_FAIXA_2_PCT', 'Faixa II: parte do cotista no CDE', 0.30, NULL, NULL, '%', BK || ', secao 6', 13, NULL),
    ('SERIES1', 'SERIES1_FAIXA_2_ATE_MOIC', 'Faixa II: até o múltiplo do capital', 1.50, NULL, NULL, 'x', BK || ', secao 6', 14, NULL),
    ('SERIES1', 'SERIES1_FAIXA_2_MULTIPLO_ESPERADO', 'Faixa II: múltiplo acumulado esperado', 1.15, NULL, NULL, 'x', BK || ', secao 6 (quarta coluna)', 15, NULL),
    ('SERIES1', 'SERIES1_FAIXA_3_PCT', 'Faixa III: parte do cotista no CDE', 0.20, NULL, NULL, '%', BK || ', secao 6', 16, NULL),
    ('SERIES1', 'SERIES1_FAIXA_3_ATE_MOIC', 'Faixa III: até o múltiplo do capital', 2.00, NULL, NULL, 'x', BK || ', secao 6', 17, NULL),
    ('SERIES1', 'SERIES1_FAIXA_3_MULTIPLO_ESPERADO', 'Faixa III: múltiplo acumulado esperado', 1.35, NULL, NULL, 'x', BK || ', secao 6 (quarta coluna)', 18, NULL),
    ('SERIES1', 'SERIES1_FAIXA_4_PCT', 'Faixa IV: parte do cotista no CDE', 0.10, NULL, NULL, '%', BK || ', secao 6', 19, NULL),
    ('SERIES1', 'SERIES1_FAIXA_4_MULTIPLO_ESPERADO', 'Faixa IV: múltiplo acumulado esperado', 1.50, NULL, NULL, 'x', BK || ', secao 6 (quarta coluna)', 20, NULL),
    ('SERIES1', 'SERIES1_RENDA_12M', 'Renda projetada por quota nos 12 meses seguintes ao início', 376113.06, NULL, NULL, 'R$', BK || ', secoes 4 e 11', 30, NULL),
    ('SERIES1', 'SERIES1_RENDA_2027', 'Renda projetada por quota em 2027', 212804.00, NULL, NULL, 'R$', BK || ', secao 10', 31, NULL),
    ('SERIES1', 'SERIES1_RENDA_2028', 'Renda projetada por quota em 2028', 390853.10, NULL, NULL, 'R$', BK || ', secao 10', 32, NULL),
    ('SERIES1', 'SERIES1_RENDA_2029', 'Renda projetada por quota em 2029', 417925.80, NULL, NULL, 'R$', BK || ', secao 10', 33, NULL),
    ('SERIES1', 'SERIES1_RENDA_2030', 'Renda projetada por quota em 2030', 446873.80, NULL, NULL, 'R$', BK || ', secao 10', 34, NULL),
    ('SERIES1', 'SERIES1_RENDA_2031', 'Renda projetada por quota em 2031', 476495.80, NULL, NULL, 'R$', BK || ', secao 10', 35, NULL),
    ('SERIES1', 'SERIES1_RENDA_2032', 'Renda projetada por quota em 2032', 510923.90, NULL, NULL, 'R$', BK || ', secao 10', 36, NULL),
    ('SERIES1', 'SERIES1_RENDA_2033', 'Renda projetada por quota em 2033', 546313.40, NULL, NULL, 'R$', BK || ', secao 10', 37, NULL),
    ('SERIES1', 'SERIES1_RENDA_2034', 'Renda projetada por quota em 2034', 582527.10, NULL, NULL, 'R$', BK || ', secao 10', 38, NULL),
    ('SERIES1', 'SERIES1_RENDA_2035', 'Renda projetada por quota em 2035', 624616.10, NULL, NULL, 'R$', BK || ', secao 10', 39, NULL),
    ('SERIES1', 'SERIES1_CHOQUE_90', 'Renda com choque de 90% do fluxo', 338501.75, NULL, NULL, 'R$', BK || ', secao 11', 40, NULL),
    ('SERIES1', 'SERIES1_CHOQUE_75', 'Renda com choque de 75% do fluxo', 282084.80, NULL, NULL, 'R$', BK || ', secao 11', 41, NULL),
    ('SERIES1', 'SERIES1_CHOQUE_60', 'Renda com choque de 60% do fluxo', 225667.84, NULL, NULL, 'R$', BK || ', secao 11', 42, NULL),
    ('SERIES1', 'SERIES1_JANELA_INICIO', 'Início da janela de subscrição', NULL, '01/10/2026', DATE '2026-10-01', NULL, BK || ', secao 7', 50, NULL),
    ('SERIES1', 'SERIES1_JANELA_FIM', 'Fim da janela de subscrição', NULL, '31/03/2027', DATE '2027-03-31', NULL, BK || ', secao 7', 51, NULL),
    ('SERIES1', 'SERIES1_PRIMEIRA_DISTRIBUICAO', 'Primeira distribuição (semestral)', NULL, '30/06/2027', DATE '2027-06-30', NULL, BK || ', secao 7', 52, NULL),
    ('SERIES1', 'SERIES1_PERIODICIDADE', 'Periodicidade das distribuições', NULL, 'semestral', NULL, NULL, BK || ', secao 7', 53, NULL),
    ('SERIES1', 'SERIES1_INICIO_PARTICIPACAO', 'Início da participação', NULL, '2º semestre de 2026', NULL, NULL, BK || ', secao 7', 54, NULL),
    ('SERIES1', 'SERIES1_QUOTA1_INGRESSO', 'Ingresso da Quota nº 1 (Operação Âncora) na Series#1', NULL, '01/10/2026', DATE '2026-10-01', NULL, DEC, 55, NULL),
    ('SERIES1', 'SERIES1_PISO_REMUNERACAO', 'Piso da remuneração (80% da taxa de administração)', NULL, 'a modelar quando o contrato de administração hoteleira for celebrado', NULL, NULL, DEC, 56, NULL),
    ('DIVIDA_REAL', 'DIVIDA_VALOR', 'Dívida confessada pela REAL em favor da F5 (fixa)', 54418451.00, NULL, NULL, 'R$', TR || '; valor fixado em reais por ' || DEC, 1, 'REAL'),
    ('DIVIDA_REAL', 'DIVIDA_VALOR_EUR', 'Dívida confessada (montante de referência em euros)', 8748947.11, NULL, NULL, 'EUR', TR || ', considerando A', 2, 'REAL'),
    ('DIVIDA_REAL', 'DIVIDA_DATA', 'Data da confissão de dívida', NULL, '31/10/2025', DATE '2025-10-31', NULL, TR, 3, 'REAL'),
    ('DIVIDA_REAL', 'DIVIDA_CREDORA', 'Credora', NULL, 'F5', NULL, NULL, TR || ', considerando A', 4, 'REAL'),
    ('DIVIDA_REAL', 'DIVIDA_DEVEDORA', 'Devedora', NULL, 'REAL', NULL, NULL, TR || ', considerando A', 5, 'REAL'),
    ('DIVIDA_REAL', 'PARTICIPACAO_CONCEDENTE', 'Concedente da participação econômica', NULL, 'SUNRISE', NULL, NULL, TR || ', considerando B e clausula 1', 6, 'REAL'),
    ('DIVIDA_REAL', 'CONTRAPARTIDA_PCT_APORTE', 'Contrapartida da REAL sobre cada aporte', 0.10, NULL, NULL, '%', BK || ', secoes 7 e 9; ' || DEC, 7, 'REAL'),
    ('DIVIDA_REAL', 'CONTRAPARTIDA_BASE', 'Base da contrapartida', NULL, 'aportes liquidos de devolucoes ao Adquirente, inclusive os da Operacao Ancora', NULL, NULL, DEC, 8, 'REAL'),
    ('DIVIDA_REAL', 'LIQUIDACAO', 'Forma de liquidação da dívida', NULL, 'compensacao da contrapartida de 10% ate a quitacao; depois, exigivel pela REAL', NULL, NULL, TR || ', clausula 3.1; ' || DEC, 9, 'REAL'),
    ('DIVIDA_REAL', 'RESULTADO_NATUREZA', 'Natureza do resultado da REAL', NULL, 'lucro ou prejuizo', NULL, NULL, TR || ', clausulas 2.2 e 7.2', 10, 'REAL'),
    ('DIVIDA_REAL', 'DEMONSTRATIVO_PERIODICIDADE', 'Periodicidade dos demonstrativos à REAL', NULL, 'semestral', NULL, NULL, TR || ', clausula 7.A.1; ' || DEC, 11, 'REAL'),
    ('PASSIVOS', 'SUBORDINACAO', 'Subordinação dos cotistas', NULL, 'primeira distribuicao aos cotistas somente apos a quitacao dos passivos da HOTELSYS', NULL, NULL, BK || ', secoes 7 e 9; ' || DEC, 1, NULL),
    ('PASSIVOS', 'ESTOQUE_FONTE', 'Fonte do estoque de passivos', NULL, 'contabilidade da HOTELSYS (contas a definir), conciliada com as aplicacoes que pagam passivo; estoque informado ate a escrituracao estar no LEDGR', NULL, NULL, DEC, 2, NULL),
    ('CRONOGRAMA', 'FASE_1', 'Fase 1 - Teste concluído', NULL, '2025 a 2026: abordagem direta, teste do modelo e aporte do investidor ancora', NULL, NULL, BK || ', secao 12', 1, NULL),
    ('CRONOGRAMA', 'FASE_2', 'Fase 2 - Estruturação', NULL, '2026: contratos em bloco (administracao hoteleira + retrofit), distribuidora e taxas finais', NULL, NULL, BK || ', secao 12', 2, NULL),
    ('CRONOGRAMA', 'FASE_3', 'Fase 3 - Colocação âncora', NULL, '1o semestre de 2027: quotas senior junto a investidores institucionais e family offices', NULL, NULL, BK || ', secao 12', 3, NULL),
    ('CRONOGRAMA', 'FASE_4', 'Fase 4 - Plano de vendas agressivo', NULL, '2o semestre de 2027 e 2028: distribuicao ao mercado', NULL, NULL, BK || ', secao 12', 4, NULL)
  ) AS x(grupo, codigo, nome, num, txt, dt, un, fonte, ord, op);
  RAISE NOTICE 'versao % criada; versao 1 encerrada', v_n;
END $$;
COMMIT;
WITH v AS (SELECT id, numero FROM proj_premissa_versoes WHERE projeto_id = (SELECT id FROM proj_projetos WHERE codigo = 'RECIFE-OCEAN') AND cancelado_em IS NULL ORDER BY numero DESC LIMIT 1)
SELECT 'versao ' || v.numero AS versao, p.grupo, count(*) AS premissas FROM v JOIN proj_premissas p ON p.versao_id = v.id GROUP BY v.numero, p.grupo ORDER BY p.grupo;
WITH v AS (SELECT id FROM proj_premissa_versoes WHERE projeto_id = (SELECT id FROM proj_projetos WHERE codigo = 'RECIFE-OCEAN') AND cancelado_em IS NULL ORDER BY numero DESC LIMIT 1),
f AS (SELECT exp(sum(ln(1 + p.valor_num))) AS fator FROM v JOIN proj_premissas p ON p.versao_id = v.id WHERE p.grupo = 'REEXPRESSAO' AND p.codigo LIKE 'IPCA_%'),
r AS (SELECT sum(p.valor_num) FILTER (WHERE p.codigo IN ('RECEITAS', 'DESPESAS')) AS res FROM v JOIN proj_premissas p ON p.versao_id = v.id WHERE p.grupo = 'BP_2018')
SELECT round(r.res * f.fator, 2) AS resultado_bp_dez2025, round(0.80 * 5000000 / (r.res * f.fator) * 100, 4) AS pct_por_quota FROM r, f;
SELECT codigo, nome, tipo, paga_passivo FROM proj_naturezas_aplicacao ORDER BY tipo, nome;