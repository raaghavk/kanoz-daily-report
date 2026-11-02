import { describe, it, expect } from 'vitest'
import { shouldNotifyLowStock, plantMinByPartId } from '../sparePartsStock'

describe('shouldNotifyLowStock', () => {
  it('is false when this plant has no min configured', () => {
    expect(shouldNotifyLowStock(0, null)).toBe(false)
    expect(shouldNotifyLowStock(0, undefined)).toBe(false)
    expect(shouldNotifyLowStock(0, '')).toBe(false)
  })

  it('notifies when stock is at or below plant min (same rule as Home)', () => {
    expect(shouldNotifyLowStock(2, 2)).toBe(true)
    expect(shouldNotifyLowStock(1, 2)).toBe(true)
    expect(shouldNotifyLowStock(3, 2)).toBe(false)
  })
})

describe('plantMinByPartId', () => {
  it('maps spare_parts_plant_config rows by part_id', () => {
    expect(plantMinByPartId([
      { part_id: 'p1', min_stock_level: 5 },
      { part_id: 'p2', min_stock_level: 0 },
    ])).toEqual({ p1: 5, p2: 0 })
  })
})
