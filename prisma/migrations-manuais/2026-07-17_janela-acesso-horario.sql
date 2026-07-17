BEGIN;

CREATE TABLE IF NOT EXISTS access_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id),
  mode             VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  weekdays         INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time       VARCHAR(5) NOT NULL DEFAULT '08:00',
  end_time         VARCHAR(5) NOT NULL DEFAULT '18:00',
  vacation_months  INTEGER[] NOT NULL DEFAULT '{}',
  exempt_set_by_id UUID NULL,
  exempt_set_at    TIMESTAMP(6) NULL,
  created_at       TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_unlock_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  message          TEXT NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at       TIMESTAMP(6) NOT NULL DEFAULT now(),
  responded_by_id  UUID NULL REFERENCES users(id),
  responded_at     TIMESTAMP(6) NULL
);
CREATE INDEX IF NOT EXISTS idx_access_unlock_requests_status ON access_unlock_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_unlock_requests_user ON access_unlock_requests(user_id);

COMMIT;
