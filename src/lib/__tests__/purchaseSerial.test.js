import { describe, it, expect } from 'vitest'
import { normalizePurchaseSerial, isPurchaseSerialUniqueViolation } from '../purchaseSerial'

describe('normalizePurchaseSerial', () => {
  it('returns empty for nullish or blank input', () => {
    expect(normalizePurchaseSerial(null)).toBe('')
    expect(normalizePurchaseSerial(undefined)).toBe('')
    expect(normalizePurchaseSerial('')).toBe('')
    expect(normalizePurchaseSerial('   ')).toBe('')
  })

  it('strips leading zeros from digit-only serials', () => {
    expect(normalizePurchaseSerial('025194')).toBe('25194')
    expect(normalizePurchaseSerial('25194')).toBe('25194')
    expect(normalizePurchaseSerial('024405')).toBe('24405')
    expect(normalizePurchaseSerial(' 022301 ')).toBe('22301')
  })

  it('collapses all-zero digit strings to a single 0', () => {
    expect(normalizePurchaseSerial('0')).toBe('0')
    expect(normalizePurchaseSerial('000')).toBe('0')
  })

  it('does not strip zeros from alphanumeric serials', () => {
    expect(normalizePurchaseSerial('A025194')).toBe('A025194')
    expect(normalizePurchaseSerial('AB-001')).toBe('AB-001')
  })

  it('coerces numbers to canonical digit strings', () => {
    expect(normalizePurchaseSerial(25194)).toBe('25194')
  })
})

describe('isPurchaseSerialUniqueViolation', () => {
  it('is false for missing or unrelated errors', () => {
    expect(isPurchaseSerialUniqueViolation(null)).toBe(false)
    expect(isPurchaseSerialUniqueViolation({ code: '42501' })).toBe(false)
    expect(isPurchaseSerialUniqueViolation({ code: '23505', message: 'purchases_pkey' })).toBe(false)
  })

  it('detects the plant-serial unique index', () => {
    expect(isPurchaseSerialUniqueViolation({
      code: '23505',
      message: 'duplicate key value violates unique constraint "raw_material_purchases_plant_serial_active_idx"',
    })).toBe(true)
  })

  it('detects serial_no in the unique-violation details', () => {
    expect(isPurchaseSerialUniqueViolation({
      code: '23505',
      details: 'Key (plant_id, serial_no)=(…, 25194) already exists.',
    })).toBe(true)
  })
})
