-- NEEDS OWNER APPROVAL — do not apply to live without review.
--
-- Follow-up to 20261018_inactive_employees_rls.sql.
-- That migration scoped get_user_org_id() / get_user_plant_id() to
-- employees.is_active = true, which closes org_isolation. A few tables still
-- join employees on auth_user_id themselves, so an inactive person holding an
-- old JWT can still read/write those tables over PostgREST.
--
-- Live audit (project coguzmhpfmjkxmuasuoj, 2026-10-19, SELECT-only):
--   Functions already requiring is_active = true (no change here):
--     get_user_org_id, get_user_plant_id, get_user_employee_id, get_user_is_admin
--   Intentionally unchanged:
--     employees_self_select — inactive users must still read their own row
--     assets / asset_events — use get_user_org_id(), already closed
--   Policies below still join employees on auth_user_id with no is_active check.
--
-- This file is idempotent (DROP POLICY IF EXISTS + CREATE POLICY).
-- Do NOT apply from this PR. Do NOT ban Auth users here.

-- Shared diesel lookup: shift report in the caller's org, active employee only.
-- ---------------------------------------------------------------------------
-- diesel_purchases
DROP POLICY IF EXISTS "Users can view diesel purchases in their org" ON public.diesel_purchases;
CREATE POLICY "Users can view diesel purchases in their org"
  ON public.diesel_purchases FOR SELECT TO authenticated
  USING (shift_report_id IN (
    SELECT sr.id
    FROM shift_reports sr
    JOIN plants p ON sr.plant_id = p.id
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

DROP POLICY IF EXISTS "Users can insert diesel purchases" ON public.diesel_purchases;
CREATE POLICY "Users can insert diesel purchases"
  ON public.diesel_purchases FOR INSERT TO authenticated
  WITH CHECK (shift_report_id IN (
    SELECT sr.id
    FROM shift_reports sr
    JOIN plants p ON sr.plant_id = p.id
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

DROP POLICY IF EXISTS diesel_purchases_update ON public.diesel_purchases;
CREATE POLICY diesel_purchases_update
  ON public.diesel_purchases FOR UPDATE TO authenticated
  USING (shift_report_id IN (
    SELECT sr.id
    FROM shift_reports sr
    JOIN plants p ON sr.plant_id = p.id
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ))
  WITH CHECK (shift_report_id IN (
    SELECT sr.id
    FROM shift_reports sr
    JOIN plants p ON sr.plant_id = p.id
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

DROP POLICY IF EXISTS "Users can delete diesel purchases" ON public.diesel_purchases;
CREATE POLICY "Users can delete diesel purchases"
  ON public.diesel_purchases FOR DELETE TO authenticated
  USING (shift_report_id IN (
    SELECT sr.id
    FROM shift_reports sr
    JOIN plants p ON sr.plant_id = p.id
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

-- diesel_stock
DROP POLICY IF EXISTS "Users can read diesel_stock for their org" ON public.diesel_stock;
CREATE POLICY "Users can read diesel_stock for their org"
  ON public.diesel_stock FOR SELECT TO authenticated
  USING (shift_report_id IN (
    SELECT sr.id
    FROM shift_reports sr
    JOIN plants p ON sr.plant_id = p.id
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

DROP POLICY IF EXISTS "Users can insert diesel_stock" ON public.diesel_stock;
CREATE POLICY "Users can insert diesel_stock"
  ON public.diesel_stock FOR INSERT TO authenticated
  WITH CHECK (shift_report_id IN (
    SELECT sr.id
    FROM shift_reports sr
    JOIN plants p ON sr.plant_id = p.id
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

DROP POLICY IF EXISTS "Users can update diesel_stock" ON public.diesel_stock;
CREATE POLICY "Users can update diesel_stock"
  ON public.diesel_stock FOR UPDATE TO authenticated
  USING (shift_report_id IN (
    SELECT sr.id
    FROM shift_reports sr
    JOIN plants p ON sr.plant_id = p.id
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

DROP POLICY IF EXISTS "Users can delete diesel_stock" ON public.diesel_stock;
CREATE POLICY "Users can delete diesel_stock"
  ON public.diesel_stock FOR DELETE TO authenticated
  USING (shift_report_id IN (
    SELECT sr.id
    FROM shift_reports sr
    JOIN plants p ON sr.plant_id = p.id
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

-- equipment (SELECT still joins organizations, matching live)
DROP POLICY IF EXISTS "Users can read equipment for their org plants" ON public.equipment;
CREATE POLICY "Users can read equipment for their org plants"
  ON public.equipment FOR SELECT TO authenticated
  USING (plant_id IN (
    SELECT p.id
    FROM plants p
    JOIN organizations o ON p.org_id = o.id
    JOIN employees e ON e.org_id = o.id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

DROP POLICY IF EXISTS equipment_insert ON public.equipment;
CREATE POLICY equipment_insert
  ON public.equipment FOR INSERT TO authenticated
  WITH CHECK (plant_id IN (
    SELECT p.id
    FROM plants p
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

DROP POLICY IF EXISTS equipment_update ON public.equipment;
CREATE POLICY equipment_update
  ON public.equipment FOR UPDATE TO authenticated
  USING (plant_id IN (
    SELECT p.id
    FROM plants p
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ))
  WITH CHECK (plant_id IN (
    SELECT p.id
    FROM plants p
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

DROP POLICY IF EXISTS equipment_delete ON public.equipment;
CREATE POLICY equipment_delete
  ON public.equipment FOR DELETE TO authenticated
  USING (plant_id IN (
    SELECT p.id
    FROM plants p
    JOIN employees e ON e.org_id = p.org_id
    WHERE e.auth_user_id = (SELECT auth.uid())
      AND e.is_active = true
  ));

-- push subscriptions: own rows only, and only while the employee is active
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees
    WHERE auth_user_id = (SELECT auth.uid())
      AND is_active = true
  ))
  WITH CHECK (employee_id IN (
    SELECT id FROM employees
    WHERE auth_user_id = (SELECT auth.uid())
      AND is_active = true
  ));

-- notification preferences: same own-row pattern
DROP POLICY IF EXISTS employee_own_notification_prefs ON public.notification_preferences;
CREATE POLICY employee_own_notification_prefs
  ON public.notification_preferences FOR ALL TO authenticated
  USING (employee_id IN (
    SELECT id FROM employees
    WHERE auth_user_id = (SELECT auth.uid())
      AND is_active = true
  ));

-- delete_requests admin UPDATE already uses get_user_org_id(); add is_active
-- on the EXISTS so an inactive admin JWT cannot approve via this extra join.
DROP POLICY IF EXISTS delete_requests_admin_update ON public.delete_requests;
CREATE POLICY delete_requests_admin_update
  ON public.delete_requests FOR UPDATE TO authenticated
  USING (
    org_id = get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = (SELECT auth.uid())
        AND role = 'admin'
        AND is_active = true
    )
  )
  WITH CHECK (org_id = get_user_org_id());

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after apply; expect 0 rows besides employees_self_select)
--
-- SELECT n.nspname AS schema, c.relname AS table_name, p.polname AS policy,
--        pg_get_expr(p.polqual, p.polrelid) AS using_expr,
--        pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
-- FROM pg_policy p
-- JOIN pg_class c ON c.oid = p.polrelid
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND (
--     coalesce(pg_get_expr(p.polqual, p.polrelid), '') ILIKE '%auth_user_id%'
--     OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ILIKE '%auth_user_id%'
--   )
--   AND coalesce(pg_get_expr(p.polqual, p.polrelid), '') NOT ILIKE '%is_active%'
--   AND coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') NOT ILIKE '%is_active%'
--   AND p.polname <> 'employees_self_select';
--
-- Functions (all four should already contain is_active = true):
-- SELECT proname, prosrc FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND prosrc ILIKE '%auth_user_id%';

-- ---------------------------------------------------------------------------
-- ROLLBACK (do not run as part of this migration)
-- Restore the pre-is_active policies from 20260702_security_and_performance_fixes.sql.
--
-- DROP POLICY IF EXISTS "Users can view diesel purchases in their org" ON public.diesel_purchases;
-- CREATE POLICY "Users can view diesel purchases in their org"
--   ON public.diesel_purchases FOR SELECT TO authenticated
--   USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
-- DROP POLICY IF EXISTS "Users can insert diesel purchases" ON public.diesel_purchases;
-- CREATE POLICY "Users can insert diesel purchases"
--   ON public.diesel_purchases FOR INSERT TO authenticated
--   WITH CHECK (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
-- DROP POLICY IF EXISTS diesel_purchases_update ON public.diesel_purchases;
-- CREATE POLICY diesel_purchases_update
--   ON public.diesel_purchases FOR UPDATE TO authenticated
--   USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())))
--   WITH CHECK (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
-- DROP POLICY IF EXISTS "Users can delete diesel purchases" ON public.diesel_purchases;
-- CREATE POLICY "Users can delete diesel purchases"
--   ON public.diesel_purchases FOR DELETE TO authenticated
--   USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
--
-- DROP POLICY IF EXISTS "Users can read diesel_stock for their org" ON public.diesel_stock;
-- CREATE POLICY "Users can read diesel_stock for their org"
--   ON public.diesel_stock FOR SELECT TO authenticated
--   USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
-- DROP POLICY IF EXISTS "Users can insert diesel_stock" ON public.diesel_stock;
-- CREATE POLICY "Users can insert diesel_stock"
--   ON public.diesel_stock FOR INSERT TO authenticated
--   WITH CHECK (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
-- DROP POLICY IF EXISTS "Users can update diesel_stock" ON public.diesel_stock;
-- CREATE POLICY "Users can update diesel_stock"
--   ON public.diesel_stock FOR UPDATE TO authenticated
--   USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
-- DROP POLICY IF EXISTS "Users can delete diesel_stock" ON public.diesel_stock;
-- CREATE POLICY "Users can delete diesel_stock"
--   ON public.diesel_stock FOR DELETE TO authenticated
--   USING (shift_report_id IN (SELECT sr.id FROM shift_reports sr JOIN plants p ON sr.plant_id = p.id JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
--
-- DROP POLICY IF EXISTS "Users can read equipment for their org plants" ON public.equipment;
-- CREATE POLICY "Users can read equipment for their org plants"
--   ON public.equipment FOR SELECT TO authenticated
--   USING (plant_id IN (SELECT p.id FROM plants p JOIN organizations o ON p.org_id = o.id JOIN employees e ON e.org_id = o.id WHERE e.auth_user_id = (SELECT auth.uid())));
-- DROP POLICY IF EXISTS equipment_insert ON public.equipment;
-- CREATE POLICY equipment_insert
--   ON public.equipment FOR INSERT TO authenticated
--   WITH CHECK (plant_id IN (SELECT p.id FROM plants p JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
-- DROP POLICY IF EXISTS equipment_update ON public.equipment;
-- CREATE POLICY equipment_update
--   ON public.equipment FOR UPDATE TO authenticated
--   USING (plant_id IN (SELECT p.id FROM plants p JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())))
--   WITH CHECK (plant_id IN (SELECT p.id FROM plants p JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
-- DROP POLICY IF EXISTS equipment_delete ON public.equipment;
-- CREATE POLICY equipment_delete
--   ON public.equipment FOR DELETE TO authenticated
--   USING (plant_id IN (SELECT p.id FROM plants p JOIN employees e ON e.org_id = p.org_id WHERE e.auth_user_id = (SELECT auth.uid())));
--
-- DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
-- CREATE POLICY "Users can manage own push subscriptions"
--   ON public.push_subscriptions FOR ALL TO authenticated
--   USING (employee_id IN (SELECT id FROM employees WHERE auth_user_id = (SELECT auth.uid())))
--   WITH CHECK (employee_id IN (SELECT id FROM employees WHERE auth_user_id = (SELECT auth.uid())));
--
-- DROP POLICY IF EXISTS employee_own_notification_prefs ON public.notification_preferences;
-- CREATE POLICY employee_own_notification_prefs
--   ON public.notification_preferences FOR ALL TO authenticated
--   USING (employee_id IN (SELECT id FROM employees WHERE auth_user_id = (SELECT auth.uid())));
--
-- DROP POLICY IF EXISTS delete_requests_admin_update ON public.delete_requests;
-- CREATE POLICY delete_requests_admin_update
--   ON public.delete_requests FOR UPDATE TO authenticated
--   USING (org_id = get_user_org_id() AND EXISTS (
--     SELECT 1 FROM employees WHERE auth_user_id = (SELECT auth.uid()) AND role = 'admin'))
--   WITH CHECK (org_id = get_user_org_id());
