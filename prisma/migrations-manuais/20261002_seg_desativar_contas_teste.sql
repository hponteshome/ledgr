-- prisma/migrations-manuais/20261002_seg_desativar_contas_teste.sql
-- Fase 0A.8 - desativar contas de teste sem uso (nunca acessaram)
BEGIN;
INSERT INTO audit_logs (actor_id, acao, target_id, antes, depois)
SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com'),
       'USER_DEACTIVATE',
       u.id::text,
       jsonb_build_object('is_active', u.is_active),
       jsonb_build_object('is_active', false, 'motivo', 'Fase 0A.8 - conta de teste sem uso')
FROM users u
WHERE u.email IN ('adm@ledgr.com','oper@ledgr.com','ver@ledgr.com','teste.visualizador@ledgr.local')
  AND u.is_active = true;
UPDATE users
   SET is_active = false, refresh_token = NULL, updated_at = now()
 WHERE email IN ('adm@ledgr.com','oper@ledgr.com','ver@ledgr.com','teste.visualizador@ledgr.local');
COMMIT;
SELECT email, is_active, refresh_token IS NULL AS sessao_revogada FROM users WHERE deleted_at IS NULL ORDER BY is_active DESC, email;