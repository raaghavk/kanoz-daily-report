-- Day/night electricity rates + fixed demand charge (ToD-aware cost model).
-- Shift A (day) and Shift B (night) are priced at different all-in ₹/unit rates
-- (ToD energy rate × duty+FPPA uplift). The demand charge is fixed monthly overhead.
ALTER TABLE plants ADD COLUMN IF NOT EXISTS electricity_rate_day numeric;
ALTER TABLE plants ADD COLUMN IF NOT EXISTS electricity_rate_night numeric;
ALTER TABLE plants ADD COLUMN IF NOT EXISTS electricity_demand_charge numeric;
