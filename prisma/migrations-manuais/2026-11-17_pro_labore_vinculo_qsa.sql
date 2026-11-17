-- 17/11/2026 - liga configuracoes antigas de pro-labore ao QSA pela Pessoa
UPDATE pro_labore_configs plc SET shareholder_id = cs.id
FROM company_shareholders cs
WHERE plc.shareholder_id IS NULL AND plc.deleted_at IS NULL
  AND cs.company_id = plc.company_id AND cs.person_id = plc.person_id AND cs.shareholder_type = 'PF';