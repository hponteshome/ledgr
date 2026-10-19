-- prisma/migrations-manuais/20261019_sunsys_custodia_codigo.sql
-- 19/10/2026 - Sunsys: a conta "Custodia - Operacao Ancora (a reclassificar)" (reduzido 1062) usava o codigo
-- 11304010009, o mesmo da conta "Passivos quitados pela Operacao Ancora - a reclassificar" da Hotelsys (1065).
-- No Balanco Consolidado (soma por codigo) as duas caiam na mesma linha. A conta da Sunsys passa para o
-- primeiro codigo livre do grupo 1130401 nas 4 empresas do grupo. So muda o codigo: id, reduzido, nome e
-- lancamentos ficam iguais (os lancamentos apontam para o id da conta).
-- Rollback: UPDATE chart_of_accounts SET code = '11304010009' WHERE company_id = '6a13e876-7056-4076-a403-9610f7dc37b1' AND reduced_code LIKE '%1062' AND deleted_at IS NULL;
BEGIN;
DO $$
DECLARE
  v_sunsys uuid := '6a13e876-7056-4076-a403-9610f7dc37b1';
  v_grupo  uuid[] := ARRAY['6a13e876-7056-4076-a403-9610f7dc37b1','c2d48edc-28b7-4fd8-9272-b486449ab2cc','ad8ad459-40b4-47f5-8a9a-7e4688487b4f','e274dfc0-0a9a-4af1-8141-f35ff73fac93']::uuid[];
  v_id     uuid;
  v_nome   text;
  v_novo   text;
BEGIN
  SELECT id, name INTO v_id, v_nome FROM chart_of_accounts
   WHERE company_id = v_sunsys AND code = '11304010009' AND deleted_at IS NULL;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Sunsys: conta 11304010009 nao encontrada (ja foi movida?) - nada alterado';
  END IF;
  IF v_nome NOT ILIKE '%cust%' THEN
    RAISE EXCEPTION 'Sunsys: a conta 11304010009 nao e a Custodia (nome: %) - nada alterado', v_nome;
  END IF;
  SELECT min(c) INTO v_novo
    FROM (SELECT '1130401' || lpad(g::text, 4, '0') AS c FROM generate_series(10, 9999) g) x
   WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts a WHERE a.code = x.c AND a.company_id = ANY (v_grupo) AND a.deleted_at IS NULL);
  UPDATE chart_of_accounts SET code = v_novo, updated_at = now() WHERE id = v_id;
  RAISE NOTICE 'Sunsys Custodia: 11304010009 -> %', v_novo;
END $$;
COMMIT;
