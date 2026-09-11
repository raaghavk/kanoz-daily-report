import { describe, it, expect } from 'vitest'
import {
  reportContainsInstant,
  selectCascadeReportIds,
  earlierCascadePoint,
} from '../cascadeResyncSelect'

const reports = [
  {
    id: 'r1',
    shift_start_date: '2025-07-03',
    start_time: '08:00',
    shift_end_date: '2025-07-03',
    end_time: '20:00',
  },
  {
    id: 'r2',
    shift_start_date: '2025-07-03',
    start_time: '20:00',
    shift_end_date: '2025-07-04',
    end_time: '08:00',
  },
  {
    id: 'r3',
    shift_start_date: '2025-07-04',
    start_time: '08:00',
    shift_end_date: '2025-07-04',
    end_time: '20:00',
  },
  {
    id: 'r4',
    shift_start_date: '2025-07-05',
    start_time: '08:00',
    shift_end_date: '2025-07-05',
    end_time: '20:00',
  },
]

describe('reportContainsInstant', () => {
  it('matches purchase inside day shift', () => {
    expect(reportContainsInstant(reports[2], '2025-07-04', '10:30')).toBe(true)
  })

  it('matches overnight window across midnight', () => {
    expect(reportContainsInstant(reports[1], '2025-07-04', '02:00')).toBe(true)
    expect(reportContainsInstant(reports[1], '2025-07-03', '21:00')).toBe(true)
  })

  it('excludes end boundary (end-exclusive)', () => {
    expect(reportContainsInstant(reports[0], '2025-07-03', '20:00')).toBe(false)
  })
})

describe('selectCascadeReportIds', () => {
  it('starts at report whose window contains the purchase', () => {
    expect(selectCascadeReportIds(reports, '2025-07-04', '10:00')).toEqual(['r3', 'r4'])
  })

  it('cascades from overnight shift when purchase is at night', () => {
    expect(selectCascadeReportIds(reports, '2025-07-04', '02:00')).toEqual(['r2', 'r3', 'r4'])
  })

  it('falls back to first report starting at/after instant when between windows', () => {
    // 20:00 on Jul 4 is the end of r3 and start of nothing until Jul 5 —
    // r3 ends at 20:00 exclusive so 20:00 is not in r3; next start is r4.
    expect(selectCascadeReportIds(reports, '2025-07-04', '20:00')).toEqual(['r4'])
  })

  it('returns empty when purchase is after every report', () => {
    expect(selectCascadeReportIds(reports, '2025-07-10', '09:00')).toEqual([])
  })

  it('returns all reports when purchase is before the first', () => {
    expect(selectCascadeReportIds(reports, '2025-07-01', '09:00')).toEqual(['r1', 'r2', 'r3', 'r4'])
  })
})

describe('earlierCascadePoint', () => {
  it('picks the earlier of old vs new purchase datetime', () => {
    expect(
      earlierCascadePoint(
        { date: '2025-07-10', time: '09:00' },
        { date: '2025-07-04', time: '11:00' },
      ),
    ).toEqual({ date: '2025-07-04', time: '11:00' })
  })

  it('returns the only available side', () => {
    expect(earlierCascadePoint(null, { date: '2025-07-04', time: '08:00' })).toEqual({
      date: '2025-07-04',
      time: '08:00',
    })
  })
})

describe('month-agnostic cascade (any calendar month)', () => {
  const march = [
    { id: 'm1', shift_start_date: '2025-03-01', start_time: '08:00', shift_end_date: '2025-03-01', end_time: '20:00' },
    { id: 'm2', shift_start_date: '2025-03-02', start_time: '08:00', shift_end_date: '2025-03-02', end_time: '20:00' },
    { id: 'm3', shift_start_date: '2025-03-03', start_time: '08:00', shift_end_date: '2025-03-03', end_time: '20:00' },
  ]

  it('cascades March purchases the same way as any other month', () => {
    expect(selectCascadeReportIds(march, '2025-03-02', '10:00')).toEqual(['m2', 'm3'])
  })
})
