import { describe, it, expect } from 'vitest'
import { kattaParchiToDispatchUpdates } from '../dispatchOcr'

describe('kattaParchiToDispatchUpdates', () => {
  it('maps slip serial onto serial_no, not invoice_number', () => {
    const updates = kattaParchiToDispatchUpdates({
      vehicle_number: 'UP70MT6151',
      serial_no: '023253',
      date: '2026-07-17',
      time: '14:22',
    })
    expect(updates.serial_no).toBe('023253')
    expect(updates.truck_number).toBe('UP70MT6151')
    expect(updates.dispatch_date).toBe('2026-07-17')
    expect(updates.loading_date).toBe('2026-07-17')
    expect(updates.dispatch_time).toBe('14:22')
    expect(updates.loading_time).toBe('14:22')
    expect(updates).not.toHaveProperty('invoice_number')
  })

  it('ignores blank or missing serial', () => {
    expect(kattaParchiToDispatchUpdates({ serial_no: '' })).toEqual({})
    expect(kattaParchiToDispatchUpdates({ serial_no: '  ' }).serial_no).toBeUndefined()
    expect(kattaParchiToDispatchUpdates(null)).toEqual({})
  })

  it('coerces numeric serials to string', () => {
    expect(kattaParchiToDispatchUpdates({ serial_no: 23253 }).serial_no).toBe('23253')
  })
})
