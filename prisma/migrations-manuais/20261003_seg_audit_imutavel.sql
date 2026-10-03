-- prisma/migrations-manuais/20261003_seg_audit_imutavel.sql
-- Fase 1.2b (passo A): trilha de auditoria imutavel pelo proprio banco para o usuario da API.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM ledgr_api;
SELECT privilege_type FROM information_schema.role_table_grants WHERE grantee = 'ledgr_api' AND table_name = 'audit_logs' ORDER BY 1;