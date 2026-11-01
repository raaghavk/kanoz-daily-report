import { describe, it, expect } from 'vitest'
import { applyDieselReceiptOcr } from '../dieselReceiptOcr'

const staleStock = {
  opening: 100,
  purchases: [
    { litres: '', cost_per_litre: '', purchase_time: '', receipt_url: null },
  ],
}

describe('applyDieselReceiptOcr', () => {
  it('keeps the uploaded receipt_url when merging onto a stale snapshot', () => {
    const next = applyDieselReceiptOcr(
      staleStock,
      0,
      { litres: 40, cost_per_litre: 92.5, time: '14:30' },
      'https://example.com/diesel.jpg',
    )
    expect(next.purchases[0].receipt_url).toBe('https://example.com/diesel.jpg')
    expect(next.purchases[0].litres).toBe(40)
    expect(next.purchases[0].cost_per_litre).toBe(92.5)
    expect(next.purchases[0].purchase_time).toBe('14:30')
  })

  it('does not overwrite an already-saved receipt_url', () => {
    const stock = {
      opening: 0,
      purchases: [{ litres: 10, cost_per_litre: 90, purchase_time: '', receipt_url: 'https://saved.jpg' }],
    }
    const next = applyDieselReceiptOcr(stock, 0, { litres: 12 }, 'https://newer.jpg')
    expect(next.purchases[0].receipt_url).toBe('https://saved.jpg')
    expect(next.purchases[0].litres).toBe(12)
  })

  it('closes tank stock from issued-to-equipment (added), not equipment used', () => {
    const next = applyDieselReceiptOcr(
      staleStock,
      0,
      { litres: 40 },
      'https://example.com/diesel.jpg',
      [{ added: 15, used: 80 }],
    )
    expect(next.purchased).toBe(40)
    expect(next.closing).toBe(125)
  })

  it('leaves sibling purchase rows intact', () => {
    const stock = {
      opening: 0,
      purchases: [
        { litres: 20, cost_per_litre: 90, purchase_time: '08:00', receipt_url: 'https://a.jpg' },
        { litres: '', cost_per_litre: '', purchase_time: '', receipt_url: null },
      ],
    }
    const next = applyDieselReceiptOcr(stock, 1, { litres: 5 }, 'https://b.jpg')
    expect(next.purchases[0]).toEqual(stock.purchases[0])
    expect(next.purchases[1].litres).toBe(5)
    expect(next.purchases[1].receipt_url).toBe('https://b.jpg')
  })
})
