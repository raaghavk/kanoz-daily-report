-- GCV-based pellet grading: pellet identity derived from mix recipe.
-- Raw materials carry a GCV (kcal/kg); mixes derive a pellet name (dominant
-- ingredient), a weighted-average GCV, and a grade from the plant threshold.
-- Legacy pellet_types rows (e.g. Sample / N Sample) keep working with grade NULL.

ALTER TABLE raw_material_types
  ADD COLUMN IF NOT EXISTS gcv_kcal_kg numeric;

ALTER TABLE pellet_types
  ADD COLUMN IF NOT EXISTS gcv_kcal_kg numeric,
  ADD COLUMN IF NOT EXISTS grade text;

-- Single per-plant threshold: weighted GCV >= threshold -> 'High GCV', else 'Low GCV'
ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS gcv_grade_threshold numeric DEFAULT 3200;

ALTER TABLE shift_mixes
  ADD COLUMN IF NOT EXISTS derived_pellet_name text,
  ADD COLUMN IF NOT EXISTS derived_gcv numeric,
  ADD COLUMN IF NOT EXISTS derived_grade text;
