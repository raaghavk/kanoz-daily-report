-- In-house saw dust conversion tracking.
-- The plant makes its own saw dust: wood log -> Log Eater -> small logs ->
-- Hammer Mill -> saw dust (which then feeds the pellet machines). Each row is
-- one processing run recorded on a shift report.
CREATE TABLE IF NOT EXISTS public.processing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_report_id uuid REFERENCES public.shift_reports(id) ON DELETE CASCADE,
  plant_id uuid,
  org_id uuid,
  input_material text,
  input_kg numeric DEFAULT 0,
  output_material text DEFAULT 'Saw Dust',
  output_kg numeric DEFAULT 0,
  yield_pct numeric,
  log_eater_hours numeric,
  hammer_mill_hours numeric,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processing_runs_shift_report
  ON public.processing_runs USING btree (shift_report_id);

ALTER TABLE public.processing_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON public.processing_runs FOR ALL USING (
  shift_report_id IN (
    SELECT id FROM shift_reports
    WHERE plant_id IN (
      SELECT id FROM plants WHERE org_id = get_user_org_id()
    )
  )
);
