-- Login-less labourers + supervisor-marked attendance
-- Labourers are employees rows with NO auth_user_id (no login); worker_type distinguishes them from staff.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS worker_type text CHECK (worker_type IN ('staff','labour')) DEFAULT 'staff';

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS hours numeric;      -- hours worked (for present+hours labour marking)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status text;         -- 'present' | 'absent' | null
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS marked_by uuid;      -- employee id of who marked it (for supervisor-marked)
