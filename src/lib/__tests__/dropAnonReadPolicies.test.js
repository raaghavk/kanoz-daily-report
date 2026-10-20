import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MIGRATION = 'supabase/migrations/20261020_drop_anon_read_policies.sql'

const SHEET_SYNC_TABLES = [
  'customers',
  'dispatch_pellets',
  'pellet_stock',
  'pellet_types',
  'raw_material_purchases',
  'raw_material_types',
  'shift_reports',
  'suppliers',
  'transporter_vehicles',
  'transporters',
  'vehicle_dispatches',
]

describe('20261020_drop_anon_read_policies.sql', () => {
  const sql = readFileSync(resolve(MIGRATION), 'utf8')
  const createSection = sql.split('-- ROLLBACK')[0]
  const rollbackSection = sql.split('-- ROLLBACK')[1] || ''

  it('is marked do-not-apply and includes rollback plus verification', () => {
    expect(sql).toMatch(/do not apply to live/i)
    expect(sql).toMatch(/ROLLBACK/)
    expect(sql).toMatch(/VERIFICATION/)
    expect(rollbackSection.length).toBeGreaterThan(400)
  })

  it('drops every live sheet_sync_read policy', () => {
    for (const table of SHEET_SYNC_TABLES) {
      expect(createSection).toMatch(
        new RegExp(`DROP POLICY IF EXISTS sheet_sync_read ON public\\.${table}`),
      )
    }
  })

  it('drops the open VisaMate public-schema policies', () => {
    expect(createSection).toMatch(/DROP POLICY IF EXISTS vm_filings_select/)
    expect(createSection).toMatch(/DROP POLICY IF EXISTS vm_ops_inbox_select/)
    expect(createSection).toMatch(/to_regclass\('public\.vm_filings'\)/)
  })

  it('retargets TO public policies to authenticated without rewriting USING', () => {
    expect(createSection).toMatch(/ALTER POLICY %I ON public\.%I TO authenticated/)
    expect(createSection).not.toMatch(/DROP POLICY IF EXISTS org_isolation/)
  })

  it('revokes anon DML and does not grant tables back to anon in the apply section', () => {
    expect(createSection).toMatch(/REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon/)
    expect(createSection).toMatch(/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC/)
    expect(createSection).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role/)
    expect(createSection).not.toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon/)
  })

  it('keeps execute_readonly_query on service_role only', () => {
    expect(createSection).toMatch(/GRANT EXECUTE ON FUNCTION public\.execute_readonly_query\(text\) TO service_role/)
    expect(createSection).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.execute_readonly_query\(text\) TO authenticated/)
    expect(createSection).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.execute_readonly_query\(text\) TO anon/)
  })

  it('keeps authenticated execute on RLS helpers and shift-save RPC', () => {
    expect(createSection).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_user_org_id\(\) TO authenticated, service_role/)
    expect(createSection).toMatch(/GRANT EXECUTE ON FUNCTION public\.replace_shift_report_children\(uuid, jsonb\) TO authenticated, service_role/)
  })

  it('pins search_path on advisor-flagged functions', () => {
    expect(createSection).toMatch(/ensure_primary_storage_plot\(\) SET search_path = public, pg_temp/)
    expect(createSection).toMatch(/vm_set_updated_at\(\) SET search_path/)
  })

  it('includes a post-apply verification query that expects 0 anon policies', () => {
    expect(createSection).toMatch(/'anon' = ANY \(roles\)/)
    expect(createSection).toMatch(/grantee = 'anon'/)
  })
})
