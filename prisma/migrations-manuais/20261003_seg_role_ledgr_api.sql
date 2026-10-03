-- prisma/migrations-manuais/20261003_seg_role_ledgr_api.sql
-- Fase 1.2b (passo A): usuario de banco exclusivo da API, sem superusuario e sem BYPASSRLS (menor privilegio).
-- A senha e injetada em tempo de execucao no marcador __SENHA__; este arquivo nao contem credencial.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ledgr_api') THEN
    CREATE ROLE ledgr_api LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;
ALTER ROLE ledgr_api WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '__SENHA__';
GRANT CONNECT ON DATABASE ledgr_app TO ledgr_api;
GRANT USAGE ON SCHEMA public TO ledgr_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ledgr_api;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ledgr_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ledgr_api;
ALTER DEFAULT PRIVILEGES FOR ROLE ledgr IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ledgr_api;
ALTER DEFAULT PRIVILEGES FOR ROLE ledgr IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ledgr_api;
ALTER DEFAULT PRIVILEGES FOR ROLE ledgr IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ledgr_api;
SELECT rolname, rolsuper AS superusuario, rolbypassrls AS ignora_rls FROM pg_roles WHERE rolname = 'ledgr_api';
SELECT COUNT(DISTINCT table_name) AS tabelas_com_acesso FROM information_schema.role_table_grants WHERE grantee = 'ledgr_api';