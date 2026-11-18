-- DIMOB-C-02 (18/11/2026) - item de menu DIMOB no grupo SPED & Obrigacoes (mesmas permissoes da EFD) + LM: datas dos instrumentos e alertas
\set ON_ERROR_STOP on
BEGIN;
SELECT id AS cid FROM companies WHERE tax_id = '17970759000108' \gset

-- Menu: item DIMOB no mesmo grupo da EFD, recurso 'dimob' (API), com as mesmas permissoes de perfil e de usuario da EFD
DO $$ BEGIN
  IF (SELECT count(*) FROM sidebar_items WHERE path IN ('/app/sped/efd', 'app/sped/efd')) <> 1 THEN
    RAISE EXCEPTION 'Item de menu da EFD nao encontrado (ou duplicado) - nada alterado';
  END IF;
END $$;
INSERT INTO sidebar_items (id, path, label, module, icon, parent_id, ordem, divider_before, disabled, action_type, resource)
SELECT gen_random_uuid(), CASE WHEN e.path LIKE '/%' THEN '/app/sped/dimob' ELSE 'app/sped/dimob' END, 'DIMOB', e.module, e.icon, e.parent_id,
       e.ordem + 1, NULL, false, e.action_type, 'dimob'
FROM sidebar_items e WHERE e.path IN ('/app/sped/efd', 'app/sped/efd')
  AND NOT EXISTS (SELECT 1 FROM sidebar_items x WHERE x.path IN ('/app/sped/dimob', 'app/sped/dimob'));
INSERT INTO profile_sidebar_permissions (profile_id, item_id, access_level)
SELECT p.profile_id, d.id, p.access_level
FROM profile_sidebar_permissions p
JOIN sidebar_items e ON e.id = p.item_id AND e.path IN ('/app/sped/efd', 'app/sped/efd')
CROSS JOIN (SELECT id FROM sidebar_items WHERE path IN ('/app/sped/dimob', 'app/sped/dimob')) d
WHERE NOT EXISTS (SELECT 1 FROM profile_sidebar_permissions q WHERE q.profile_id = p.profile_id AND q.item_id = d.id);
INSERT INTO user_sidebar_permissions (id, user_id, item_id, company_id, access_level)
SELECT gen_random_uuid(), u.user_id, d.id, u.company_id, u.access_level
FROM user_sidebar_permissions u
JOIN sidebar_items e ON e.id = u.item_id AND e.path IN ('/app/sped/efd', 'app/sped/efd')
CROSS JOIN (SELECT id FROM sidebar_items WHERE path IN ('/app/sped/dimob', 'app/sped/dimob')) d
WHERE NOT EXISTS (SELECT 1 FROM user_sidebar_permissions q WHERE q.user_id = u.user_id AND q.item_id = d.id AND q.company_id IS NOT DISTINCT FROM u.company_id);
-- Data do contrato no R02 = data do instrumento (DIMOB 2022 informou 18/10/2020 para a Focus)
UPDATE rental_contracts SET instrument_date = DATE '2020-10-18', updated_at = now()
 WHERE company_id = :'cid' AND contract_number = '200001' AND deleted_at IS NULL AND instrument_date IS NULL;
UPDATE rental_contracts SET instrument_date = DATE '2022-07-25', updated_at = now()
 WHERE company_id = :'cid' AND contract_number = '220002' AND deleted_at IS NULL AND instrument_date IS NULL;

INSERT INTO company_alerts (company_id, severity, title, message, locked, created_by_name, action_url, action_label)
SELECT :'cid'::uuid, 'WARNING', v.t, v.m, false, 'Regularização LM (DIMOB-C-02)', v.u, v.l
FROM (VALUES
  ('DIMOB 2023, 2024 e 2025: entregar antes da MIT de out/2026 e de qualquer ECF',
   'Prazo 30/11/2026. A última declaração apresentada é a ECF 2022 (Presumido), o que sustenta a multa de R$ 500/mês (art. 57, I, a, MP 2.158-35). Multa estimada com redução de 50%: 2023 8.250, 2024 5.250, 2025 2.500 (total 16.000). Detalhes em claude/dimob-lm-2023-2025.md.',
   '/app/sped/dimob', 'Abrir DIMOB'),
  ('DIMOB 2023: faltam Curitiba ago-dez/2023 e o contrato LoftSP de 2020',
   'Aguardando a DIMOB 2023 da Quatro Ventos (aluguel e comissão de ago a dez/2023, código 40148) e o cadastro do contrato do LoftSP de 26/06/2020 (recebimentos de out/2023 a abr/2025: 130.000, 36.000 e 98.040).',
   '/app/sped/dimob', 'Abrir DIMOB'),
  ('Ajustes contábeis de 02/01/2026 (ECD x DIMOB): AJ-D1 a AJ-D8',
   'AJ-D1 caução Takara 12.000 (2023); AJ-D2 caução Nova Rubília 57.000 (2024); AJ-D3 restituição Saara 26.077,50 (2025); AJ-D4 comissão Eliseu 5.000 (2025); AJ-D5 reembolso IPTU Commodities 1.605,93 (2025); AJ-D6 Curitiba pelo bruto (2024 23.530,43; 2025 28.592,18; 2023 pendente); AJ-D7 1º aluguel pago à imobiliária 33.500 (2025); AJ-D8 históricos Las Piedras 2024.',
   NULL, NULL),
  ('Curitiba: repasses da imobiliária com diferenças a documentar',
   'Líquido do comprovante x repasse no extrato: 2024 10.059,26 (inclui o repasse de 10/01/2024, 6.454,00, que aguarda o demonstrativo de 2023) e 2025 10.644,25. Provável IPTU, condomínio ou reparos descontados pela imobiliária - pedir as prestações de contas mensais.',
   '/app/sped/dimob', 'Abrir DIMOB'),
  ('Caução Nova Rubília: diferença de 30.922,50 a documentar',
   'Caução recebida em 21/03/2024: 57.000,00. Restituída em 24/09/2025 (Distribuidora Saara): 26.077,50. Documentar a diferença (débitos do locatário compensados na caução?).',
   NULL, NULL),
  ('eSocial 07/2025: comissão paga a pessoa física sem S-1200',
   'Comissão de 5.000,00 paga pela LM a Eliseu Rodrigues (PIX 01/07/2025, Mare 88). Exige S-1200 de contribuinte individual (cat. 701), INSS 11% retido + 20% patronal e IRRF. Cadastrar nome completo e CPF.',
   '/app/hr/processamento-mensal', 'Processamento Mensal')
) v(t, m, u, l)
WHERE NOT EXISTS (SELECT 1 FROM company_alerts a WHERE a.company_id = :'cid' AND a.title = v.t AND a.resolved_at IS NULL);
COMMIT;

\echo == Conferencia ==
SELECT i.path, i.label, i.resource, i.ordem, (SELECT count(*) FROM profile_sidebar_permissions p WHERE p.item_id = i.id) AS perfis,
       (SELECT count(*) FROM user_sidebar_permissions u WHERE u.item_id = i.id) AS usuarios
  FROM sidebar_items i WHERE i.path IN ('/app/sped/efd', 'app/sped/efd', '/app/sped/dimob', 'app/sped/dimob') ORDER BY i.ordem;
SELECT contract_number, left(tenant_name, 40) AS locatario, start_date, instrument_date FROM rental_contracts
 WHERE company_id = :'cid' AND contract_number IN ('200001', '220002') AND deleted_at IS NULL;
SELECT left(title, 80) AS alerta, action_url FROM company_alerts
 WHERE company_id = :'cid' AND resolved_at IS NULL AND created_by_name LIKE 'Regulariza%DIMOB-C-02%' ORDER BY created_at;