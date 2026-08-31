-- Plots: km + geolocation; roles receive_tasks; tighter tasks RLS

ALTER TABLE storage_plots
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision;

UPDATE storage_plots
SET distance_km = ROUND((distance_m / 1000.0)::numeric, 3)
WHERE distance_m IS NOT NULL AND distance_km IS NULL;

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS receive_tasks boolean NOT NULL DEFAULT true;

UPDATE roles
SET receive_tasks = false
WHERE receive_tasks IS DISTINCT FROM false
  AND (
    lower(coalesce(key, '')) = 'admin'
    OR lower(coalesce(name, '')) = 'admin'
  );

-- Resolve the caller's employee id (mirrors get_user_org_id pattern)
CREATE OR REPLACE FUNCTION public.get_user_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM employees
  WHERE auth_user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS org_members_can_access_tasks ON public.tasks;

-- Admins see all org tasks; everyone else only tasks they assigned or were assigned
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO public
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_is_admin()
      OR assigned_to_employee_id = get_user_employee_id()
      OR assigned_by_employee_id = get_user_employee_id()
    )
  );

CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO public
  WITH CHECK (
    org_id = get_user_org_id()
    AND (
      get_user_is_admin()
      OR assigned_by_employee_id = get_user_employee_id()
    )
  );

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO public
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_is_admin()
      OR assigned_to_employee_id = get_user_employee_id()
      OR assigned_by_employee_id = get_user_employee_id()
    )
  )
  WITH CHECK (org_id = get_user_org_id());

CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO public
  USING (
    org_id = get_user_org_id()
    AND (
      get_user_is_admin()
      OR assigned_by_employee_id = get_user_employee_id()
    )
  );
