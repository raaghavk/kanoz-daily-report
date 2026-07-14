-- Equipment (generators, vehicles) holds fuel; capture opening fuel on hand at setup,
-- mirroring raw_material_types.opening_stock_kg. Litres, defaults to 0.
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS opening_stock_litres numeric DEFAULT 0;
