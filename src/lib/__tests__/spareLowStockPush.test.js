import { describe, it, expect } from 'vitest'
import { spareLowStockPushPath } from '../spareLowStockPush'

describe('spareLowStockPushPath', () => {
  it('opens the part detail when part_id is present', () => {
    expect(spareLowStockPushPath('abc-123')).toBe('/spare-parts/parts/abc-123')
  })

  it('falls back to the catalogue when part_id is missing', () => {
    expect(spareLowStockPushPath(null)).toBe('/spare-parts/parts')
    expect(spareLowStockPushPath(undefined)).toBe('/spare-parts/parts')
    expect(spareLowStockPushPath('')).toBe('/spare-parts/parts')
  })
})
