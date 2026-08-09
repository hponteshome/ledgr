INSERT INTO sidebar_items (id, path, label, module, icon, parent_id, ordem, action_type)
VALUES (gen_random_uuid(), '/app/sistema/menu-usage', 'Auditoria de Uso do Menu', 'admin', 'FiBarChart2', '88a1af2e-feef-41d1-902a-eded1cb75d55', 5, 'link')
ON CONFLICT (path) DO NOTHING;
