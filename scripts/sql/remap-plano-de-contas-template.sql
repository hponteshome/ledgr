-- ============================================================
-- Template: remapeamento de plano de contas (transicao ECD -> Matriz)
-- Uso: substituir {{COMPANY_ID}} e o VALUES de _remap_map.
-- Reconferir a lista de FKs antes de rodar (pode ter crescido):
--   SELECT conrelid::regclass, conname FROM pg_constraint WHERE confrelid = 'chart_of_accounts'::regclass;
-- Reconferir tambem quais dessas tabelas tem UNIQUE envolvendo a coluna de conta -
-- essas exigem merge/dedup como account_balances e accounting_view_mappings abaixo,
-- nao update direto (ver hotelsys.md para o caso real que gerou este padrao).
-- ============================================================
BEGIN;

CREATE TEMP TABLE _remap_map (old_id uuid, new_id uuid) ON COMMIT DROP;

INSERT INTO _remap_map (old_id, new_id)
SELECT v.old_id, ca.id
FROM (VALUES
  -- ('<uuid conta origem>'::uuid, '<code conta destino>'),
  ('00000000-0000-0000-0000-000000000000'::uuid, '0000000')
) AS v(old_id, new_code)
JOIN chart_of_accounts ca
  ON ca.code = v.new_code
 AND ca.company_id = '{{COMPANY_ID}}'
 AND ca.deleted_at IS NULL;

SELECT count(*) AS mapeamentos_resolvidos FROM _remap_map;

-- account_balances: UNIQUE(account_id, reference_date) - merge por soma
WITH moves AS (
  SELECT ab.account_id AS old_account_id, m.new_id, ab.reference_date, ab.balance,
         ab.company_id, ab.created_by, ab.updated_by
  FROM account_balances ab JOIN _remap_map m ON ab.account_id = m.old_id
),
merged AS (
  SELECT new_id, reference_date, SUM(balance) AS total_balance,
         (array_agg(company_id))[1] AS company_id,
         (array_agg(created_by))[1] AS created_by,
         (array_agg(updated_by))[1] AS updated_by
  FROM moves GROUP BY new_id, reference_date
)
INSERT INTO account_balances (account_id, company_id, balance, reference_date, created_by, updated_by)
SELECT me.new_id, me.company_id, me.total_balance, me.reference_date, me.created_by, me.updated_by
FROM merged me
ON CONFLICT (account_id, reference_date)
DO UPDATE SET balance = account_balances.balance + EXCLUDED.balance, updated_at = now();

DELETE FROM account_balances ab USING _remap_map m WHERE ab.account_id = m.old_id;

-- accounting_view_mappings: UNIQUE(view_id, account_id) - dedup
WITH ranked AS (
  SELECT avm.id, ROW_NUMBER() OVER (PARTITION BY avm.view_id, m.new_id ORDER BY avm.ordem, avm.created_at) AS rn
  FROM accounting_view_mappings avm JOIN _remap_map m ON avm.account_id = m.old_id
)
DELETE FROM accounting_view_mappings WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DELETE FROM accounting_view_mappings avm USING _remap_map m
WHERE avm.account_id = m.old_id
  AND EXISTS (SELECT 1 FROM accounting_view_mappings existing WHERE existing.view_id = avm.view_id AND existing.account_id = m.new_id);

UPDATE accounting_view_mappings avm SET account_id = m.new_id FROM _remap_map m WHERE avm.account_id = m.old_id;

-- demais tabelas sem constraint sobre account_id isolado: update direto
UPDATE journal_entry_items jei SET account_id = m.new_id FROM _remap_map m WHERE jei.account_id = m.old_id;
UPDATE accounting_rules ar SET suggested_account_id = m.new_id FROM _remap_map m WHERE ar.suggested_account_id = m.old_id;
UPDATE fixed_assets fa SET asset_account_id = m.new_id FROM _remap_map m WHERE fa.asset_account_id = m.old_id;
UPDATE fixed_assets fa SET depreciation_acc_id = m.new_id FROM _remap_map m WHERE fa.depreciation_acc_id = m.old_id;
UPDATE fixed_assets fa SET accum_deprec_acc_id = m.new_id FROM _remap_map m WHERE fa.accum_deprec_acc_id = m.old_id;
UPDATE ar_entries are2 SET receivable_account_id = m.new_id FROM _remap_map m WHERE are2.receivable_account_id = m.old_id;
UPDATE petty_cash_entries pce SET account_id = m.new_id FROM _remap_map m WHERE pce.account_id = m.old_id;
UPDATE petty_cash_category_accounts pcca SET account_id = m.new_id FROM _remap_map m WHERE pcca.account_id = m.old_id;
UPDATE lalur_itens li SET conta_id = m.new_id FROM _remap_map m WHERE li.conta_id = m.old_id;

-- sanidade (todas devem vir 0) antes do soft-delete final
SELECT 'journal_entry_items' t, count(*) FROM journal_entry_items jei JOIN _remap_map m ON jei.account_id = m.old_id
UNION ALL SELECT 'account_balances', count(*) FROM account_balances ab JOIN _remap_map m ON ab.account_id = m.old_id
UNION ALL SELECT 'accounting_rules', count(*) FROM accounting_rules ar JOIN _remap_map m ON ar.suggested_account_id = m.old_id
UNION ALL SELECT 'fixed_assets(asset)', count(*) FROM fixed_assets fa JOIN _remap_map m ON fa.asset_account_id = m.old_id
UNION ALL SELECT 'fixed_assets(deprec)', count(*) FROM fixed_assets fa JOIN _remap_map m ON fa.depreciation_acc_id = m.old_id
UNION ALL SELECT 'fixed_assets(accum)', count(*) FROM fixed_assets fa JOIN _remap_map m ON fa.accum_deprec_acc_id = m.old_id
UNION ALL SELECT 'ar_entries', count(*) FROM ar_entries are2 JOIN _remap_map m ON are2.receivable_account_id = m.old_id
UNION ALL SELECT 'petty_cash_entries', count(*) FROM petty_cash_entries pce JOIN _remap_map m ON pce.account_id = m.old_id
UNION ALL SELECT 'petty_cash_category_accounts', count(*) FROM petty_cash_category_accounts pcca JOIN _remap_map m ON pcca.account_id = m.old_id
UNION ALL SELECT 'accounting_view_mappings', count(*) FROM accounting_view_mappings avm JOIN _remap_map m ON avm.account_id = m.old_id
UNION ALL SELECT 'lalur_itens', count(*) FROM lalur_itens li JOIN _remap_map m ON li.conta_id = m.old_id;

UPDATE chart_of_accounts SET deleted_at = now() WHERE id IN (SELECT old_id FROM _remap_map);

COMMIT;
