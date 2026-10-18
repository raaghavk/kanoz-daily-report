-- NEEDS OWNER APPROVAL — do not apply to live without review.
--
-- Inactive employees (employees.is_active = false) currently still resolve
-- get_user_org_id() / get_user_plant_id(), so org_isolation RLS lets them
-- read/write plant data with a valid JWT. Edge functions that use
-- requireCaller already reject inactive callers; PostgREST does not.
--
-- This migration:
--   1. Lets an inactive user SELECT their own employees row (so the app can
--      show "account deactivated" instead of a generic no-profile error).
--   2. Scopes get_user_org_id() and get_user_plant_id() to is_active = true,
--      which closes org_isolation for inactive JWTs.
--
-- Not included (follow-up, also needs approval): banning the Auth user on
-- deactivate so signInWithPassword itself fails.

-- 1. Self-read must exist BEFORE get_user_org_id starts returning NULL for
--    inactive callers, or fetchEmployee cannot tell "deactivated" from
--    "no profile".
DROP POLICY IF EXISTS employees_self_select ON public.employees;
CREATE POLICY employees_self_select ON public.employees
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- 2. Inactive users no longer satisfy org_isolation (USING falls through to
--    NULL). FOR ALL WITH CHECK uses the same expression, so they also cannot
--    UPDATE themselves back to active.
CREATE OR REPLACE FUNCTION public.get_user_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT e.org_id FROM employees e
    WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
    LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_plant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT e.plant_id FROM employees e
    WHERE e.auth_user_id = auth.uid()
      AND e.is_active = true
    LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_plant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_plant_id() TO authenticated, service_role;
