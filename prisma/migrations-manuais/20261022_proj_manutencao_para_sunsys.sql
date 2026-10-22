-- prisma/migrations-manuais/20261022_proj_manutencao_para_sunsys.sql
-- 22/10/2026 - Projeto: nao existe "Manutencao da Operacao". As aplicacoes com essa natureza passam a "Despesa propria da
-- Sunsys", como a tela de reclassificacao faz (aplicacao imutavel: encerrada com motivo e substituida por outra, mesma saida,
-- data, valor, beneficiario e credito). Alem do que a tela faz, leva junto:
--  - o vinculo do Anexo V (fora do Anexo V) das que tinham (encerrado e recriado na nova);
--  - os vinculos de documentos (proj_documento_vinculos), copiados para a nova e encerrados na antiga.
-- FICAM DE FORA as 2 saidas de 05 e 06/08/2024 (R$ 150.000,00, "Pagamento Seg Seguranca", pagas com o emprestimo com
-- garantia): aguardam decisao. Reexecutar nao duplica.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE usr uuid := '421642c8-e981-49c9-996c-b4bfabc22b52';
  n_man uuid; n_sun uuid; a record; v record; d record; nova uuid; mot text; n int := 0; s numeric := 0; nd int := 0; nv int := 0;
  set_canc text; tem_criado_em bool; tem_criado_por bool;
  fora_lista uuid[] := ARRAY['e3b67036-e712-4d73-a2bc-c4f735322448', '148bd3ad-222b-4234-bbfb-81a3dd642451']::uuid[];
BEGIN
  SELECT id INTO n_man FROM proj_naturezas_aplicacao WHERE codigo = 'MANUTENCAO_OPERACAO';
  SELECT id INTO n_sun FROM proj_naturezas_aplicacao WHERE codigo = 'DESPESA_PROPRIA_SUNSYS' AND ativo AND tipo = 'APLICACAO';
  IF n_man IS NULL OR n_sun IS NULL THEN RAISE EXCEPTION 'Naturezas nao encontradas - nada alterado'; END IF;
  SELECT count(*), COALESCE(sum(valor), 0) INTO n, s FROM proj_aplicacoes WHERE natureza_id = n_man AND cancelado_em IS NULL AND id <> ALL(fora_lista);
  IF n = 0 THEN RAISE NOTICE 'Nada a reclassificar (ja aplicado)'; RETURN; END IF;
  IF n <> 93 OR s <> 174984.63 THEN RAISE EXCEPTION 'Esperado 93 aplicacoes / 174984.63; encontrado % / % - nada alterado', n, s; END IF;
  IF EXISTS (SELECT 1 FROM proj_comprovante_vinculos c JOIN proj_aplicacoes x ON x.id = c.aplicacao_id
             WHERE x.natureza_id = n_man AND x.cancelado_em IS NULL AND c.cancelado_em IS NULL AND x.id <> ALL(fora_lista)) THEN
    RAISE EXCEPTION 'Ha DARF vinculado a aplicacao de Manutencao - nada alterado'; END IF;
  -- colunas de encerramento dos vinculos de documentos (montadas pelo que existe na tabela)
  SELECT string_agg(x, ', ') INTO set_canc FROM (
    SELECT 'cancelado_em = now()' x WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proj_documento_vinculos' AND column_name = 'cancelado_em')
    UNION ALL SELECT format('cancelado_por_id = %L::uuid', usr) WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proj_documento_vinculos' AND column_name = 'cancelado_por_id')
    UNION ALL SELECT 'motivo_cancelamento = ' || quote_literal('Aplicacao reclassificada para Despesa propria da Sunsys (22/10/2026): vinculo copiado para a nova aplicacao')
      WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proj_documento_vinculos' AND column_name = 'motivo_cancelamento')) q;
  IF set_canc IS NULL OR position('cancelado_em' IN set_canc) = 0 THEN RAISE EXCEPTION 'proj_documento_vinculos sem cancelado_em - nada alterado'; END IF;
  tem_criado_em := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proj_documento_vinculos' AND column_name = 'criado_em');
  tem_criado_por := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proj_documento_vinculos' AND column_name = 'criado_por_id');
  n := 0; s := 0;
  FOR a IN SELECT * FROM proj_aplicacoes WHERE natureza_id = n_man AND cancelado_em IS NULL AND id <> ALL(fora_lista) ORDER BY data_aplicacao, valor LOOP
    mot := 'Reclassificada/rateada: Nao existe Manutencao da Operacao - despesa propria da Sunsys (decisao de 22/10/2026)';
    -- vinculo do Anexo V (guardado para recriar)
    SELECT * INTO v FROM proj_aplicacao_anexo_v WHERE aplicacao_id = a.id AND cancelado_em IS NULL;
    UPDATE proj_aplicacao_anexo_v SET cancelado_em = now(), cancelado_por_id = usr, motivo_cancelamento = mot WHERE aplicacao_id = a.id AND cancelado_em IS NULL;
    UPDATE proj_aplicacoes SET cancelado_em = now(), cancelado_por_id = usr, motivo_cancelamento = mot WHERE id = a.id;
    INSERT INTO proj_aplicacoes (id, operacao_id, bank_transaction_id, natureza_id, data_aplicacao, valor, beneficiario_id, credito_id, descricao, motivo, criado_em, criado_por_id)
      VALUES (gen_random_uuid(), a.operacao_id, a.bank_transaction_id, n_sun, a.data_aplicacao, a.valor, a.beneficiario_id, a.credito_id, a.descricao, mot, now(), usr)
      RETURNING id INTO nova;
    IF v.id IS NOT NULL THEN
      INSERT INTO proj_aplicacao_anexo_v (id, aplicacao_id, item_id, fora_anexo, consta_reconciliacao, motivo, criado_em, criado_por_id)
        VALUES (gen_random_uuid(), nova, v.item_id, v.fora_anexo, v.consta_reconciliacao, v.motivo, now(), usr);
      nv := nv + 1;
    END IF;
    FOR d IN SELECT id FROM proj_documento_vinculos WHERE aplicacao_id = a.id AND cancelado_em IS NULL LOOP
      EXECUTE format('INSERT INTO proj_documento_vinculos SELECT (jsonb_populate_record(NULL::proj_documento_vinculos, to_jsonb(x) || %s)).* FROM proj_documento_vinculos x WHERE x.id = $1',
        'jsonb_build_object(''id'', gen_random_uuid(), ''aplicacao_id'', $2::uuid, ''cancelado_em'', NULL'
        || CASE WHEN tem_criado_em THEN ', ''criado_em'', now()' ELSE '' END
        || CASE WHEN tem_criado_por THEN ', ''criado_por_id'', $3::uuid' ELSE '' END || ')') USING d.id, nova, usr;
      EXECUTE format('UPDATE proj_documento_vinculos SET %s WHERE id = $1', set_canc) USING d.id;
      nd := nd + 1;
    END LOOP;
    INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), usr, 'PROJ_APLICACAO_RECLASSIFICADA', a.id::text,
      jsonb_build_object('operacaoId', a.operacao_id, 'de', 'MANUTENCAO_OPERACAO', 'valor', to_char(a.valor, 'FM999999990.00'),
        'partes', jsonb_build_array(jsonb_build_object('id', nova, 'natureza', 'DESPESA_PROPRIA_SUNSYS', 'valor', to_char(a.valor, 'FM999999990.00'))),
        'motivo', mot, 'lote', 'manutencao-sunsys-20261022'), now());
    n := n + 1; s := s + a.valor;
  END LOOP;
  RAISE NOTICE 'Reclassificadas: % aplicacoes (R$ %), % vinculos de documento copiados, % vinculos do Anexo V recriados', n, s, nd, nv;
END $$;
SELECT n.codigo, count(*) AS aplicacoes, sum(a.valor) AS valor FROM proj_aplicacoes a JOIN proj_naturezas_aplicacao n ON n.id = a.natureza_id
 WHERE a.cancelado_em IS NULL AND n.codigo IN ('MANUTENCAO_OPERACAO', 'DESPESA_PROPRIA_SUNSYS') GROUP BY 1 ORDER BY 1;
COMMIT;
