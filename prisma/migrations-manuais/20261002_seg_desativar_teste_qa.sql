-- prisma/migrations-manuais/20261002_seg_desativar_teste_qa.sql
-- Fase 0A.8 - desativar conta de teste com perfil Master Admin
BEGIN;
INSERT INTO audit_logs (actor_id, acao, target_id, antes, depois)
SELECT (SELECT id FROM users WHERE email = 'hpontes@ledgr.com'),
       'USER_DEACTIVATE',
       u.id::text,
       jsonb_build_object('is_active', u.is_active),
       jsonb_build_object('is_active', false, 'motivo', 'Fase 0A.8 - conta de teste com Master Admin')
FROM users u
WHERE u.email = 'teste.qa@ledgr.local' AND u.is_active = true;
UPDATE users
   SET is_active = false, refresh_token = NULL, updated_at = now()
 WHERE email = 'teste.qa@ledgr.local';
COMMIT;
SELECT email, is_active, refresh_token IS NULL AS sessao_revogada FROM users WHERE email = 'teste.qa@ledgr.local';