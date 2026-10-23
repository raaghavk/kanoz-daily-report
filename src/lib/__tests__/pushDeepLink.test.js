import { describe, it, expect } from 'vitest'
import { reportPushPath } from '../pushDeepLink'

describe('reportPushPath', () => {
  it('opens the report when report_id is present', () => {
    expect(reportPushPath('abc-123')).toBe('/reports/abc-123')
  })

  it('falls back to the reports list when report_id is missing', () => {
    expect(reportPushPath(null)).toBe('/reports')
    expect(reportPushPath(undefined)).toBe('/reports')
    expect(reportPushPath('')).toBe('/reports')
  })
})
