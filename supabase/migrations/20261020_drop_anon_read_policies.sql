-- NEEDS OWNER APPROVAL — do not apply to live without review.
-- Project: coguzmhpfmjkxmuasuoj (Kanoz Daily Report v2)
-- Live audit: 2026-10-20, SELECT-only. This file is not applied by the PR.
--
-- Closes public reads of plant/business data via the anon key (the same key
-- shipped to kanoz-daily-report.vercel.app / app.kanoz.in).
--
-- What this does (idempotent):
--   1. DROP every live `sheet_sync_read` policy (anon SELECT, some USING true).
--   2. DROP public.vm_filings / public.vm_ops_inbox policies that grant
--      anon+authenticated SELECT/INSERT/UPDATE with USING (true).
--   3. Retarget remaining `TO public` policies on public-schema tables to
--      `TO authenticated` (org_isolation still uses get_user_org_id()).
--   4. REVOKE table/sequence/function privileges from anon (and PUBLIC execute
--      on functions). Re-GRANT the authenticated/service_role rights the app
--      needs, including explicit GRANTs for the 30 Oct 2026 Data API change.
--   5. Pin search_path on advisor-flagged functions. Views already have
--      security_invoker=on; anon GRANT on them is revoked.
--   6. Revoke anon EXECUTE on SECURITY DEFINER helpers that the advisor flagged.
--      authenticated EXECUTE on get_user_* / replace_shift_report_children is
--      KEPT — plant data entry depends on it.
--
-- Intentionally NOT changed (see comments at the bottom):
--   - storage.buckets.photos remains public=true (issue/diesel/spare/asset
--     photos use getPublicUrl; locking the bucket would blank those screens).
--   - storage.objects policies are already authenticated-only.
--   - visamate schema GRANTs (VisaMate's own schema, not this app).
--   - Auth "leaked password protection" (dashboard toggle, not SQL).
--
-- HARD RULE: authenticated active employees keep SELECT/INSERT/UPDATE/DELETE
-- on business tables via existing org_isolation / TO authenticated policies.

-- ---------------------------------------------------------------------------
-- 1. sheet_sync_read (live-only; never existed in repo migrations)
--    customers:        org_id = a0000000-0000-0000-0000-000000000001
--    transporters:     org_id = a0000000-0000-0000-0000-000000000001
--    suppliers:        plant_id = b0000000-0000-0000-0000-000000000001 (Prayagraj)
--    raw_material_purchases / shift_reports / vehicle_dispatches:
--                      plant_id = Prayagraj AND is_deleted = false
--    dispatch_pellets, pellet_stock, pellet_types, raw_material_types,
--    transporter_vehicles: USING (true)  — entire table public
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sheet_sync_read ON public.customers;
DROP POLICY IF EXISTS sheet_sync_read ON public.dispatch_pellets;
DROP POLICY IF EXISTS sheet_sync_read ON public.pellet_stock;
DROP POLICY IF EXISTS sheet_sync_read ON public.pellet_types;
DROP POLICY IF EXISTS sheet_sync_read ON public.raw_material_purchases;
DROP POLICY IF EXISTS sheet_sync_read ON public.raw_material_types;
DROP POLICY IF EXISTS sheet_sync_read ON public.shift_reports;
DROP POLICY IF EXISTS sheet_sync_read ON public.suppliers;
DROP POLICY IF EXISTS sheet_sync_read ON public.transporter_vehicles;
DROP POLICY IF EXISTS sheet_sync_read ON public.transporters;
DROP POLICY IF EXISTS sheet_sync_read ON public.vehicle_dispatches;

-- ---------------------------------------------------------------------------
-- 2. VisaMate copies in public schema (traveler_otp etc). After DROP, RLS
--    default-deny applies even to authenticated ERP users. service_role still
--    bypasses RLS. visamate.filings is left alone (different product schema).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.vm_filings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS vm_filings_insert ON public.vm_filings';
    EXECUTE 'DROP POLICY IF EXISTS vm_filings_select ON public.vm_filings';
    EXECUTE 'DROP POLICY IF EXISTS vm_filings_update ON public.vm_filings';
  END IF;
  IF to_regclass('public.vm_ops_inbox') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS vm_ops_inbox_insert ON public.vm_ops_inbox';
    EXECUTE 'DROP POLICY IF EXISTS vm_ops_inbox_select ON public.vm_ops_inbox';
    EXECUTE 'DROP POLICY IF EXISTS vm_ops_inbox_update ON public.vm_ops_inbox';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Policies TO public also apply to anon. Retarget to authenticated so
--    org_isolation cannot be evaluated as the anonymous role. USING/WITH CHECK
--    expressions are unchanged (get_user_org_id / plant-in-org).
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = '{public}'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Privileges: anon must not be able to SELECT/INSERT/UPDATE/DELETE even if
--    a policy is added later by mistake. authenticated + service_role keep DML
--    (explicit GRANTs also cover the 30 Oct 2026 "no automatic Data API grants"
--    change for objects created by role postgres).
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- Functions: drop PUBLIC/anon execute, then restore what the app + RLS need.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_plant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replace_shift_report_children(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;

-- Trigger functions run as the table owner, but GRANT EXECUTE to authenticated
-- so a future SECURITY INVOKER trigger cannot fail plant inserts.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_employee_id'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_user_employee_id() TO authenticated, service_role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_is_admin'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_user_is_admin() TO authenticated, service_role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'normalize_purchase_serial'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.normalize_purchase_serial(text) TO authenticated, service_role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'resync_pellet_stock_chain'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.resync_pellet_stock_chain(uuid) TO authenticated, service_role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'kbe_insert_intake'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.kbe_insert_intake(text, text, text, date, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.kbe_insert_intake(text, text, text, date, text, text, text, text, text, text) TO service_role';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kbe_intake_writer') THEN
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.kbe_insert_intake(text, text, text, date, text, text, text, text, text, text) TO kbe_intake_writer';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'kbe_get_photo'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.kbe_get_photo(text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.kbe_get_photo(text) TO service_role';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kbe_intake_writer') THEN
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.kbe_get_photo(text) TO kbe_intake_writer';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Advisor: function_search_path_mutable. Views already security_invoker=on.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.ensure_primary_storage_plot() SET search_path = public, pg_temp;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'vm_set_updated_at'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.vm_set_updated_at() SET search_path = public, pg_temp';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'vm_enqueue_ops_alert'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.vm_enqueue_ops_alert() SET search_path = public, pg_temp';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'visamate' AND p.proname = 'set_updated_at'
  ) THEN
    EXECUTE 'ALTER FUNCTION visamate.set_updated_at() SET search_path = visamate, public, pg_temp';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'visamate' AND p.proname = 'enqueue_ops_alert'
  ) THEN
    EXECUTE 'ALTER FUNCTION visamate.enqueue_ops_alert() SET search_path = visamate, public, pg_temp';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_employee_id'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_user_employee_id() SET search_path = public, pg_temp';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_is_admin'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_user_is_admin() SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.mis_daily_production') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.mis_daily_production SET (security_invoker = true)';
  END IF;
  IF to_regclass('public.mis_machine_production') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.mis_machine_production SET (security_invoker = true)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run after apply; expect 0 rows)
--
-- Anon (or PUBLIC-role with no auth check) policies on public tables:
-- SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (
--     'anon' = ANY (roles)
--     OR (
--       roles = '{public}'
--       AND coalesce(qual, '') NOT ILIKE '%get_user_%'
--       AND coalesce(qual, '') NOT ILIKE '%auth.uid%'
--       AND coalesce(with_check, '') NOT ILIKE '%get_user_%'
--       AND coalesce(with_check, '') NOT ILIKE '%auth.uid%'
--     )
--   );
--
-- Anon table grants (expect 0):
-- SELECT table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public' AND grantee = 'anon';
--
-- Anon-executable SECURITY DEFINER functions (expect 0):
-- SELECT p.proname
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.prosecdef
--   AND has_function_privilege('anon', p.oid, 'EXECUTE');
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- ROLLBACK (do not run as part of this migration)
-- Restore only if plant data entry or Sheet sync is broken AND the new
-- get-sheet-data secret path is not yet in use. Recreating sheet_sync_read
-- re-opens customer/production data to anyone with the anon key.
--
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT USAGE, SELECT ON SEQUENCES TO anon;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
--
-- DO $$
-- DECLARE r record;
-- BEGIN
--   FOR r IN
--     SELECT tablename, policyname FROM pg_policies
--     WHERE schemaname = 'public' AND roles = '{authenticated}'
--       AND policyname IN (
--         'org_isolation',
--         'org members can manage spare_parts_plant_config',
--         'org members can manage reorder requests',
--         'org_members_can_access_tasks',
--         'tasks_select','tasks_insert','tasks_update','tasks_delete'
--       )
--   LOOP
--     EXECUTE format('ALTER POLICY %I ON public.%I TO public', r.policyname, r.tablename);
--   END LOOP;
-- END $$;
--
-- CREATE POLICY sheet_sync_read ON public.customers FOR SELECT TO anon
--   USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);
-- CREATE POLICY sheet_sync_read ON public.transporters FOR SELECT TO anon
--   USING (org_id = 'a0000000-0000-0000-0000-000000000001'::uuid);
-- CREATE POLICY sheet_sync_read ON public.suppliers FOR SELECT TO anon
--   USING (plant_id = 'b0000000-0000-0000-0000-000000000001'::uuid);
-- CREATE POLICY sheet_sync_read ON public.raw_material_purchases FOR SELECT TO anon
--   USING (plant_id = 'b0000000-0000-0000-0000-000000000001'::uuid AND is_deleted = false);
-- CREATE POLICY sheet_sync_read ON public.shift_reports FOR SELECT TO anon
--   USING (plant_id = 'b0000000-0000-0000-0000-000000000001'::uuid AND is_deleted = false);
-- CREATE POLICY sheet_sync_read ON public.vehicle_dispatches FOR SELECT TO anon
--   USING (plant_id = 'b0000000-0000-0000-0000-000000000001'::uuid AND is_deleted = false);
-- CREATE POLICY sheet_sync_read ON public.dispatch_pellets FOR SELECT TO anon USING (true);
-- CREATE POLICY sheet_sync_read ON public.pellet_stock FOR SELECT TO anon USING (true);
-- CREATE POLICY sheet_sync_read ON public.pellet_types FOR SELECT TO anon USING (true);
-- CREATE POLICY sheet_sync_read ON public.raw_material_types FOR SELECT TO anon USING (true);
-- CREATE POLICY sheet_sync_read ON public.transporter_vehicles FOR SELECT TO anon USING (true);
--
-- CREATE POLICY vm_filings_select ON public.vm_filings FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY vm_filings_insert ON public.vm_filings FOR INSERT TO anon, authenticated WITH CHECK (true);
-- CREATE POLICY vm_filings_update ON public.vm_filings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY vm_ops_inbox_select ON public.vm_ops_inbox FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY vm_ops_inbox_insert ON public.vm_ops_inbox FOR INSERT TO anon, authenticated WITH CHECK (true);
-- CREATE POLICY vm_ops_inbox_update ON public.vm_ops_inbox FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
--
-- GRANT EXECUTE ON FUNCTION public.kbe_insert_intake(text, text, text, date, text, text, text, text, text, text) TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.kbe_get_photo(text) TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO anon;
-- GRANT EXECUTE ON FUNCTION public.get_user_employee_id() TO anon;
-- GRANT EXECUTE ON FUNCTION public.get_user_is_admin() TO anon;
-- GRANT EXECUTE ON FUNCTION public.resync_pellet_stock_chain(uuid) TO anon;
--
-- ALTER FUNCTION public.ensure_primary_storage_plot() RESET search_path;
-- ALTER FUNCTION public.vm_set_updated_at() RESET search_path;
-- ALTER FUNCTION public.vm_enqueue_ops_alert() RESET search_path;
-- ---------------------------------------------------------------------------
