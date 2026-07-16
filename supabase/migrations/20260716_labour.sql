-- Labour overhaul: widen worker_type enum, add labour wage + attendance machine link
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_worker_type_check;   -- widen enum
ALTER TABLE employees ADD CONSTRAINT employees_worker_type_check CHECK (worker_type IN ('staff','labour','driver'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS labour_daily_wage numeric;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS machine_id uuid;
-- Persist a labourer's default attached machine/equipment so marking present can carry it onto attendance
ALTER TABLE employees ADD COLUMN IF NOT EXISTS machine_id uuid;
