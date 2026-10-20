-- prisma/migrations-manuais/20261020_proj_instrumentos_minuta_link.sql
-- Instrumentos do plano (20/10/2026): referencia_minuta passa a trazer o link do documento de minutas (aba de cada
-- instrumento). A troca grava o evento EDITADO na trilha encadeada (gatilho proj_instrumentos_evento). Reexecutavel.
BEGIN;
SELECT set_config('app.user_id', (SELECT id::text FROM users WHERE email = 'hpontes@ledgr.com'), true);
UPDATE proj_instrumentos i SET referencia_minuta = x.ref
FROM (VALUES
  ('I01', 'Minutas do plano, aba 1 - Aditamento F5-Sunrise - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I02', 'Minutas do plano, aba 2 - Investimento e titulo F5-VAL - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I03', 'Minutas do plano, aba 3 - Debentures Series#1 - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I04', 'Minutas do plano, aba 4 - Escrow - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I05', 'Minutas do plano, aba 5 - Declaracao da F5 a massa - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I06', 'Minutas do plano, aba 6 - Aditivo de amortizacao - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I07', 'Minutas do plano, aba 7 - Clausulas do plano de insolvencia - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I08', 'Minutas do plano, aba 8 - Transferencia das quotas - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I09', 'Minutas do plano, aba 9 - Declaracao de origem (KYC) - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I10', 'Minutas do plano, aba 10 - Nota explicativa conjunta - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463'),
  ('I11', 'Minutas do plano, aba 11 - Termos de referencia - https://claude.ai/code/artifact/7090e038-822b-421e-b9b9-06d7ec68c463')
) AS x(codigo, ref)
WHERE i.codigo = x.codigo AND i.referencia_minuta IS DISTINCT FROM x.ref AND i.situacao NOT IN ('SUBSTITUIDO', 'ENCERRADO');
COMMIT;
SELECT codigo, left(referencia_minuta, 60) AS referencia FROM proj_instrumentos ORDER BY ordem;
