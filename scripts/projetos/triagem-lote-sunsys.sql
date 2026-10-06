-- scripts/projetos/triagem-lote-sunsys.sql
-- Triagem em lote das saidas da SUNSYS (Operacao Ancora), 06/10/2026, pelas categorias da planilha (anotacoes do extrato).
-- Decisoes do Hpontes: impostos, trabalhistas, reembolsos e honorarios pagam passivo; manutencao, folha e contabilidade correntes
-- = Manutencao da Operacao (nao paga passivo); estornos = transferencia interna (circuito "Estornos bancarios").
-- Casos ambiguos (grupo H) ficam para a tela de triagem. Transacao unica; historico por movimento com lote "triagem-lote-20261006".
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE lote_regras (grupo text, destino text, natureza text, circuito text, padrao text) ON COMMIT DROP;
INSERT INTO lote_regras VALUES
  ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'RECEITA FEDERAL'), ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'ACORDO PGFN'),
  ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'Parcelamento Federal'), ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'IMPOSTOS'),
  ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'impostos'), ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'PARCELA IMPOSTO - PAGA PELO C6 BANK'),
  ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'IMPOSTO RECEITA FEDERAL'), ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'IPTU'),
  ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'impostos Municipais'), ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'Taxas Municipais'),
  ('A Impostos', 'APLICACAO', 'IMPOSTOS', NULL, 'PAGAMENTO INSS PROCESSO'),
  ('B Trabalhistas', 'APLICACAO', 'TRABALHISTA', NULL, 'Acordo Trabalhista'), ('B Trabalhistas', 'APLICACAO', 'TRABALHISTA', NULL, 'Acordo Gurgel Adv'),
  ('B Trabalhistas', 'APLICACAO', 'TRABALHISTA', NULL, 'FOI PAGO : CUSTAS PROCESSO CINTIA%'), ('B Trabalhistas', 'APLICACAO', 'TRABALHISTA', NULL, 'ACORDO TRABALHISTA IVONE SANTOS%'),
  ('B Trabalhistas', 'APLICACAO', 'TRABALHISTA', NULL, 'Salários - ACORDO TRABALHISTA IVONE%'), ('B Trabalhistas', 'APLICACAO', 'TRABALHISTA', NULL, '5K DESTE DINHEIRO FOI PAGO%'),
  ('B Trabalhistas', 'APLICACAO', 'TRABALHISTA', NULL, 'Custas Processo'), ('B Trabalhistas', 'APLICACAO', 'TRABALHISTA', NULL, 'REEMBOLSO PROCESSO NEILSON%'),
  ('B Trabalhistas', 'APLICACAO', 'TRABALHISTA', NULL, 'TAXA ARBITRAGEM'),
  ('C Reembolsos', 'APLICACAO', 'REEMBOLSOS', NULL, 'REEMBOLSO CARLOS H ALBES'), ('C Reembolsos', 'APLICACAO', 'REEMBOLSOS', NULL, 'REEMBOLSO BLOQUEIO JUDICIAL DE 45K%'),
  ('D Honorarios', 'APLICACAO', 'HONORARIOS', NULL, 'SCANDINAVOS + CONTABILIDADE'), ('D Honorarios', 'APLICACAO', 'HONORARIOS', NULL, 'ADV DR. FERNANDO GALVAO'),
  ('D Honorarios', 'APLICACAO', 'HONORARIOS', NULL, 'PARCELA 6/6 BALANÇOS HOTELSYS 8 ANOS'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Pagamento Seg Segurança'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'SICASI PAGAMENTO MATRICULAS IMOVEIS'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'REGISTRO CARTORIO NOTAS'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'CERTIDAO IMOVEL'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Manutenção e Reparos'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Despesas Bancárias'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Copa e Cozinha'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'JUCEPE - %'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'CERTISING CERTIFICADORA DIGIGTAL'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'MATERIAL LIMPEZA'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'LATERNAS/PILHAS'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'PILHA E LANTERNA'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'MAURO JOSÉ CANDIDO - FORNECEDOR AGUA MINERAL'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Fornecedor de agua mineral'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'CANAL CONSTRUÇAO'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'MENSALIDADE DE UMA MAQUINETA DO REDECARD'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'VINDI PAGAMENTOS'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'PAGAR.ME'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'PAGAR-ME ???'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'PAGARM-ME'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'INBRAND'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'SP RIO JANEIRO'),
  ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'COMBUSTIVEL AUDIENCIA IPOJUCA'), ('E Manutencao', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'REEMBOLSO CLAUDIO / ALEX'),
  ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Salários'), ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'FOLHA SALARIOS'),
  ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Vale Refeição'), ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Vale Transporte'),
  ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, '13 HELTON%'), ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, '13 SALARIO %'),
  ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'EXTRA IZAQUIEL MATIAS'), ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Vestuário Funcionários'),
  ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'CLAUDIO BALBINO FUNCIONÁRIO'), ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'ALEXANDRO JOSÉ DOS SANTOS ( FUNCIONÁRIO )'),
  ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'PRESENTE ANIVERSÁRIO%'), ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Visão Contábil'),
  ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Teixeira Contábil'), ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'JS TEIXEIRA CONTABIL'),
  ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'CONSULT CONTABIL'), ('F Folha e contabilidade correntes', 'APLICACAO', 'MANUTENCAO_OPERACAO', NULL, 'Salários + Contabilidade'),
  ('G Estornos (circuito)', 'DECISAO', NULL, 'Estornos bancários', 'estornado');

CREATE TEMP TABLE lote_ctx ON COMMIT DROP AS
SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') AS master, pp.company_id AS empresa, o.id AS operacao
FROM proj_participacoes pp JOIN proj_papeis pa ON pa.id = pp.papel_id JOIN proj_operacoes o ON o.id = pp.operacao_id
WHERE o.codigo = 'ANCORA' AND pa.codigo = 'RECEBEDORA_FINANCEIRA' AND pp.cancelado_em IS NULL LIMIT 1;

CREATE TEMP TABLE lote_plano ON COMMIT DROP AS
SELECT p.id, p.data, p.amount, p.categoria, r.grupo, r.destino, r.natureza, r.circuito
FROM (SELECT bt.id, bt.transaction_date::date AS data, bt.amount, COALESCE(NULLIF(trim(split_part(a.texto, '|', 1)), ''), '(sem anotacao)') AS categoria
      FROM bank_transactions bt JOIN lote_ctx c ON c.empresa = bt.company_id
      LEFT JOIN proj_anotacoes_extrato a ON a.bank_transaction_id = bt.id
      WHERE bt.type::text = 'DEBIT'
        AND NOT EXISTS (SELECT 1 FROM proj_aplicacoes x WHERE x.bank_transaction_id = bt.id AND x.cancelado_em IS NULL)
        AND NOT EXISTS (SELECT 1 FROM proj_extrato_decisoes d WHERE d.bank_transaction_id = bt.id AND d.cancelado_em IS NULL)) p
JOIN LATERAL (SELECT * FROM lote_regras r WHERE p.categoria LIKE r.padrao ORDER BY length(r.padrao) DESC LIMIT 1) r ON true;

WITH ins AS (
  INSERT INTO proj_aplicacoes (operacao_id, bank_transaction_id, natureza_id, data_aplicacao, valor, motivo, criado_por_id)
  SELECT c.operacao, p.id, n.id, p.data, p.amount,
         format('Triagem em lote de 06/10/2026 - categoria da planilha "%s" (%s).', left(p.categoria, 120), p.grupo), c.master
  FROM lote_plano p CROSS JOIN lote_ctx c JOIN proj_naturezas_aplicacao n ON n.codigo = p.natureza AND n.ativo
  WHERE p.destino = 'APLICACAO'
  RETURNING id, natureza_id, valor, motivo)
INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
SELECT gen_random_uuid(), c.master, 'PROJ_APLICACAO_REGISTRADA', ins.id::text,
       jsonb_build_object('companyId', c.empresa, 'operacaoId', c.operacao, 'natureza', n.codigo, 'valor', to_char(ins.valor, 'FM9999999990.00'), 'motivo', ins.motivo, 'lote', 'triagem-lote-20261006'), now()
FROM ins CROSS JOIN lote_ctx c JOIN proj_naturezas_aplicacao n ON n.id = ins.natureza_id;

WITH ins AS (
  INSERT INTO proj_extrato_decisoes (operacao_id, bank_transaction_id, decisao, circuito, motivo, criado_por_id)
  SELECT c.operacao, p.id, 'TRANSFERENCIA_INTERNA', p.circuito,
         format('Triagem em lote de 06/10/2026 - categoria da planilha "%s" (%s).', left(p.categoria, 120), p.grupo), c.master
  FROM lote_plano p CROSS JOIN lote_ctx c WHERE p.destino = 'DECISAO'
  RETURNING bank_transaction_id, circuito, motivo)
INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
SELECT gen_random_uuid(), c.master, 'PROJ_EXTRATO_MOVIMENTO_DECIDIDO', ins.bank_transaction_id::text,
       jsonb_build_object('companyId', c.empresa, 'tipo', 'DEBIT', 'decisao', 'TRANSFERENCIA_INTERNA', 'circuito', ins.circuito, 'operacoes', jsonb_build_array(c.operacao), 'motivo', ins.motivo, 'lote', 'triagem-lote-20261006'), now()
FROM ins CROSS JOIN lote_ctx c;

SELECT p.grupo, count(*) AS registros, to_char(sum(p.amount), 'FM999G999G990D00') AS total FROM lote_plano p GROUP BY p.grupo ORDER BY p.grupo;
COMMIT;

SELECT 'historico do lote: ' || count(*) || ' registros' AS conferencia FROM audit_logs WHERE depois->>'lote' = 'triagem-lote-20261006'
UNION ALL
SELECT 'saidas ainda pendentes (tela de triagem): ' || count(*) || ', ' || to_char(COALESCE(sum(bt.amount), 0), 'FM999G999G990D00')
FROM bank_transactions bt
WHERE bt.company_id = (SELECT pp.company_id FROM proj_participacoes pp JOIN proj_papeis pa ON pa.id = pp.papel_id JOIN proj_operacoes o ON o.id = pp.operacao_id WHERE o.codigo = 'ANCORA' AND pa.codigo = 'RECEBEDORA_FINANCEIRA' AND pp.cancelado_em IS NULL LIMIT 1)
  AND bt.type::text = 'DEBIT'
  AND NOT EXISTS (SELECT 1 FROM proj_aplicacoes x WHERE x.bank_transaction_id = bt.id AND x.cancelado_em IS NULL)
  AND NOT EXISTS (SELECT 1 FROM proj_extrato_decisoes d WHERE d.bank_transaction_id = bt.id AND d.cancelado_em IS NULL)
UNION ALL
SELECT 'pagamentos de passivo depois de 31/10/2025: ' || count(*) || ', ' || to_char(sum(a.valor), 'FM999G999G990D00')
FROM proj_aplicacoes a JOIN proj_naturezas_aplicacao n ON n.id = a.natureza_id WHERE a.cancelado_em IS NULL AND n.paga_passivo AND a.data_aplicacao > DATE '2025-10-31'
UNION ALL
SELECT 'aplicacoes por natureza: ' || string_agg(n.nome || ' ' || to_char(t.total, 'FM999G999G990D00'), '; ' ORDER BY t.total DESC)
FROM (SELECT natureza_id, sum(valor) AS total FROM proj_aplicacoes WHERE cancelado_em IS NULL GROUP BY natureza_id) t JOIN proj_naturezas_aplicacao n ON n.id = t.natureza_id;