import { describe, it, expect } from 'vitest'
import { deriveMixPellet, averagePellets, gradeForGcv } from '../pelletGrading'

const rawMaterials = [
  { id: 'rm-mustard', name: 'Mustard Husk', gcv_kcal_kg: 3400 },
  { id: 'rm-rice', name: 'Rice Husk', gcv_kcal_kg: 3000 },
  { id: 'rm-saw', name: 'Saw Dust', gcv_kcal_kg: null },
]

describe('deriveMixPellet', () => {
  it('names the pellet after the dominant ingredient by weight', () => {
    const result = deriveMixPellet(
      [
        { raw_material_type_id: 'rm-mustard', quantity_kg: 600 },
        { raw_material_type_id: 'rm-rice', quantity_kg: 400 },
      ],
      rawMaterials
    )
    expect(result.name).toBe('Mustard Husk Pellet')
  })

  it('computes kg-weighted average GCV', () => {
    const result = deriveMixPellet(
      [
        { raw_material_type_id: 'rm-mustard', quantity_kg: 600 },
        { raw_material_type_id: 'rm-rice', quantity_kg: 400 },
      ],
      rawMaterials
    )
    // (3400*600 + 3000*400) / 1000 = 3240
    expect(result.gcv).toBeCloseTo(3240)
  })

  it('grades High GCV at or above the threshold', () => {
    const result = deriveMixPellet(
      [{ raw_material_type_id: 'rm-mustard', quantity_kg: 500 }],
      rawMaterials,
      3400
    )
    expect(result.gcv).toBe(3400)
    expect(result.grade).toBe('High GCV')
  })

  it('grades Low GCV below the threshold', () => {
    const result = deriveMixPellet(
      [{ raw_material_type_id: 'rm-rice', quantity_kg: 500 }],
      rawMaterials,
      3200
    )
    expect(result.grade).toBe('Low GCV')
  })

  it('excludes ingredients without a configured GCV from the average', () => {
    const result = deriveMixPellet(
      [
        { raw_material_type_id: 'rm-mustard', quantity_kg: 300 },
        { raw_material_type_id: 'rm-saw', quantity_kg: 700 },
      ],
      rawMaterials
    )
    // Saw Dust dominates the name, but only Mustard contributes GCV
    expect(result.name).toBe('Saw Dust Pellet')
    expect(result.gcv).toBe(3400)
  })

  it('returns null GCV and grade when no ingredient has a GCV', () => {
    const result = deriveMixPellet(
      [{ raw_material_type_id: 'rm-saw', quantity_kg: 500 }],
      rawMaterials
    )
    expect(result.name).toBe('Saw Dust Pellet')
    expect(result.gcv).toBeNull()
    expect(result.grade).toBeNull()
  })

  it('returns all-null for empty or invalid ingredients', () => {
    expect(deriveMixPellet([], rawMaterials)).toEqual({ name: null, gcv: null, grade: null })
    expect(deriveMixPellet(null, rawMaterials)).toEqual({ name: null, gcv: null, grade: null })
    expect(deriveMixPellet([{ raw_material_type_id: '', quantity_kg: 100 }], rawMaterials))
      .toEqual({ name: null, gcv: null, grade: null })
    expect(deriveMixPellet([{ raw_material_type_id: 'rm-rice', quantity_kg: 0 }], rawMaterials))
      .toEqual({ name: null, gcv: null, grade: null })
  })

  it('falls back to the ingredient name when the RM is not found', () => {
    const result = deriveMixPellet(
      [{ raw_material_type_id: 'rm-unknown', name: 'Ground Nut', quantity_kg: 100 }],
      rawMaterials
    )
    expect(result.name).toBe('Ground Nut Pellet')
    expect(result.gcv).toBeNull()
  })

  it('uses the default threshold of 3200 when none is provided', () => {
    const high = deriveMixPellet([{ raw_material_type_id: 'rm-mustard', quantity_kg: 100 }], rawMaterials)
    const low = deriveMixPellet([{ raw_material_type_id: 'rm-rice', quantity_kg: 100 }], rawMaterials)
    expect(high.grade).toBe('High GCV')
    expect(low.grade).toBe('Low GCV')
  })

  it('parses string quantities', () => {
    const result = deriveMixPellet(
      [
        { raw_material_type_id: 'rm-mustard', quantity_kg: '600' },
        { raw_material_type_id: 'rm-rice', quantity_kg: '400' },
      ],
      rawMaterials
    )
    expect(result.name).toBe('Mustard Husk Pellet')
    expect(result.gcv).toBeCloseTo(3240)
  })
})

describe('averagePellets', () => {
  it('weight-averages GCV by kg', () => {
    const result = averagePellets([
      { name: 'Mustard Husk Pellet', gcv: 3400, kg: 1000 },
      { name: 'Mustard Husk Pellet', gcv: 3000, kg: 3000 },
    ])
    // (3400*1000 + 3000*3000) / 4000 = 3100
    expect(result.gcv).toBeCloseTo(3100)
    expect(result.name).toBe('Mustard Husk Pellet')
    expect(result.kg).toBe(4000)
  })

  it('ignores entries without GCV in the average but keeps their kg in the total', () => {
    const result = averagePellets([
      { name: 'Mustard Husk Pellet', gcv: 3400, kg: 1000 },
      { name: 'Mustard Husk Pellet', gcv: null, kg: 500 },
    ])
    expect(result.gcv).toBe(3400)
    expect(result.kg).toBe(1500)
  })

  it('returns null GCV when no entry has one', () => {
    const result = averagePellets([
      { name: 'Saw Dust Pellet', gcv: null, kg: 200 },
      { name: 'Saw Dust Pellet', gcv: null, kg: 300 },
    ])
    expect(result.gcv).toBeNull()
    expect(result.kg).toBe(500)
  })

  it('falls back to a simple average when all weights are zero', () => {
    const result = averagePellets([
      { name: 'Mustard Husk Pellet', gcv: 3400, kg: 0 },
      { name: 'Mustard Husk Pellet', gcv: 3000, kg: 0 },
    ])
    expect(result.gcv).toBeCloseTo(3200)
  })

  it('returns null for empty input', () => {
    expect(averagePellets([])).toBeNull()
    expect(averagePellets(null)).toBeNull()
  })

  it('handles a single entry', () => {
    const result = averagePellets([{ name: 'Rice Husk Pellet', gcv: 3000, kg: 750 }])
    expect(result).toEqual({ name: 'Rice Husk Pellet', gcv: 3000, kg: 750 })
  })
})

describe('gradeForGcv', () => {
  it('grades at the boundary as High GCV', () => {
    expect(gradeForGcv(3200, 3200)).toBe('High GCV')
  })

  it('grades below the threshold as Low GCV', () => {
    expect(gradeForGcv(3199.9, 3200)).toBe('Low GCV')
  })

  it('returns null for missing GCV', () => {
    expect(gradeForGcv(null)).toBeNull()
    expect(gradeForGcv(undefined)).toBeNull()
    expect(gradeForGcv('abc')).toBeNull()
  })

  it('falls back to the default threshold when the threshold is invalid', () => {
    expect(gradeForGcv(3300, 'not-a-number')).toBe('High GCV')
    expect(gradeForGcv(3100, null)).toBe('Low GCV')
  })
})
