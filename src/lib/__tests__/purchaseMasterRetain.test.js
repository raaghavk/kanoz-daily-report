import { describe, it, expect } from 'vitest'
import { purchaseMasterName, inactiveMasterOption } from '../purchaseMasterRetain'

const activeRm = [{ id: 'rm-live', name: 'Saw Dust' }]
const activeSuppliers = [{ id: 'sup-live', name: 'Ram Singh' }]

describe('purchaseMasterName', () => {
  it('uses the live master name when the id is still active', () => {
    expect(purchaseMasterName('rm-live', activeRm, 'Old Label')).toBe('Saw Dust')
    expect(purchaseMasterName('sup-live', activeSuppliers, 'Old Co')).toBe('Ram Singh')
  })

  it('keeps the saved name when the type/supplier was deactivated', () => {
    expect(purchaseMasterName('rm-old', activeRm, 'Wood Log (retired)')).toBe('Wood Log (retired)')
    expect(purchaseMasterName('sup-old', activeSuppliers, 'Old Yard')).toBe('Old Yard')
  })

  it('does not write an empty string over a saved name when the list has no match', () => {
    expect(purchaseMasterName('rm-old', activeRm, 'Bhusa')).not.toBe('')
    expect(purchaseMasterName('rm-old', [], 'Bhusa')).toBe('Bhusa')
  })

  it('returns empty when there is no id and no saved name (new blank form)', () => {
    expect(purchaseMasterName('', activeRm, '')).toBe('')
    expect(purchaseMasterName(null, activeRm, null)).toBe('')
  })
})

describe('inactiveMasterOption', () => {
  it('is null when the selected id is already in the active list', () => {
    expect(inactiveMasterOption('rm-live', activeRm, 'Saw Dust', 'type')).toBeNull()
  })

  it('returns a retain option labeled inactive when the id is missing from the list', () => {
    expect(inactiveMasterOption('rm-old', activeRm, 'Wood Log', 'type')).toEqual({
      id: 'rm-old',
      label: 'Wood Log (inactive)',
    })
    expect(inactiveMasterOption('sup-old', activeSuppliers, null, 'supplier')).toEqual({
      id: 'sup-old',
      label: 'Inactive supplier',
    })
  })
})
