-- prisma/migrations-manuais/20261013_cambio_cotacoes_revoke.sql
-- cambio_cotacoes e imutavel: ledgr_api fica so com SELECT e INSERT (havia recebido UPDATE por permissao padrao).
REVOKE UPDATE, DELETE, TRUNCATE ON cambio_cotacoes FROM ledgr_api;