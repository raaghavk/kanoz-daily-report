-- Add a physical vehicle-type column to company-owned vehicles.
-- The existing `type` column is a category marker ('company') used to filter
-- company-owned vehicles, so the physical type (Tractor/Truck/etc.) needs its
-- own column rather than reusing `type`.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_type text;
