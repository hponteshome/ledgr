-- prisma/migrations-manuais/20261022_proj_honorarios_para_sunsys.sql
-- 22/10/2026 - Projeto: honorarios contabeis (Visao Contabil e J S Teixeira) e reembolso de 81,80 pagos depois de 31/10/2025,
-- fora do Anexo V (8 aplicacoes, R$ 36.136,46), passam de Honorarios/Salarios para "Despesa propria da Sunsys", como ja estao na
-- contabilidade. Mesmo metodo do script de Manutencao: aplicacao encerrada com motivo e substituida; vinculo do Anexo V (fora)
-- e vinculos de documentos levados para a nova. Reexecutar nao duplica.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE usr uuid := '421642c8-e981-49c9-996c-b4bfabc22b52';
  n_sun uuid; a record; v record; d record; nova uuid; mot text; n int := 0; s numeric := 0; nd int := 0; nv int := 0;
  set_canc text; tem_criado_em bool; tem_criado_por bool;
  lista uuid[] := ARRAY['8ce60b5a-7f9d-4bab-946c-af0e6f24ac95','567d81c9-03a5-412e-9c21-a5985235c68d','6ea00e10-649f-4326-9fa8-cd7678771a26','5a44252e-6ec1-4ea0-9016-900477329bb7','42d5c85c-5768-4668-9987-8e37a9ee6c4f','de7c5248-7e16-4ab8-81b4-26444ca8f4ac','e6a3cc13-f353-45da-bb91-a1b1ba55fbd9','777a30f2-39dc-4062-85c7-d3e7ea8d70a1']::uuid[];
BEGIN
  SELECT id INTO n_sun FROM proj_naturezas_aplicacao WHERE codigo = 'DESPESA_PROPRIA_SUNSYS' AND ativo AND tipo = 'APLICACAO';
  IF n_sun IS NULL THEN RAISE EXCEPTION 'Naturezas nao encontradas - nada alterado'; END IF;
  SELECT count(*), COALESCE(sum(valor), 0) INTO n, s FROM proj_aplicacoes WHERE cancelado_em IS NULL AND id = ANY(lista);
  IF n = 0 THEN RAISE NOTICE 'Nada a reclassificar (ja aplicado)'; RETURN; END IF;
  IF n <> 8 OR s <> 36136.46 THEN RAISE EXCEPTION 'Esperado 8 aplicacoes / 36136.46; encontrado % / % - nada alterado', n, s; END IF;
  IF EXISTS (SELECT 1 FROM proj_comprovante_vinculos c JOIN proj_aplicacoes x ON x.id = c.aplicacao_id
             WHERE x.cancelado_em IS NULL AND c.cancelado_em IS NULL AND x.id = ANY(lista)) THEN
    RAISE EXCEPTION 'Ha DARF vinculado - nada alterado'; END IF;
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
  FOR a IN SELECT * FROM proj_aplicacoes WHERE cancelado_em IS NULL AND id = ANY(lista) ORDER BY data_aplicacao, valor LOOP
    mot := 'Reclassificada/rateada: honorarios contabeis e reembolso depois de 31/10/2025, fora do Anexo V - despesa propria da Sunsys (decisao de 22/10/2026)';
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
      jsonb_build_object('operacaoId', a.operacao_id, 'de', (SELECT codigo FROM proj_naturezas_aplicacao WHERE id = a.natureza_id), 'valor', to_char(a.valor, 'FM999999990.00'),
        'partes', jsonb_build_array(jsonb_build_object('id', nova, 'natureza', 'DESPESA_PROPRIA_SUNSYS', 'valor', to_char(a.valor, 'FM999999990.00'))),
        'motivo', mot, 'lote', 'honorarios-sunsys-20261022'), now());
    n := n + 1; s := s + a.valor;
  END LOOP;
  RAISE NOTICE 'Reclassificadas: % aplicacoes (R$ %), % vinculos de documento copiados, % vinculos do Anexo V recriados', n, s, nd, nv;
END $$;
SELECT n.codigo, count(*) AS aplicacoes, sum(a.valor) AS valor FROM proj_aplicacoes a JOIN proj_naturezas_aplicacao n ON n.id = a.natureza_id
 WHERE a.cancelado_em IS NULL AND a.data_aplicacao > DATE '2025-10-31' AND n.codigo IN ('HONORARIOS', 'SALARIOS', 'DESPESA_PROPRIA_SUNSYS')
   AND EXISTS (SELECT 1 FROM proj_aplicacao_anexo_v v WHERE v.aplicacao_id = a.id AND v.cancelado_em IS NULL AND v.fora_anexo) GROUP BY 1 ORDER BY 1;
COMMIT;
