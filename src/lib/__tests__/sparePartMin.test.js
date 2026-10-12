import { describe, it, expect } from 'vitest'
import { currentPlantMin, formatMinLevel } from '../sparePartMin'

const plantStock = [
  { id: 'p1', name: 'Plant A', stock: 3, min: 5 },
  { id: 'p2', name: 'Plant B', stock: 10, min: null },
  { id: 'p3', name: 'Plant C', stock: 0, min: 0 },
]

describe('currentPlantMin', () => {
  it('returns the current plant min from plant config, not the catalogue column', () => {
    expect(currentPlantMin(plantStock, 'p1')).toBe(5)
  })

  it('treats 0 as a configured min', () => {
    expect(currentPlantMin(plantStock, 'p3')).toBe(0)
  })

  it('is null when this plant has no min configured', () => {
    expect(currentPlantMin(plantStock, 'p2')).toBeNull()
    expect(currentPlantMin(plantStock, 'missing')).toBeNull()
    expect(currentPlantMin(plantStock, null)).toBeNull()
    expect(currentPlantMin([], 'p1')).toBeNull()
  })
})

describe('formatMinLevel', () => {
  it('shows an em dash when no min is configured', () => {
    expect(formatMinLevel(null)).toBe('—')
    expect(formatMinLevel(undefined)).toBe('—')
    expect(formatMinLevel('')).toBe('—')
  })

  it('renders 0 and positive mins', () => {
    expect(formatMinLevel(0)).toBe('0')
    expect(formatMinLevel(5)).toBe('5')
  })
})
