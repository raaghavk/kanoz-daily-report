import { describe, it, expect } from 'vitest'
import { pelletStockNotes, rawMaterialStockNotes, isNegativeStock } from '../stockDisplay'

describe('isNegativeStock', () => {
  it('treats small rounding noise as zero and real negatives as negative', () => {
    expect(isNegativeStock(0)).toBe(false)
    expect(isNegativeStock(-0.0001)).toBe(false)
    expect(isNegativeStock(-7)).toBe(true)
  })
})

describe('pelletStockNotes', () => {
  it('does not hide a negative closing and explains a missing mix/recipe', () => {
    const notes = pelletStockNotes(
      { name: 'Cow Dung-Mustard Husk Pellet', mt: -7, recipe: null },
      ['Cow Dung Pellet'],
    )
    expect(notes[0]).toMatch(/not clamped/i)
    expect(notes.some(n => /no mix\/recipe/i.test(n))).toBe(true)
    expect(notes.join(' ')).not.toMatch(/clamped to 0/)
  })

  it('still shows the negative when a mix exists under a different name only', () => {
    const notes = pelletStockNotes(
      { name: 'Cow Dung-Mustard Husk Pellet', mt: -7, recipe: [{ material_name: 'Cow Dung', pct: 50 }] },
      ['Cow Dung Pellet'],
    )
    expect(notes[0]).toMatch(/Negative stock/)
    expect(notes.some(n => /not credited/i.test(n))).toBe(true)
  })

  it('does not warn on a non-negative pellet', () => {
    expect(pelletStockNotes({ name: 'A', mt: 3, recipe: [] }, [])).toEqual([])
  })
})

describe('rawMaterialStockNotes', () => {
  it('flags a negative kg balance without clamping', () => {
    const notes = rawMaterialStockNotes({ kg: -1200 })
    expect(notes[0]).toMatch(/not clamped/i)
  })
})
