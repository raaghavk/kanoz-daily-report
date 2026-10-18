import { describe, it, expect } from 'vitest'
import { vehicleSummary, normalizePhone, isValidIndianMobile, normalizeIndianMobile, VEHICLE_TYPES } from '../vehicleTypes'

describe('vehicleSummary', () => {
  it('returns empty string when there are no vehicles', () => {
    expect(vehicleSummary([])).toBe('')
    expect(vehicleSummary(null)).toBe('')
  })

  it('shows type and plate for a single vehicle', () => {
    expect(vehicleSummary([{ vehicle_type: 'Hywa', vehicle_number: 'MP17ZN8404', is_active: true }]))
      .toBe('Hywa · MP17ZN8404')
  })

  it('collapses multiple vehicles onto one line', () => {
    expect(vehicleSummary([
      { vehicle_type: 'Hywa', vehicle_number: 'MP17ZN8404', is_active: true },
      { vehicle_type: 'Hywa', vehicle_number: 'UP70JT8405', is_active: true },
    ])).toBe('2 vehicles · MP17ZN8404, UP70JT8405')
  })

  it('ignores inactive vehicles', () => {
    expect(vehicleSummary([
      { vehicle_type: 'Tractor', vehicle_number: '3230', is_active: true },
      { vehicle_type: 'Truck', vehicle_number: 'XX', is_active: false },
    ])).toBe('Tractor · 3230')
  })
})

describe('normalizePhone', () => {
  it('prefixes +91 and strips junk', () => {
    expect(normalizePhone('8858092006')).toBe('+918858092006')
    expect(normalizePhone('+91 88580 92006')).toBe('+918858092006')
  })
})

describe('isValidIndianMobile', () => {
  it('accepts 10 digits with optional +91 and rejects 12-digit numbers', () => {
    expect(isValidIndianMobile('9876543210')).toBe(true)
    expect(isValidIndianMobile('+91 98765 43210')).toBe(true)
    expect(isValidIndianMobile('919876543210')).toBe(true)
    expect(isValidIndianMobile('987654321012')).toBe(false)
    expect(isValidIndianMobile('12345')).toBe(false)
    expect(isValidIndianMobile('')).toBe(false)
  })
})

describe('normalizeIndianMobile', () => {
  it('stores valid numbers as +91XXXXXXXXXX', () => {
    expect(normalizeIndianMobile('+91 9876543210')).toBe('+919876543210')
    expect(normalizeIndianMobile('987654321012')).toBe('')
  })
})

describe('VEHICLE_TYPES', () => {
  it('includes Hywa and Tractor', () => {
    expect(VEHICLE_TYPES).toContain('Tractor')
    expect(VEHICLE_TYPES).toContain('Hywa')
  })
})
