ALTER TABLE raw_material_types ADD COLUMN IF NOT EXISTS source text CHECK (source IN ('in_house','purchased','both')) DEFAULT 'purchased';
