import { describe, it, expect } from 'vitest'
import {
  timeToInputValue,
  hydrateShiftTimesFromReport,
  hydrateMachineTimesFromProd,
} from '../shiftTimeHydrate'

describe('timeToInputValue', () => {
  it('trims Postgres time to HH:MM for the time input', () => {
    expect(timeToInputValue('14:30:00')).toBe('14:30')
    expect(timeToInputValue('08:15:00.123')).toBe('08:15')
    expect(timeToInputValue('08:15')).toBe('08:15')
  })

  it('returns empty for missing values', () => {
    expect(timeToInputValue(null)).toBe('')
    expect(timeToInputValue(undefined)).toBe('')
    expect(timeToInputValue('')).toBe('')
    expect(timeToInputValue('   ')).toBe('')
  })
})

describe('hydrateShiftTimesFromReport', () => {
  it('slices shift start/end so edit-save does not wipe them', () => {
    expect(hydrateShiftTimesFromReport({ start_time: '08:00:00', end_time: '20:00:00' })).toEqual({
      start_time: '08:00',
      end_time: '20:00',
    })
  })

  it('falls back to day-shift defaults when missing', () => {
    expect(hydrateShiftTimesFromReport({})).toEqual({ start_time: '08:00', end_time: '20:00' })
  })
})

describe('hydrateMachineTimesFromProd', () => {
  it('slices machine from/to so Step 2 time inputs stay valid', () => {
    expect(hydrateMachineTimesFromProd({ from_time: '06:00:00', to_time: '14:30:00' })).toEqual({
      from_time: '06:00',
      to_time: '14:30',
    })
  })

  it('keeps empty timings empty', () => {
    expect(hydrateMachineTimesFromProd({ from_time: null, to_time: null })).toEqual({
      from_time: '',
      to_time: '',
    })
  })
})
