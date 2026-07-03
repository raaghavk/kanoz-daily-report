-- ============================================================
-- Kanoz Daily Report — Security & performance fixes
-- Applied to live Supabase project "Kanoz Daily Report v2"
-- (coguzmhpfmjkxmuasuoj) on 2026-07-02 by Claude.
-- Commit this file to supabase/migrations/ in the repo so the
-- schema history stays in version control.
-- ============================================================

-- ---------- Migration 1: security_hardening_functions_and_storage ----------

-- 1. CRITICAL: execute_readonly_query was callable by anon/authenticated as
-- SECURITY DEFINER, allowing anyone with the public anon key to read the
-- ENTIRE database bypassing RLS.
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM authenticated;
ALTER FUNCTION public.execute_readonly_query(text) SET search_path = public, pg_temp;

-- 2. Other SECURITY DEFINER functions: remove PUBLIC/anon access
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_plant_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_plant_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_plant_id() TO authenticated, service_role;

-- 3. Pin search_path (advisor: function_search_path_mutable)
ALTER FUNCTION public.update_notification_preferences_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_org_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_plant_id() SET search_path = public, pg_temp;

-- 4. photos bucket: prevent anonymous listing of all files.
-- App only uses getPublicUrl(), which does not need a SELECT policy.
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
CREATE POLICY "Authenticated can view photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'photos');

-- ---------- Migration 2: rls_policy_optimization ----------
-- Wrap auth.uid()/auth.role() in (SELECT ...) so it evaluates once per query
-- instead of once per row, and scope policies to the correct roles.

ALTER POLICY "Service role only" ON public.app_config TO service_role USING (true) WITH CHECK (true);

ALTER POLICY "audit_log_policy" ON public.audit_log TO authenticated
  USING (performed_by = (SELECT auth.uid()))
  WITH CHECK (performed_by = (SELECT auth.uid()));

ALTER POLICY "Users can read equipment for their org plants" ON public.equipment TO authenticated
  USING (plant_id IN (SELECT p.id FROM plants p JOIN organizations o ON p.org_id = o.id JOIN employees e ON e.org_id = o.id WHERE e.auth_user_id = (SELECT auth.uid())));
ALTER POLICY "equipment_insert" ON public.equipment TO authenticated
  WITH CHECK (plant_id IN (SELECT p.id FROM plants p JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
ALTER POLICY "equipment_update" ON public.equipment TO authenticated
  USING (plant_id IN (SELECT p.id FROM plants p JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())))
  WITH CHECK (plant_id IN (SELECT p.id FROM plants p JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
ALTER POLICY "equipment_delete" ON public.equipment TO authenticated
  USING (plant_id IN (SELECT p.id FROM plants p JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));

ALTER POLICY "Users can view diesel purchases in their org" ON public.diesel_purchases TO authenticated
  USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
ALTER POLICY "Users can insert diesel purchases" ON public.diesel_purchases TO authenticated
  WITH CHECK (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
ALTER POLICY "diesel_purchases_update" ON public.diesel_purchases TO authenticated
  USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())))
  WITH CHECK (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
ALTER POLICY "Users can delete diesel purchases" ON public.diesel_purchases TO authenticated
  USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));

ALTER POLICY "Users can read diesel_stock for their org" ON public.diesel_stock TO authenticated
  USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
ALTER POLICY "Users can insert diesel_stock" ON public.diesel_stock TO authenticated
  WITH CHECK (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
ALTER POLICY "Users can update diesel_stock" ON public.diesel_stock TO authenticated
  USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
ALTER POLICY "Users can delete diesel_stock" ON public.diesel_stock TO authenticated
  USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));

ALTER POLICY "employee_own_notification_prefs" ON public.notification_preferences TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE auth_user_id = (SELECT auth.uid())));
ALTER POLICY "service_role_read_notification_prefs" ON public.notification_preferences TO service_role USING (true);

ALTER POLICY "Users can manage own push subscriptions" ON public.push_subscriptions TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE auth_user_id = (SELECT auth.uid())))
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE auth_user_id = (SELECT auth.uid())));
ALTER POLICY "Service role can read all push subscriptions" ON public.push_subscriptions TO service_role USING (true);

-- delete_requests: SECURITY FIX — the old org_isolation (ALL) policy let ANY
-- employee approve/reject delete requests via the API. Now UPDATE is admin-only.
DROP POLICY IF EXISTS "org_isolation" ON public.delete_requests;
DROP POLICY IF EXISTS "admin_only_review" ON public.delete_requests;
CREATE POLICY "delete_requests_select" ON public.delete_requests
  FOR SELECT TO authenticated USING (org_id = get_user_org_id());
CREATE POLICY "delete_requests_insert" ON public.delete_requests
  FOR INSERT TO authenticated WITH CHECK (org_id = get_user_org_id());
CREATE POLICY "delete_requests_admin_update" ON public.delete_requests
  FOR UPDATE TO authenticated
  USING (org_id = get_user_org_id() AND EXISTS (
    SELECT 1 FROM employees WHERE auth_user_id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (org_id = get_user_org_id());

-- ---------- Migration 3: add_foreign_key_indexes ----------
-- Creates a covering index for every single-column foreign key that lacked one
-- (~30 indexes, advisor: unindexed_foreign_keys).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT cl.relname AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND n.nspname = 'public'
      AND array_length(c.conkey, 1) = 1
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1]
      )
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_%s ON public.%I (%I)', r.tbl, r.col, r.tbl, r.col);
  END LOOP;
END $$;
