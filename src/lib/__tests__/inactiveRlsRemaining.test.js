import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MIGRATION = 'supabase/migrations/20261019_inactive_rls_remaining.sql'

const POLICIES = [
  { table: 'diesel_purchases', name: 'Users can view diesel purchases in their org' },
  { table: 'diesel_purchases', name: 'Users can insert diesel purchases' },
  { table: 'diesel_purchases', name: 'diesel_purchases_update' },
  { table: 'diesel_purchases', name: 'Users can delete diesel purchases' },
  { table: 'diesel_stock', name: 'Users can read diesel_stock for their org' },
  { table: 'diesel_stock', name: 'Users can insert diesel_stock' },
  { table: 'diesel_stock', name: 'Users can update diesel_stock' },
  { table: 'diesel_stock', name: 'Users can delete diesel_stock' },
  { table: 'equipment', name: 'Users can read equipment for their org plants' },
  { table: 'equipment', name: 'equipment_insert' },
  { table: 'equipment', name: 'equipment_update' },
  { table: 'equipment', name: 'equipment_delete' },
  { table: 'push_subscriptions', name: 'Users can manage own push subscriptions' },
  { table: 'notification_preferences', name: 'employee_own_notification_prefs' },
  { table: 'delete_requests', name: 'delete_requests_admin_update' },
]

function createPolicyBlocks(sql) {
  return sql.split(/CREATE POLICY /i).slice(1)
}

describe('20261019_inactive_rls_remaining.sql', () => {
  const sql = readFileSync(resolve(MIGRATION), 'utf8')
  const createSection = sql.split('-- ROLLBACK')[0]
  const rollbackSection = sql.split('-- ROLLBACK')[1] || ''

  it('is marked do-not-apply and includes a rollback section', () => {
    expect(sql).toMatch(/do not apply to live/i)
    expect(sql).toMatch(/ROLLBACK/)
    expect(rollbackSection.length).toBeGreaterThan(200)
  })

  it('recreates every remaining auth_user_id policy with is_active = true', () => {
    const blocks = createPolicyBlocks(createSection)
    expect(blocks.length).toBe(POLICIES.length)

    for (const policy of POLICIES) {
      const block = blocks.find((b) => b.includes(policy.name) && b.toLowerCase().includes(`on public.${policy.table}`))
      expect(block, `missing CREATE POLICY for ${policy.table}.${policy.name}`).toBeTruthy()
      expect(block).toMatch(/is_active\s*=\s*true/)
      expect(sql).toMatch(new RegExp(`DROP POLICY IF EXISTS[\\s\\S]{0,80}${policy.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    }
  })

  it('does not rewrite employees_self_select or the org helper functions', () => {
    expect(createSection).not.toMatch(/CREATE POLICY employees_self_select/)
    expect(createSection).not.toMatch(/CREATE OR REPLACE FUNCTION public\.get_user_org_id/)
    expect(createSection).not.toMatch(/CREATE OR REPLACE FUNCTION public\.get_user_plant_id/)
  })

  it('includes a post-apply verification query that exempts employees_self_select', () => {
    expect(sql).toMatch(/VERIFICATION/)
    expect(sql).toMatch(/employees_self_select/)
  })
})
