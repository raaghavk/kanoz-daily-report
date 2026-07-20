-- Admin cost ledger: gradually record all plant costs (monthly recurring + one-time).
CREATE TABLE IF NOT EXISTS public.finance_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  plant_id uuid,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',   -- 'monthly' | 'one_time'
  cost_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);
ALTER TABLE public.finance_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.finance_costs;
CREATE POLICY org_isolation ON public.finance_costs FOR ALL TO public USING ((org_id = get_user_org_id())) WITH CHECK ((org_id = get_user_org_id()));
CREATE INDEX IF NOT EXISTS idx_finance_costs_plant ON public.finance_costs (plant_id, is_deleted);
