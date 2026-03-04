import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeNumber } from '../sanitize'

describe('sanitizeText', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('')
    expect(sanitizeText(undefined)).toBe('')
    expect(sanitizeText(123)).toBe('')
  })

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
  })

  it('truncates to maxLength', () => {
    expect(sanitizeText('abcdef', 3)).toBe('abc')
  })

  it('uses default maxLength of 500', () => {
    const long = 'a'.repeat(600)
    expect(sanitizeText(long)).toHaveLength(500)
  })

  it('strips script tags as plain text (no execution)', () => {
    const xss = '<script>alert(1)</script>'
    const result = sanitizeText(xss)
    expect(result).toBe(xss) // stored as text, not executed
    expect(result).toContain('<script>')
  })

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('')
  })
})

describe('sanitizeNumber', () => {
  it('returns 0 for NaN', () => {
    expect(sanitizeNumber('abc')).toBe(0)
    expect(sanitizeNumber(null)).toBe(0)
    expect(sanitizeNumber(undefined)).toBe(0)
    expect(sanitizeNumber('')).toBe(0)
  })

  it('parses valid numbers', () => {
    expect(sanitizeNumber('42')).toBe(42)
    expect(sanitizeNumber('3.14')).toBeCloseTo(3.14)
    expect(sanitizeNumber(100)).toBe(100)
  })

  it('clamps to min', () => {
    expect(sanitizeNumber(-5, { min: 0 })).toBe(0)
  })

  it('clamps to max', () => {
    expect(sanitizeNumber(999, { max: 100 })).toBe(100)
  })

  it('handles negative numbers with default min of 0', () => {
    expect(sanitizeNumber(-10)).toBe(0)
  })
})
