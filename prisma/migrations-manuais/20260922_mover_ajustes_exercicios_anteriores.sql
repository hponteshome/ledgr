-- 22/09/2026 - Reclassifica "Ajustes de Exercicios Anteriores" (reduced_code 2407)
-- do grupo 2330101 (Lucros Acumulados) para 2330102 (Prejuizos Acumulados),
-- na Hotelsys e no Plano Matriz (mesmo codigo nos dois, para o casamento por
-- codigo na reimportacao da Matriz continuar funcionando). reduced_code e id
-- preservados; journal_entry_items e ecd_account_mappings apontam pelo id,
-- nao sao alterados.
-- Rollback:
--   UPDATE chart_of_accounts SET parent_id='880b1658-9c04-45c3-9dbf-eb8ddfb018c5', code='23301010004', updated_at=now()
--     WHERE id='02a0f4d0-6b0b-4c19-b160-8ed1380bbaf5';
--   UPDATE matriz_master_accounts SET parent_id='30734395-8efb-4dea-b332-4965916b43a9', code='23301010004', updated_at=now()
--     WHERE id='e5b9421d-047c-4532-b0e8-49b65e2c6b6d';
BEGIN;

DO $$
DECLARE
  v_reduced text;
BEGIN
  SELECT reduced_code INTO v_reduced FROM chart_of_accounts
    WHERE id = '02a0f4d0-6b0b-4c19-b160-8ed1380bbaf5'
      AND code = '23301010004'
      AND parent_id = '880b1658-9c04-45c3-9dbf-eb8ddfb018c5'
      AND deleted_at IS NULL;
  IF v_reduced IS DISTINCT FROM '2407' THEN
    RAISE EXCEPTION 'Guarda falhou: conta Hotelsys nao esta mais no estado esperado (code/parent_id/reduced_code). Nada foi alterado.';
  END IF;

  SELECT reduced_code INTO v_reduced FROM matriz_master_accounts
    WHERE id = 'e5b9421d-047c-4532-b0e8-49b65e2c6b6d'
      AND code = '23301010004'
      AND parent_id = '30734395-8efb-4dea-b332-4965916b43a9'
      AND deleted_at IS NULL;
  IF v_reduced IS DISTINCT FROM '2407' THEN
    RAISE EXCEPTION 'Guarda falhou: conta Matriz nao esta mais no estado esperado (code/parent_id/reduced_code). Nada foi alterado.';
  END IF;

  IF EXISTS (SELECT 1 FROM chart_of_accounts WHERE company_id = (SELECT company_id FROM chart_of_accounts WHERE id='02a0f4d0-6b0b-4c19-b160-8ed1380bbaf5') AND code = '23301020003' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Guarda falhou: ja existe conta com o codigo 23301020003 na Hotelsys.';
  END IF;
  IF EXISTS (SELECT 1 FROM matriz_master_accounts WHERE code = '23301020003' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Guarda falhou: ja existe conta com o codigo 23301020003 na Matriz.';
  END IF;
END $$;

UPDATE chart_of_accounts
   SET parent_id = 'c46a9f27-6fbd-4a46-8e9c-1bdd35574486',
       code       = '23301020003',
       updated_at = now()
 WHERE id = '02a0f4d0-6b0b-4c19-b160-8ed1380bbaf5';

UPDATE matriz_master_accounts
   SET parent_id = 'e0c188c2-f6bf-4364-9fbc-b5762cafc75c',
       code       = '23301020003',
       updated_at = now()
 WHERE id = 'e5b9421d-047c-4532-b0e8-49b65e2c6b6d';

DO $$
BEGIN
  IF (SELECT count(*) FROM chart_of_accounts WHERE id='02a0f4d0-6b0b-4c19-b160-8ed1380bbaf5' AND parent_id='c46a9f27-6fbd-4a46-8e9c-1bdd35574486' AND code='23301020003') <> 1
  THEN RAISE EXCEPTION 'Falha ao confirmar a atualizacao na Hotelsys.'; END IF;
  IF (SELECT count(*) FROM matriz_master_accounts WHERE id='e5b9421d-047c-4532-b0e8-49b65e2c6b6d' AND parent_id='e0c188c2-f6bf-4364-9fbc-b5762cafc75c' AND code='23301020003') <> 1
  THEN RAISE EXCEPTION 'Falha ao confirmar a atualizacao na Matriz.'; END IF;
END $$;

COMMIT;