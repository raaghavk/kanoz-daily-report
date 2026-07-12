-- Fix Shift Reports Unique Constraint to Support Soft Deletes
-- A standard unique constraint blocks new entries if a soft-deleted report exists with same plant/date/shift.
-- We drop the constraint and replace it with a partial unique index.

ALTER TABLE public.shift_reports DROP CONSTRAINT IF EXISTS shift_reports_plant_id_date_shift_key;

CREATE UNIQUE INDEX IF NOT EXISTS shift_reports_plant_date_shift_active_idx 
  ON public.shift_reports (plant_id, date, shift) 
  WHERE (is_deleted = false);
