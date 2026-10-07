import { describe, it, expect } from 'vitest'
import { sparePurchaseTotal, sumSparePurchaseTotals } from '../sparePurchase'

describe('sparePurchaseTotal', () => {
  it('prefers GST-inclusive grand_total over ex-GST total_amount', () => {
    expect(sparePurchaseTotal({ total_amount: 1000, grand_total: 1180, gst_percent: 18 })).toBe(1180)
  })

  it('falls back to total_amount when grand_total is missing', () => {
    expect(sparePurchaseTotal({ total_amount: 1000 })).toBe(1000)
    expect(sparePurchaseTotal({ total_amount: 1000, grand_total: null })).toBe(1000)
  })

  it('returns 0 for empty or zero rows', () => {
    expect(sparePurchaseTotal(null)).toBe(0)
    expect(sparePurchaseTotal({})).toBe(0)
    expect(sparePurchaseTotal({ total_amount: 0, grand_total: 0 })).toBe(0)
  })
})

describe('sumSparePurchaseTotals', () => {
  it('sums GST-inclusive spend for history Total Spend', () => {
    const records = [
      { total_amount: 1000, grand_total: 1180 },
      { total_amount: 500, grand_total: 590 },
    ]
    expect(sumSparePurchaseTotals(records)).toBe(1770)
  })
})
