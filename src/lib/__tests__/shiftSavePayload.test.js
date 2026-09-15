import { describe, it, expect } from 'vitest'
import { buildShiftChildrenPayload, mapDieselPurchasesFromRows, timeToInputValue } from '../shiftSavePayload'

describe('buildShiftChildrenPayload issues', () => {
  it('includes the selected machine_id', () => {
    const payload = buildShiftChildrenPayload({
      machines: [],
      production: [],
      mixes: [],
      rawMaterials: [],
      processing: [],
      diesel: [],
      pelletStock: [],
      issues: [{
        type: 'Machine',
        description: 'Belt snapped',
        severity: 'high',
        photo_url: null,
        machine_id: '11111111-1111-1111-1111-111111111111',
      }],
      diesel_stock: {},
    }, { id: 'p1', org_id: 'o1' })

    expect(payload.issues[0].machine_id).toBe('11111111-1111-1111-1111-111111111111')
  })
})

describe('mapDieselPurchasesFromRows', () => {
  it('keeps purchase_time so an edit save does not wipe it', () => {
    const mapped = mapDieselPurchasesFromRows([
      { litres: 40, cost_per_litre: 92, receipt_url: 'https://example.com/slip.jpg', purchase_time: '14:30:00' },
    ])
    expect(mapped).toEqual([{
      litres: 40,
      cost_per_litre: 92,
      receipt_url: 'https://example.com/slip.jpg',
      purchase_time: '14:30',
    }])

    const payload = buildShiftChildrenPayload({
      machines: [],
      production: [],
      mixes: [],
      rawMaterials: [],
      processing: [],
      diesel: [],
      pelletStock: [],
      issues: [],
      diesel_stock: { opening: 0, purchases: mapped },
    }, { id: 'p1', org_id: 'o1' })

    expect(payload.diesel_purchases[0].purchase_time).toBe('14:30')
  })

  it('returns empty when the query had no rows', () => {
    expect(mapDieselPurchasesFromRows(null)).toEqual([])
    expect(mapDieselPurchasesFromRows([])).toEqual([])
  })
})

describe('timeToInputValue', () => {
  it('trims Postgres time to HH:MM for the time input', () => {
    expect(timeToInputValue('08:15:00')).toBe('08:15')
    expect(timeToInputValue('08:15')).toBe('08:15')
    expect(timeToInputValue(null)).toBe('')
  })
})
