-- prisma/migrations-manuais/20261003_user_sessions.sql
-- Fase 0A.6 - sessao curta: refresh tokens opacos (so o hash) com rotacao e revogacao
CREATE TABLE IF NOT EXISTS user_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     varchar(64) NOT NULL UNIQUE,
  created_at     timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at   timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     timestamp(6) NOT NULL,
  revoked_at     timestamp(6),
  replaced_by_id uuid
);
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_sessions' ORDER BY ordinal_position;