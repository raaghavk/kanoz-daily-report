import { describe, it, expect } from 'vitest'
import { getValidationErrors } from '../validation'

function makeValidReport() {
  return {
    date: '2025-01-15',
    shift: 1,
    start_time: '06:00',
    end_time: '14:00',
    machines: [{ from_time: '06:00', to_time: '14:00' }],
    production: [{ quantity: '10', mix_usages: [{ quantity_kg: '15' }] }],
    rawMaterials: [{ used: '5' }],
  }
}

describe('getValidationErrors', () => {
  it('returns empty array when all required fields are present', () => {
    expect(getValidationErrors(makeValidReport())).toEqual([])
  })

  it('returns step 1 error when date is missing', () => {
    const report = makeValidReport()
    report.date = ''
    const errors = getValidationErrors(report)
    expect(errors).toContainEqual({ step: 1, message: 'Date is required' })
  })

  it('returns step 1 error when shift is missing', () => {
    const report = makeValidReport()
    report.shift = null
    const errors = getValidationErrors(report)
    expect(errors).toContainEqual({ step: 1, message: 'Shift is required' })
  })

  it('returns step 1 error when start_time is missing', () => {
    const report = makeValidReport()
    report.start_time = ''
    const errors = getValidationErrors(report)
    expect(errors).toContainEqual({ step: 1, message: 'Start time is required' })
  })

  it('returns step 1 error when end_time is missing', () => {
    const report = makeValidReport()
    report.end_time = ''
    const errors = getValidationErrors(report)
    expect(errors).toContainEqual({ step: 1, message: 'End time is required' })
  })

  it('returns step 2 error when no machine has timing', () => {
    const report = makeValidReport()
    report.machines = [{ from_time: '', to_time: '' }]
    const errors = getValidationErrors(report)
    expect(errors).toContainEqual({ step: 2, message: 'Enter timing for at least one machine' })
  })

  it('does NOT return step 2 error when machines array is empty', () => {
    const report = makeValidReport()
    report.machines = []
    const errors = getValidationErrors(report)
    expect(errors.find(e => e.step === 2)).toBeUndefined()
  })

  it('returns step 4 error when no production entry has quantity > 0', () => {
    const report = makeValidReport()
    report.production = [{ quantity: '0' }]
    const errors = getValidationErrors(report)
    expect(errors).toContainEqual({ step: 4, message: 'Add at least one production entry' })
  })

  it('returns step 4 error when production is empty', () => {
    const report = makeValidReport()
    report.production = []
    const errors = getValidationErrors(report)
    expect(errors).toContainEqual({ step: 4, message: 'Add at least one production entry' })
  })

  it('returns step 4 error when production quantity exists but no mix usage is entered', () => {
    const report = makeValidReport()
    report.production = [{ quantity: '8', mix_usages: [] }]
    const errors = getValidationErrors(report)
    expect(errors).toContainEqual({ step: 4, message: 'Add mix usage for at least one production entry' })
  })

  it('does NOT return step 4 mix usage error when a produced entry has mix usage', () => {
    const report = makeValidReport()
    report.production = [
      { quantity: '0', mix_usages: [] },
      { quantity: '5', mix_usages: [{ quantity_kg: '12' }] },
    ]
    const errors = getValidationErrors(report)
    expect(errors.find(e => e.message === 'Add mix usage for at least one production entry')).toBeUndefined()
  })

  it('returns multiple errors when multiple steps are invalid', () => {
    const report = {
      date: '',
      shift: null,
      start_time: '',
      end_time: '',
      machines: [{ from_time: '', to_time: '' }],
      production: [],
      rawMaterials: [{ used: '0' }],
    }
    const errors = getValidationErrors(report)
    const steps = [...new Set(errors.map(e => e.step))]
    expect(steps).toContain(1)
    expect(steps).toContain(2)
    expect(steps).toContain(4)
  })
})
