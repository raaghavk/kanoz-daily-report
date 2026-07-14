CREATE TABLE IF NOT EXISTS attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  plant_id uuid not null,
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null default current_date,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_lat numeric, check_in_lng numeric,
  check_out_lat numeric, check_out_lng numeric,
  note text,
  created_at timestamptz default now()
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON attendance FOR ALL USING (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id())) WITH CHECK (plant_id IN (SELECT id FROM plants WHERE org_id = get_user_org_id()));
CREATE INDEX IF NOT EXISTS idx_attendance_plant_date ON attendance(plant_id, work_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_emp_day ON attendance(employee_id, work_date);
