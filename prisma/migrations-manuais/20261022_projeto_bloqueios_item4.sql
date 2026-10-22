-- prisma/migrations-manuais/20261022_projeto_bloqueios_item4.sql
-- 22/10/2026 - Projeto (Operacao Ancora): os reembolsos de bloqueio judicial de 23/12/2025 (R$ 45.000,00, pagamento direto da custodia)
-- e de 21/01/2026 (R$ 49.250,03, bloqueio da acao Cintia) voltam ao Anexo V item 4 (acoes trabalhistas). Em 20/10/2026 tinham sido
-- tirados do Anexo V no Demonstrativo do Termo VAL. Vinculo atual encerrado com motivo; novo vinculo ao item 4. Muda o Doc. 21, Anexo I.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('app.user_id', '421642c8-e981-49c9-996c-b4bfabc22b52', true);
DO $$
DECLARE r record; n int := 0; item4 uuid := '6a4d55b8-59dc-430d-b747-10a7cd82e7f6'; usr uuid := '421642c8-e981-49c9-996c-b4bfabc22b52';
BEGIN
  FOR r IN SELECT * FROM proj_aplicacao_anexo_v WHERE id IN ('b9966fb8-dac7-4d3a-8106-327479226b02', 'c8d71c9b-178b-4e64-8fe1-94c389f2cb53') AND cancelado_em IS NULL AND fora_anexo LOOP
    UPDATE proj_aplicacao_anexo_v SET cancelado_em = now(), cancelado_por_id = usr,
      motivo_cancelamento = 'Bloqueio judicial usado em acao trabalhista: volta ao Anexo V item 4 (decisao de 22/10/2026)' WHERE id = r.id;
    INSERT INTO proj_aplicacao_anexo_v (id, aplicacao_id, custodia_lancamento_id, item_id, fora_anexo, consta_reconciliacao, motivo, criado_em, criado_por_id)
      VALUES (gen_random_uuid(), r.aplicacao_id, r.custodia_lancamento_id, item4, false, NULL, 'Reembolso de bloqueio judicial em acao trabalhista - Anexo V item 4', now(), usr);
    INSERT INTO audit_logs (id, actor_id, acao, target_id, depois, created_at)
      VALUES (gen_random_uuid(), usr, 'PROJ_ANEXO_V_RECLASSIFICADO', r.id::text, jsonb_build_object('de', 'FORA', 'para', 'ITEM_4', 'motivo', 'Bloqueio judicial usado em acao trabalhista'), now());
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Vinculos reclassificados para o item 4: %', n;
END $$;
COMMIT;
