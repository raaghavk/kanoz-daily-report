-- Plant settings: extra fields for machines, equipment, and raw material types
-- machines already has machine_type + capacity_mt_per_hour; add motor_hp
ALTER TABLE machines ADD COLUMN IF NOT EXISTS motor_hp numeric;

-- equipment: mirror machines (type, production/hr, motor HP)
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS equipment_type text,
  ADD COLUMN IF NOT EXISTS capacity_mt_per_hour numeric,
  ADD COLUMN IF NOT EXISTS motor_hp numeric;

-- raw material types: opening stock captured at first plant setup (pre-app history)
-- Used as the opening balance for the very first shift report.
ALTER TABLE raw_material_types ADD COLUMN IF NOT EXISTS opening_stock_kg numeric DEFAULT 0;
