-- Finance foundation: plant-level energy cost inputs
-- Used to estimate per-machine electricity running cost on the admin dashboard.
ALTER TABLE plants ADD COLUMN IF NOT EXISTS electricity_tariff numeric;   -- INR per unit (kWh) for grid power
ALTER TABLE plants ADD COLUMN IF NOT EXISTS diesel_rate numeric;          -- INR per litre for generator diesel
