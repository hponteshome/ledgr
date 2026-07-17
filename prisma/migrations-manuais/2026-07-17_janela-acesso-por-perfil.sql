BEGIN;

ALTER TABLE access_schedules DROP CONSTRAINT IF EXISTS access_schedules_user_id_fkey;

CREATE TABLE IF NOT EXISTS profile_access_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID NOT NULL UNIQUE REFERENCES profiles(id),
  mode             VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  weekdays         INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time       VARCHAR(5) NOT NULL DEFAULT '08:00',
  end_time         VARCHAR(5) NOT NULL DEFAULT '18:00',
  vacation_months  INTEGER[] NOT NULL DEFAULT '{}',
  updated_by_id    UUID NULL,
  created_at       TIMESTAMP(6) NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP(6) NOT NULL DEFAULT now()
);

ALTER TABLE access_schedules
  ADD CONSTRAINT access_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

COMMIT;
