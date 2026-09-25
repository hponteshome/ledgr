-- 24/09/2026 - Hard delete do Plano de Contas da F5 (e274dfc0-0a9a-4af1-8141-f35ff73fac93),
-- a pedido do usuario, para recomecar a contabilidade do zero.
-- Confirmado antes: 414 contas, todas origem MATRIZ, 0 lancamentos, 0 saldos,
-- 0 ECD, 0 mapeamentos, 0 vinculos em nenhuma outra tabela do sistema.
-- FK parent_id (auto-referencia da arvore) tem ON DELETE SET NULL - um unico
-- DELETE resolve, sem precisar apagar por nivel.
-- Rollback: restaurar o backup D:\Backups\ledgr-postgres anterior a esta migracao
-- (hard delete nao e reversivel por SQL).
BEGIN;

DO $$
DECLARE
  v_antes int;
BEGIN
  SELECT count(*) INTO v_antes FROM chart_of_accounts
    WHERE company_id = 'e274dfc0-0a9a-4af1-8141-f35ff73fac93' AND deleted_at IS NULL;
  IF v_antes <> 414 THEN
    RAISE EXCEPTION 'Guarda falhou: esperava 414 contas ativas na F5, encontrei %. Nada foi apagado.', v_antes;
  END IF;
END $$;

DELETE FROM chart_of_accounts WHERE company_id = 'e274dfc0-0a9a-4af1-8141-f35ff73fac93';

DO $$
DECLARE
  v_depois int;
BEGIN
  SELECT count(*) INTO v_depois FROM chart_of_accounts WHERE company_id = 'e274dfc0-0a9a-4af1-8141-f35ff73fac93';
  IF v_depois <> 0 THEN
    RAISE EXCEPTION 'Falha ao confirmar o delete: ainda restam % linhas na F5.', v_depois;
  END IF;
END $$;

COMMIT;