import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  PERMANENT_BAN_DURATION,
  UNBAN_DURATION,
  authBanAttributes,
  authBanStepOrder,
  inactiveCallerResponse,
  cannotDeactivateSelf,
} from '../../../supabase/functions/_shared/authBan.js'

describe('authBanAttributes', () => {
  it('bans for 100 years on deactivate and lifts the ban on reactivate', () => {
    expect(authBanAttributes(false)).toEqual({ ban_duration: PERMANENT_BAN_DURATION })
    expect(authBanAttributes(true)).toEqual({ ban_duration: UNBAN_DURATION })
    expect(PERMANENT_BAN_DURATION).toBe('876000h')
    expect(UNBAN_DURATION).toBe('none')
  })
})

describe('authBanStepOrder', () => {
  it('bans before the roster flip, unbans after', () => {
    expect(authBanStepOrder(false)).toEqual(['ban', 'roster'])
    expect(authBanStepOrder(true)).toEqual(['roster', 'unban'])
  })
})

describe('inactiveCallerResponse', () => {
  it('rejects a missing or inactive employee row', () => {
    expect(inactiveCallerResponse(null)).toEqual({ error: 'No employee profile', status: 403 })
    expect(inactiveCallerResponse({ is_active: false, role: 'admin' })).toEqual({
      error: 'Account deactivated',
      status: 403,
    })
  })

  it('lets an active caller through', () => {
    expect(inactiveCallerResponse({ is_active: true, role: 'admin' })).toBeNull()
  })
})

describe('cannotDeactivateSelf', () => {
  it('blocks an admin from banning their own login', () => {
    expect(cannotDeactivateSelf('u1', 'u1', false)).toBe(true)
    expect(cannotDeactivateSelf('u1', 'u1', true)).toBe(false)
    expect(cannotDeactivateSelf('u1', 'u2', false)).toBe(false)
    expect(cannotDeactivateSelf('u1', null, false)).toBe(false)
  })
})

describe('edge functions wire the helpers', () => {
  it('invite-user and delete-user reject inactive callers', () => {
    const invite = readFileSync('supabase/functions/invite-user/index.ts', 'utf8')
    const del = readFileSync('supabase/functions/delete-user/index.ts', 'utf8')
    expect(invite).toContain('inactiveCallerResponse')
    expect(del).toContain('inactiveCallerResponse')
    expect(invite).toContain('is_active')
    expect(del).toContain('is_active')
  })

  it('set-employee-active uses updateUserById with the ban helper', () => {
    const src = readFileSync('supabase/functions/set-employee-active/index.ts', 'utf8')
    expect(src).toContain('updateUserById')
    expect(src).toContain('authBanAttributes')
    expect(src).toContain('authBanStepOrder')
    expect(src).toContain('cannotDeactivateSelf')
  })
})
