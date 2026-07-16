-- Per-role "track attendance" flag. Roles with track_attendance = false are
-- excluded from attendance entirely (no self check-in, hidden from the roster).
ALTER TABLE roles ADD COLUMN IF NOT EXISTS track_attendance boolean DEFAULT true;
-- Default: admins/owners are not marked.
UPDATE roles SET track_attendance = false WHERE key = 'admin' AND track_attendance IS DISTINCT FROM false;
