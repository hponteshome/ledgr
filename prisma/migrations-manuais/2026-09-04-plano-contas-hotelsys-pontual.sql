BEGIN;
-- ========== 1) CONTAS NOVAS (27) ==========
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '11307010002', 'Mútuo Sócios e Diretores', 6, 'ASSET', 'DEBIT', true, true, '5412f5c7-7d51-407f-aa2f-36fe1afccf5b', '1036');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '11308010001', 'Mútuo Partes Não Relacionadas', 6, 'ASSET', 'DEBIT', true, true, '7862f8d0-7ee7-452e-adc1-96256424c4ea', '1037');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12101030003', 'Mútuo Outros', 6, 'ASSET', 'DEBIT', true, true, '2db1df68-c63b-472d-b305-68384e766838', '1212');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12201020004', 'LM Administração de Bens', 6, 'ASSET', 'DEBIT', true, true, '4fe2fd9b-1686-456e-82c9-8be95f76dba3', '1219');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010002', 'Acyr Andrade Conjunto 32', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1302');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010003', 'Acyr Andrade Conjunto 33', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1303');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010004', 'Studio Paris Ap 1101', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1304');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010005', 'Loft São Paulo Cob1V', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1305');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010006', 'Casablanca Ecoville 1602', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1306');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010007', 'Regency Florianópolis 3B', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1307');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010008', 'Palais Royal 31', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1308');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010009', 'North York Sob 25', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1309');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010010', 'Iporanga Guarujá Q4-L19', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1310');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010011', 'Landmark 138-A', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1311');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010012', 'Landmark 139-A', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1312');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010013', 'Landmark 137-A', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1313');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010014', 'Imóvel Cotia', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1314');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010015', 'Bertioga 62', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1315');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010016', 'Bertioga 88', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1316');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010017', 'Bertioga 92', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1317');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010018', 'Chacara Piraquara', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1318');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010019', 'Casa Sauternes', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1319');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010020', 'Casa Las Piedras', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1320');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010021', 'Casa Campos do Jordão', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1321');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010022', 'Terreno Catuama Goiana-PE', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1322');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010023', 'Vinicola The Vines Mendoza', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1323');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id, reduced_code)
VALUES (gen_random_uuid(), (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1),
        '12301010024', 'Vinicola Rios e Corropios', 6, 'ASSET', 'DEBIT', true, true, '859528ac-9792-420a-bdc7-6da0f8749030', '1324');

-- ========== 2) CORRECOES DE reduced_code (242, nome inalterado) ==========
UPDATE chart_of_accounts SET reduced_code = '1002' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11101010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1003' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11102010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1004' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11102010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1005' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11102010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1006' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11102010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1007' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11102010005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1008' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11102010006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1009' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11102010007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1010' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11104030001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1011' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11104030002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1012' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11104030003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1013' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11104030004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1014' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11104030005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1015' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11104030006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1016' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11104030007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1017' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11301010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1018' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11301010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1019' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11301010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1020' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11301010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1021' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11301010005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1022' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11301010006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1023' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11301010007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1024' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11301010008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1025' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11303010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1026' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11304010007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1027' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11304010008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1028' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11305010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1029' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11305010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1030' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11305010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1031' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11305010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1032' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11305010006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1033' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11305010007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1034' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11305010008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1038' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11308010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1039' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11309010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1040' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11309010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1041' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11309010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1042' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11309010005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1043' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11309010006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1044' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11309010007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1045' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11309010008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1046' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11309010009' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1047' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11310010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1048' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11401010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1049' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11401010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1050' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11401010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1051' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11401010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1052' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1053' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1054' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1055' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1056' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1057' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1058' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1059' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1060' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010009' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1061' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010010' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1062' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010011' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1063' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11501010012' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1201' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1202' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101010005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1205' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101020014' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1206' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101020018' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1207' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101020021' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1208' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101020022' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1209' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101020023' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1213' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101050002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1214' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101050006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1215' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12201010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1216' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12201020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1217' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12201020002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1218' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12201020003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1301' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1326' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1327' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301030001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1328' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301030003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1329' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301030004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1330' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301100001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1331' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301100002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1332' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301110004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1333' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301120001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1334' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301130001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1335' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301130002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1336' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301130003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1337' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301130004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1338' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301130005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1339' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301130006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1340' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301130007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1341' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301130008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1342' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12301140001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1343' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12401010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1344' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12401010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1345' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12401020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '1346' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12401020002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2006' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101020005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2008' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101030008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2009' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101030009' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2010' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101030011' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2011' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101030012' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2012' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101030013' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2013' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101030014' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2014' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2015' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2016' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2017' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2018' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2019' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2020' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2021' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2022' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040009' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2023' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101040010' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2024' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101050001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2025' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101050002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2026' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2027' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2028' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2029' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2030' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2031' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2032' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2033' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2034' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060009' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2035' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060010' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2036' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060011' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2037' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060012' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2038' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060013' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2039' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060014' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2040' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101060015' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2041' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101070001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2042' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101070002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2043' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101070003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2044' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101090001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2045' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101090002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2046' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101120001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2047' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101120002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2048' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101130001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2049' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101130002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2050' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101130003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2051' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101140001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2052' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101140002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2053' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101140003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2201' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2202' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2203' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101050001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2205' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101050003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2206' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101050004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2207' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101050005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2208' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101060001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2209' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101060002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2210' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101060003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2211' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101070003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2212' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101080001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2213' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101080002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2214' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22102010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2215' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22501010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2301' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '23101010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2302' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '23201010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2303' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '23201010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2304' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '23301010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2305' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '23301010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2306' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '23301010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2307' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '23301010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '2308' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '23301020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3001' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31101010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3002' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31101020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3003' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31103010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3004' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31104010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3005' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31104010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3006' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31104010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3007' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31104010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3501' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31301010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3502' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31301020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3503' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31302010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3504' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31302020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3505' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31302030001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3506' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31302040001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3507' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31303010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3508' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31303020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3509' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31303030001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3510' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31303040001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3511' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '31304010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3201' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '32101010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3202' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '32102010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3203' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '32102010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3204' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '32103010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '3205' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '32104010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4201' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42202010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4202' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42202010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4203' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42202010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4204' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4205' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4206' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4207' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4208' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4209' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4210' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4211' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4212' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010009' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4213' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010010' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4214' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42301010011' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4501' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4502' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4503' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4504' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4505' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401010005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4506' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4507' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401020002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4508' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401020003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4509' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401020004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4510' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401020005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4511' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401020006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4512' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42401020007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4513' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42402010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4514' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42402010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4515' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42402010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4516' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42402010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4517' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4518' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4519' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4520' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4521' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4522' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4523' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4524' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010008' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4525' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010009' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4526' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010010' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4527' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010011' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4528' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010012' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4529' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010013' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4530' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010014' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4531' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010015' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4532' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42501010016' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4533' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42601010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4534' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42601010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4535' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42601010003' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4536' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42601010004' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4537' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42601010005' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4538' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42601010006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4539' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42601010007' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4540' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42602010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4541' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42602010002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET reduced_code = '4701' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '42701010001' AND deleted_at IS NULL;

-- ========== 3) RENOMEACOES (7, nome + reduced_code) ==========
UPDATE chart_of_accounts SET name = 'Mútuo Ligadas', reduced_code = '1035' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11307010001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET name = 'Mútuo Ligadas', reduced_code = '1203' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101020001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET name = 'Mútuo Sócios e Diretores', reduced_code = '1204' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101020002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET name = 'Mútuo Partes Não Relacionadas', reduced_code = '1210' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101030001' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET name = 'Empregados', reduced_code = '1211' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '12101030002' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET name = 'Outras Contas a Pagar', reduced_code = '2007' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '21101020006' AND deleted_at IS NULL;
UPDATE chart_of_accounts SET name = 'MOU San Francisco Fund', reduced_code = '2204' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '22101050002' AND deleted_at IS NULL;

-- ========== 4) 11303010002 - reduced_code compartilhado com 11303010001 (nao cria nova) ==========
UPDATE chart_of_accounts SET reduced_code = '1025' WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1) AND code = '11303010002' AND deleted_at IS NULL;

-- ========== 5) IRPJ/CSLL: nova raiz classe 5, move as 4 folhas, aposenta 4310101/4310102 ==========
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id)
VALUES ('0395c8dd-0142-415a-bd79-b6550b1c5278', (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1), '7', 'Despesas com IRPJ e CSLL', 1, 'EXPENSE', 'DEBIT', false, true, NULL);
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id)
VALUES ('b0017d3f-99ae-4e86-b64d-bf495d660922', (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1), '71', 'Despesas com IRPJ e CSLL', 2, 'EXPENSE', 'DEBIT', false, true, '0395c8dd-0142-415a-bd79-b6550b1c5278');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id)
VALUES ('22528711-a992-4df7-ada8-5c4c8adc9871', (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1), '711', 'Impostos sobre o Lucro', 3, 'EXPENSE', 'DEBIT', false, true, 'b0017d3f-99ae-4e86-b64d-bf495d660922');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id)
VALUES ('fb688524-e220-4591-b579-2cc1bd15fe40', (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1), '71101', 'Impostos sobre o Lucro', 4, 'EXPENSE', 'DEBIT', false, true, '22528711-a992-4df7-ada8-5c4c8adc9871');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id)
VALUES ('94622a47-ea3f-4486-a119-b70c981962ef', (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1), '7110101', 'IRPJ e CSLL', 5, 'EXPENSE', 'DEBIT', false, true, 'fb688524-e220-4591-b579-2cc1bd15fe40');
INSERT INTO chart_of_accounts (id, company_id, code, name, level, type, nature, is_analytic, is_active, parent_id)
VALUES ('482a2c14-3bf6-442b-b43b-bb844c7748a8', (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1), '7110102', 'IRPJ e CSLL Diferidos', 5, 'EXPENSE', 'DEBIT', false, true, 'fb688524-e220-4591-b579-2cc1bd15fe40');
UPDATE chart_of_accounts SET code = '71101010001', parent_id = '94622a47-ea3f-4486-a119-b70c981962ef', reduced_code = '5101' WHERE id = 'c1b3b0ff-d61e-4d58-b06b-8e5737735b0b';
UPDATE chart_of_accounts SET code = '71101010002', parent_id = '94622a47-ea3f-4486-a119-b70c981962ef', reduced_code = '5102' WHERE id = 'c8c14f75-b95b-442b-8e7b-40ada1b07a8c';
UPDATE chart_of_accounts SET code = '71101020001', parent_id = '482a2c14-3bf6-442b-b43b-bb844c7748a8', reduced_code = '5103' WHERE id = '9c4f617e-175b-44d7-ba9d-b47fd8a99166';
UPDATE chart_of_accounts SET code = '71101020002', parent_id = '482a2c14-3bf6-442b-b43b-bb844c7748a8', reduced_code = '5104' WHERE id = 'cb024b58-0d5a-4051-ac95-84afa1038e5f';

UPDATE chart_of_accounts SET deleted_at = NOW() WHERE id IN ('d2f3dbf3-dfdf-44ed-905e-e15b6a01bd80','f7ea0d4a-beda-4f76-a93f-d740039c1436');

COMMIT;

-- ========== VERIFICACAO ==========
SELECT 'novas' AS etapa, COUNT(*) FROM chart_of_accounts
WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND code IN ('11307010002','11308010001','12101030003','12201020004','12301010002','12301010003','12301010004','12301010005','12301010006','12301010007','12301010008','12301010009','12301010010','12301010011','12301010012','12301010013','12301010014','12301010015','12301010016','12301010017','12301010018','12301010019','12301010020','12301010021','12301010022','12301010023','12301010024') AND deleted_at IS NULL
UNION ALL
SELECT 'irpj_csll_movido', COUNT(*) FROM chart_of_accounts
WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND code IN ('71101010001','71101010002','71101020001','71101020002') AND deleted_at IS NULL
UNION ALL
SELECT 'raiz_5_criada', COUNT(*) FROM chart_of_accounts
WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND code IN ('7','71','711','71101','7110101','7110102') AND deleted_at IS NULL
UNION ALL
SELECT 'orfas_aposentadas', COUNT(*) FROM chart_of_accounts
WHERE id IN ('d2f3dbf3-dfdf-44ed-905e-e15b6a01bd80','f7ea0d4a-beda-4f76-a93f-d740039c1436') AND deleted_at IS NOT NULL
UNION ALL
SELECT 'renomeacoes_ok', COUNT(*) FROM chart_of_accounts
WHERE company_id = (SELECT id FROM companies WHERE legal_name ILIKE '%hotelsys%' LIMIT 1)
  AND code = '22101050002' AND name = 'MOU San Francisco Fund';
