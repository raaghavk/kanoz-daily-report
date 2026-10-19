import { describe, it, expect } from 'vitest'
import { isEmployeeActive, appAccessLabel, setEmployeeActiveBody, activeStatusChanged } from '../employeeAccess'

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

describe('setEmployeeActiveBody', () => {
  it('sends a boolean is_active with the employee id', () => {
    expect(setEmployeeActiveBody('e1', true)).toEqual({ employee_id: 'e1', is_active: true })
    expect(setEmployeeActiveBody('e1', false)).toEqual({ employee_id: 'e1', is_active: false })
    expect(setEmployeeActiveBody('e1', 0)).toEqual({ employee_id: 'e1', is_active: false })
  })
})

describe('activeStatusChanged', () => {
  it('detects a roster toggle and ignores a no-op save', () => {
    expect(activeStatusChanged(true, false)).toBe(true)
    expect(activeStatusChanged(false, true)).toBe(true)
    expect(activeStatusChanged(true, true)).toBe(false)
    expect(activeStatusChanged(false, false)).toBe(false)
  })
})
