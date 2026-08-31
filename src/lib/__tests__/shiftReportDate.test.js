import { describe, it, expect } from 'vitest'
import { canonicalReportDate, isDispatchInShiftWindow } from '../shiftReportDate'

describe('canonicalReportDate', () => {
  it('prefers shift end date (night-shift unique key)', () => {
    expect(canonicalReportDate({
      date: '2026-08-01',
      shift_start_date: '2026-08-01',
      shift_end_date: '2026-08-02',
    })).toBe('2026-08-02')
  })

  it('falls back to start date then date', () => {
    expect(canonicalReportDate({ shift_start_date: '2026-08-01' })).toBe('2026-08-01')
    expect(canonicalReportDate({ date: '2026-08-01' })).toBe('2026-08-01')
  })
})

describe('isDispatchInShiftWindow', () => {
  const start = '2026-08-01T20:00:00'
  const end = '2026-08-02T08:00:00'

  it('includes the start boundary', () => {
    expect(isDispatchInShiftWindow({ dispatch_date: '2026-08-01', dispatch_time: '20:00:00' }, start, end)).toBe(true)
  })

  it('excludes the end boundary (handover belongs to the next shift)', () => {
    expect(isDispatchInShiftWindow({ dispatch_date: '2026-08-02', dispatch_time: '08:00:00' }, start, end)).toBe(false)
  })

  it('includes a dispatch just before handover', () => {
    expect(isDispatchInShiftWindow({ dispatch_date: '2026-08-02', dispatch_time: '07:59:00' }, start, end)).toBe(true)
  })
})
