-- Attendance: add 'operator' worker type + multi-machine attachment.
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_worker_type_check;
ALTER TABLE employees ADD CONSTRAINT employees_worker_type_check CHECK (worker_type IS NULL OR worker_type IN ('staff','labour','driver','operator'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS machine_ids uuid[];
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS machine_ids uuid[];
