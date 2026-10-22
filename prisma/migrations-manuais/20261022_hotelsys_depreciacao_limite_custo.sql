-- prisma/migrations-manuais/20261022_hotelsys_depreciacao_limite_custo.sql
-- 22/10/2026 - Hotelsys: depreciacao do modulo de ativo alem do custo, corrigida NA ORIGEM nos lancamentos mensais DEPR-AAAA-MM.
-- O modulo (backfill) depreciou mes a mes sem parar no custo e sem considerar a depreciacao acumulada que ja vinha da ECD (abertura 2018).
-- Limite = custo contabil da conta (razao). Para cada bem: mantem as parcelas ate completar o custo, reduz a parcela do mes em que
-- completa e retira (apaga as 2 partidas do bem, com auditoria) as parcelas seguintes, ate 09/2026:
--   Moveis e Utensilios   (12301130004/42601010004): integral ate 03/2020, 04/2020 = 25.460,88, retira 05/2020 em diante
--   Maquinas e Equip.     (12301130002/42601010002): integral ate 11/2022, 12/2022 = 168,89,    retira 01/2023 em diante
--   Central Telefonica    (12301130007/42601010007): integral ate 02/2019, 03/2019 = 1.080,50,  retira 04/2019 em diante
--   Software              (12301130008/42602010007): ja estava 100% depreciado na abertura - retira todas (2018 a 2026)
-- Cadastro do modulo: bens marcados como totalmente depreciados (acumulada = custo, valor contabil zero, vida restante zero, INACTIVE),
-- logs posteriores ao limite excluidos; custo do Software corrigido de 266.117,00 para 2.661,17 (igual ao razao).
-- Confere no fim: depreciacao acumulada = custo nas 4 contas, em 30/09/2026. Qualquer divergencia aborta tudo. Reexecutar nao duplica.
-- Depois: refazer na tela os encerramentos de 2019 a 2025 da Hotelsys.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE emp uuid := 'c2d48edc-28b7-4fd8-9272-b486449ab2cc'; usr uuid := '421642c8-e981-49c9-996c-b4bfabc22b52';
  r record; a_acc uuid; a_exp uuid; ids uuid[]; n int; tot numeric := 0; k int; v numeric; saldo numeric; custo numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs WHERE acao = 'CONTABIL_CORRECAO_ORIGEM' AND depois->>'pacote' = 'depreciacao-limite-20261022') THEN
    RAISE NOTICE 'Correcao ja aplicada - nada feito'; RETURN; END IF;
  FOR r IN SELECT * FROM (VALUES
      ('12301130004', '42601010004', 25707.97, '2020-04', 25460.88, '12301030001', 'a6f35489-92b2-46ca-839a-f023f4aeeba9'::uuid),
      ('12301130002', '42601010002',  5284.62, '2022-12',   168.89, '12301020001', '976b4161-ebf8-4f16-9ac6-17b9afa27af5'::uuid),
      ('12301130007', '42601010007',  2161.29, '2019-03',  1080.50, '12301100002', '836fed7c-22e0-4f7e-baa1-e80aea266928'::uuid),
      ('12301130008', '42602010007',  4435.28, '2017-12',     0.00, '12301110004', '17572c1e-27dd-4f17-8c0b-627766f4ca25'::uuid)
    ) t(acc, exp, mensal, mes_limite, valor_limite, conta_custo, ativo) LOOP
    SELECT id INTO a_acc FROM chart_of_accounts WHERE company_id = emp AND code = r.acc AND deleted_at IS NULL;
    SELECT id INTO a_exp FROM chart_of_accounts WHERE company_id = emp AND code = r.exp AND deleted_at IS NULL;
    IF a_acc IS NULL OR a_exp IS NULL THEN RAISE EXCEPTION 'Conta % ou % nao encontrada - nada alterado', r.acc, r.exp; END IF;
    -- mes do limite: reduz as 2 partidas do bem
    IF r.valor_limite > 0 THEN
      SELECT count(*) INTO k FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
       WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.reference = 'DEPR-' || r.mes_limite AND i.value = r.mensal
         AND ((i.account_id = a_acc AND i.type::text = 'CREDIT') OR (i.account_id = a_exp AND i.type::text = 'DEBIT'));
      IF k <> 2 THEN RAISE EXCEPTION 'DEPR-% conta %: esperado 2 partidas de %, encontrado % - nada alterado', r.mes_limite, r.acc, r.mensal, k; END IF;
      UPDATE journal_entry_items i SET value = r.valor_limite FROM journal_entries j
       WHERE j.id = i.journal_entry_id AND j.company_id = emp AND j.deleted_at IS NULL AND j.reference = 'DEPR-' || r.mes_limite AND i.value = r.mensal
         AND ((i.account_id = a_acc AND i.type::text = 'CREDIT') OR (i.account_id = a_exp AND i.type::text = 'DEBIT'));
      tot := tot + (r.mensal - r.valor_limite);
    END IF;
    -- meses seguintes: retira as 2 partidas do bem
    SELECT array_agg(i.id), count(*), COALESCE(sum(i.value) FILTER (WHERE i.type::text = 'CREDIT'), 0) INTO ids, n, v
      FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
     WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.source_module::text = 'ASSET' AND j.reference LIKE 'DEPR-%'
       AND substr(j.reference, 6, 7) > r.mes_limite AND j.date::date <= DATE '2026-09-30'
       AND ((i.account_id = a_acc AND i.type::text = 'CREDIT') OR (i.account_id = a_exp AND i.type::text = 'DEBIT'));
    IF n IS NULL OR n = 0 OR n % 2 <> 0 OR v <> r.mensal * (n / 2) THEN
      RAISE EXCEPTION 'Conta %: partidas a retirar inconsistentes (n=%, valor=%) - nada alterado', r.acc, n, v; END IF;
    INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), usr, 'CONTABIL_PARTIDA_REMOVIDA', r.acc,
      jsonb_build_object('motivo', 'Depreciacao alem do custo (modulo de ativo) - limite em ' || r.mes_limite, 'partidas', n, 'valor', v, 'itens', to_jsonb(ids)), now());
    DELETE FROM journal_entry_items WHERE id = ANY(ids);
    tot := tot + v;
    -- confere: acumulada = custo em 30/09/2026
    SELECT COALESCE(sum(CASE WHEN i.type::text = 'CREDIT' THEN i.value ELSE -i.value END), 0) INTO saldo
      FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id
     WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.date::date <= DATE '2026-09-30' AND i.account_id = a_acc;
    SELECT COALESCE(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 0) INTO custo
      FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts c ON c.id = i.account_id
     WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.date::date <= DATE '2026-09-30' AND c.company_id = emp AND c.code = r.conta_custo;
    IF saldo <> custo THEN RAISE EXCEPTION 'Conta %: acumulada % diferente do custo % depois da correcao - nada alterado', r.acc, saldo, custo; END IF;
    -- cadastro do modulo
    DELETE FROM asset_depreciation_logs WHERE asset_id = r.ativo AND company_id = emp AND to_char(period, 'YYYY-MM') > r.mes_limite;
    UPDATE fixed_assets SET acquisition_cost = custo, accumulated_depreciation = custo - residual_value, book_value = residual_value,
           remaining_life_months = 0, status = 'INACTIVE'::asset_status, updated_at = now()
     WHERE id = r.ativo AND company_id = emp;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bem % nao encontrado no cadastro - nada alterado', r.ativo; END IF;
  END LOOP;
  -- lancamentos mensais que ficaram sem partidas (so tinham esses bens) sao excluidos
  UPDATE journal_entries j SET deleted_at = now(), updated_at = now()
   WHERE j.company_id = emp AND j.deleted_at IS NULL AND j.source_module::text = 'ASSET' AND j.reference LIKE 'DEPR-%'
     AND NOT EXISTS (SELECT 1 FROM journal_entry_items i WHERE i.journal_entry_id = j.id);
  INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at) VALUES (gen_random_uuid(), usr, 'CONTABIL_CORRECAO_ORIGEM', 'depreciacao-limite-20261022',
    jsonb_build_object('pacote', 'depreciacao-limite-20261022', 'valor_retirado', tot, 'motivo', 'Depreciacao limitada ao custo'), now());
  RAISE NOTICE 'Correcao aplicada: depreciacao alem do custo retirada (total %)', tot;
END $$;
SELECT a.code, a.name,
       to_char(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END) FILTER (WHERE j.date::date <= DATE '2024-12-31'), 'FM999G999G990D00') AS saldo_31_12_2024,
       to_char(sum(CASE WHEN i.type::text = 'DEBIT' THEN i.value ELSE -i.value END), 'FM999G999G990D00') AS saldo_30_09_2026
  FROM journal_entry_items i JOIN journal_entries j ON j.id = i.journal_entry_id JOIN chart_of_accounts a ON a.id = i.account_id
 WHERE j.company_id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND j.deleted_at IS NULL AND j.date::date <= DATE '2026-09-30'
   AND a.code IN ('12301020001','12301130002','12301030001','12301130004','12301100002','12301130007','12301110004','12301130008')
 GROUP BY a.code, a.name ORDER BY a.code;
COMMIT;
