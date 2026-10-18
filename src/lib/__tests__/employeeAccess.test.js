import { describe, it, expect } from 'vitest'
import { isEmployeeActive, appAccessLabel } from '../employeeAccess'

describe('isEmployeeActive', () => {
  it('treats missing/true as active and explicit false as inactive', () => {
    expect(isEmployeeActive({ is_active: true })).toBe(true)
    expect(isEmployeeActive({ name: 'Pat' })).toBe(true)
    expect(isEmployeeActive({ is_active: false })).toBe(false)
    expect(isEmployeeActive(null)).toBe(false)
  })
})

describe('appAccessLabel', () => {
  it('does not call inactive users with a login "App access active"', () => {
    expect(appAccessLabel({ is_active: false, auth_user_id: 'u1' })).toEqual({
      kind: 'blocked',
      text: 'App access blocked',
    })
  })

  it('shows no access for inactive users without a login', () => {
    expect(appAccessLabel({ is_active: false, auth_user_id: null })).toEqual({
      kind: 'none',
      text: 'No app access',
    })
  })

  it('keeps the active-user labels', () => {
    expect(appAccessLabel({ is_active: true, auth_user_id: 'u1' }).text).toBe('App access active')
    expect(appAccessLabel({ is_active: true, auth_user_id: null }).text).toBe('No app access yet')
  })
})
