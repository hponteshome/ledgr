-- prisma/migrations-manuais/20261002_seg_conta_teste_qa_hotelsys.sql
-- Fase 0A.9 - conta de teste dedicada (nao Master, so Hotelsys) para testes de isolamento.
-- O hash da senha e injetado em tempo de execucao no marcador __HASH__; este arquivo nao contem credencial.
-- Regra: conta inativa fora das sessoes de teste.
BEGIN;
INSERT INTO users (document, document_type, email, password_hash, full_name, is_active, is_email_confirmed, status, profile_id, level)
SELECT 'QA-HOTELSYS', 'TESTE', 'qa.hotelsys@ledgr.local', '__HASH__', 'QA Hotelsys (testes de isolamento)', true, true, 'active', p.id, 0
FROM profiles p
WHERE p.id = '7fc860f2-4906-42a5-9673-6c4a631cae12' AND p.name = 'Operador' AND p.deleted_at IS NULL;

INSERT INTO user_companies (user_id, company_id, role)
SELECT u.id, c.id, 'USER'
FROM users u, companies c
WHERE u.email = 'qa.hotelsys@ledgr.local'
  AND c.id = 'c2d48edc-28b7-4fd8-9272-b486449ab2cc' AND c.deleted_at IS NULL;

INSERT INTO access_schedules (user_id, mode, weekdays, start_time, end_time, vacation_months)
SELECT u.id, 'SCHEDULED', '{0,1,2,3,4,5,6}', '00:00', '23:59', '{}'
FROM users u WHERE u.email = 'qa.hotelsys@ledgr.local';

INSERT INTO audit_logs (actor_id, acao, target_id, depois)
SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com'), 'USER_CREATE', u.id::text,
       jsonb_build_object('email', u.email, 'perfil', 'Operador', 'empresas', jsonb_build_array('HOTELSYS'),
                          'janela', 'SCHEDULED 0-6 00:00-23:59', 'finalidade', 'Fase 0A.9 - testes de isolamento')
FROM users u WHERE u.email = 'qa.hotelsys@ledgr.local';

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM users WHERE email = 'qa.hotelsys@ledgr.local') <> 1 THEN
    RAISE EXCEPTION 'conta nao criada (perfil Operador nao encontrado?)';
  END IF;
  IF (SELECT COUNT(*) FROM user_companies uc JOIN users u ON u.id = uc.user_id WHERE u.email = 'qa.hotelsys@ledgr.local') <> 1 THEN
    RAISE EXCEPTION 'vinculo com Hotelsys nao criado';
  END IF;
  IF (SELECT COUNT(*) FROM access_schedules s JOIN users u ON u.id = s.user_id WHERE u.email = 'qa.hotelsys@ledgr.local') <> 1 THEN
    RAISE EXCEPTION 'janela de acesso nao criada';
  END IF;
END $$;
COMMIT;

SELECT u.email, pr.name AS perfil, u.is_active, u.status, COALESCE(NULLIF(c.trade_name, ''), c.legal_name) AS empresa, s.mode, s.weekdays, s.start_time, s.end_time
FROM users u
JOIN profiles pr ON pr.id = u.profile_id
JOIN user_companies uc ON uc.user_id = u.id
JOIN companies c ON c.id = uc.company_id
JOIN access_schedules s ON s.user_id = u.id
WHERE u.email = 'qa.hotelsys@ledgr.local';