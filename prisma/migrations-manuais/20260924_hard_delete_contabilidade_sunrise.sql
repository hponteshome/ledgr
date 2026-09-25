-- 24/09/2026 - Hard delete completo da contabilidade da Sunrise
-- (ad8ad459-40b4-47f5-8a9a-7e4688487b4f), a pedido do usuario, para
-- reimportar do zero (Matriz + ECD 2017 + ECF).
-- Confirmado antes: 482 contas, 0 lancamentos, 0 partidas, 291 account_balances,
-- 1 ecd_import, 28 ecd_account_mappings, 77 chart_of_accounts_ecd_imports.
-- Nenhum outro modulo vinculado (imobilizado/caixa pequeno/regras/AR/equivalencia
-- patrimonial todos zerados). Ordem: vinculos -> saldos -> importacao -> plano.
-- As 5 contas de encerramento configuradas em company_accounting_configs NAO
-- sao FK real, mas ficariam apontando para contas apagadas - zeradas junto
-- para reconfiguracao manual apos a reimportacao.
-- Rollback: restaurar o backup D:\Backups\ledgr-postgres anterior a esta
-- migracao (hard delete nao e reversivel por SQL).
BEGIN;

DO $$
DECLARE
  v_contas int; v_saldos int; v_map int; v_link int; v_imports int;
BEGIN
  SELECT count(*) INTO v_contas FROM chart_of_accounts WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f' AND deleted_at IS NULL;
  SELECT count(*) INTO v_saldos FROM account_balances ab JOIN chart_of_accounts coa ON coa.id = ab.account_id WHERE coa.company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f';
  SELECT count(*) INTO v_map FROM ecd_account_mappings m JOIN chart_of_accounts coa ON coa.id IN (m.source_account_id, m.target_account_id) WHERE coa.company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f';
  SELECT count(*) INTO v_link FROM chart_of_accounts_ecd_imports cei JOIN chart_of_accounts coa ON coa.id = cei.account_id WHERE coa.company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f';
  SELECT count(*) INTO v_imports FROM ecd_imports WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f' AND deleted_at IS NULL;
  IF v_contas <> 482 OR v_saldos <> 291 OR v_map <> 28 OR v_link <> 77 OR v_imports <> 1 THEN
    RAISE EXCEPTION 'Guarda falhou: esperava 482 contas/291 saldos/28 mapeamentos/77 vinculos/1 import, encontrei %/%/%/%/%. Nada foi apagado.', v_contas, v_saldos, v_map, v_link, v_imports;
  END IF;
END $$;

DELETE FROM ecd_account_mappings WHERE source_account_id IN (SELECT id FROM chart_of_accounts WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f')
   OR target_account_id IN (SELECT id FROM chart_of_accounts WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f');

DELETE FROM chart_of_accounts_ecd_imports WHERE account_id IN (SELECT id FROM chart_of_accounts WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f');

DELETE FROM account_balances WHERE account_id IN (SELECT id FROM chart_of_accounts WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f');

DELETE FROM ecd_imports WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f';

DELETE FROM chart_of_accounts WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f';

UPDATE company_accounting_configs
   SET encerramento_conta_apuracao_resultado_id = NULL,
       encerramento_conta_lucro_exercicio_id = NULL,
       encerramento_conta_prejuizo_exercicio_id = NULL,
       encerramento_conta_lucros_acumulados_id = NULL,
       encerramento_conta_prejuizos_acumulados_id = NULL
 WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f';

DO $$
DECLARE
  v_depois int;
BEGIN
  SELECT count(*) INTO v_depois FROM chart_of_accounts WHERE company_id = 'ad8ad459-40b4-47f5-8a9a-7e4688487b4f';
  IF v_depois <> 0 THEN
    RAISE EXCEPTION 'Falha ao confirmar o delete: ainda restam % contas.', v_depois;
  END IF;
END $$;

COMMIT;