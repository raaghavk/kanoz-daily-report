import { describe, it, expect } from 'vitest'
import { timeToInputValue } from '../dateUtils'

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
