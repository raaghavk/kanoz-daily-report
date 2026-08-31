import { describe, it, expect, beforeEach } from 'vitest'
import { can, ROLE_OPTIONS, setDynamicRoles } from '../permissions'

describe('can(role, action)', () => {
  const ALL_ACTIONS = [
    'create_report', 'create_dispatch', 'create_purchase',
    'view_reports', 'view_dispatches', 'view_purchases',
    'export', 'manage_users', 'plant_settings', 'switch_plant',
  ]

  it('admin has all permissions', () => {
    ALL_ACTIONS.forEach(action => {
      expect(can('admin', action)).toBe(true)
    })
  })

  it('plant_manager has full plant-level operational and management access', () => {
    expect(can('plant_manager', 'create_report')).toBe(true)
    expect(can('plant_manager', 'create_dispatch')).toBe(true)
    expect(can('plant_manager', 'create_purchase')).toBe(true)
    expect(can('plant_manager', 'view_reports')).toBe(true)
    expect(can('plant_manager', 'view_dispatches')).toBe(true)
    expect(can('plant_manager', 'view_purchases')).toBe(true)
    expect(can('plant_manager', 'export')).toBe(true)
    expect(can('plant_manager', 'manage_users')).toBe(false) // user/role management is admin-only
    expect(can('plant_manager', 'plant_settings')).toBe(true)
    expect(can('plant_manager', 'switch_plant')).toBe(false)
  })

  it('supervisor can create, view, and export but not manage/settings', () => {
    expect(can('supervisor', 'create_report')).toBe(true)
    expect(can('supervisor', 'create_dispatch')).toBe(true)
    expect(can('supervisor', 'create_purchase')).toBe(true)
    expect(can('supervisor', 'view_reports')).toBe(true)
    expect(can('supervisor', 'view_dispatches')).toBe(true)
    expect(can('supervisor', 'view_purchases')).toBe(true)
    expect(can('supervisor', 'export')).toBe(true)
    expect(can('supervisor', 'manage_users')).toBe(false)
    expect(can('supervisor', 'plant_settings')).toBe(false)
    expect(can('supervisor', 'switch_plant')).toBe(false)
  })

  it('purchase_manager can manage purchases and view reports', () => {
    expect(can('purchase_manager', 'create_purchase')).toBe(true)
    expect(can('purchase_manager', 'view_purchases')).toBe(true)
    expect(can('purchase_manager', 'create_report')).toBe(false)
    expect(can('purchase_manager', 'view_reports')).toBe(true)
    expect(can('purchase_manager', 'create_dispatch')).toBe(false)
    expect(can('purchase_manager', 'view_dispatches')).toBe(false)
    expect(can('purchase_manager', 'export')).toBe(false)
    expect(can('purchase_manager', 'manage_users')).toBe(false)
  })

  it('accountant can only view and export', () => {
    expect(can('accountant', 'view_reports')).toBe(true)
    expect(can('accountant', 'view_dispatches')).toBe(true)
    expect(can('accountant', 'view_purchases')).toBe(true)
    expect(can('accountant', 'export')).toBe(true)
    expect(can('accountant', 'create_report')).toBe(false)
    expect(can('accountant', 'create_dispatch')).toBe(false)
    expect(can('accountant', 'create_purchase')).toBe(false)
    expect(can('accountant', 'manage_users')).toBe(false)
    expect(can('accountant', 'plant_settings')).toBe(false)
    expect(can('accountant', 'switch_plant')).toBe(false)
  })

  it('returns false for unknown role', () => {
    expect(can('unknown_role', 'create_report')).toBe(false)
  })

  it('returns false for unknown action', () => {
    expect(can('admin', 'nonexistent_action')).toBe(false)
  })

  it('returns false for null/undefined role', () => {
    expect(can(null, 'create_report')).toBe(false)
    expect(can(undefined, 'create_report')).toBe(false)
  })
})

describe('dynamic roles', () => {
  beforeEach(() => setDynamicRoles(null))
  afterEach(() => setDynamicRoles(null))

  it('falls back to the built-in matrix when a custom role has an empty permission list', () => {
    setDynamicRoles({ admin: [] })
    expect(can('admin', 'create_report')).toBe(true)
    expect(can('admin', 'manage_users')).toBe(true)
  })

  it('uses the custom list when it has at least one permission', () => {
    setDynamicRoles({ supervisor: ['view_reports'] })
    expect(can('supervisor', 'view_reports')).toBe(true)
    expect(can('supervisor', 'create_report')).toBe(false)
  })
})

describe('ROLE_OPTIONS', () => {
  it('has 5 entries with correct role values', () => {
    expect(ROLE_OPTIONS).toHaveLength(5)
    const values = ROLE_OPTIONS.map(r => r.value)
    expect(values).toContain('admin')
    expect(values).toContain('plant_manager')
    expect(values).toContain('supervisor')
    expect(values).toContain('purchase_manager')
    expect(values).toContain('accountant')
  })

  it('each option has label and description', () => {
    ROLE_OPTIONS.forEach(opt => {
      expect(opt.label).toBeTruthy()
      expect(opt.description).toBeTruthy()
    })
  })
})
