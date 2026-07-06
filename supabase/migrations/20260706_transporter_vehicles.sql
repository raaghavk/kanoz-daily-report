-- Create transporter_vehicles table for multiple vehicles per transporter
CREATE TABLE IF NOT EXISTS transporter_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporter_id UUID NOT NULL REFERENCES transporters(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'Tractor',
  driver_name TEXT,
  driver_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE transporter_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS policy: user can only see vehicles for transporters in their org
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transporter_vehicles' AND policyname = 'org_isolation'
  ) THEN
    CREATE POLICY "org_isolation" ON transporter_vehicles
      USING (
        transporter_id IN (
          SELECT id FROM transporters WHERE org_id = get_user_org_id()
        )
      );
  END IF;
END $$;

-- Migrate existing single-vehicle data from transporters table to new table
INSERT INTO transporter_vehicles (transporter_id, vehicle_number, vehicle_type, driver_name, driver_phone)
SELECT
  id,
  vehicle_number,
  COALESCE(NULLIF(TRIM(category), ''), 'Tractor'),
  driver_name,
  driver_phone
FROM transporters
WHERE vehicle_number IS NOT NULL AND TRIM(vehicle_number) != ''
ON CONFLICT DO NOTHING;
