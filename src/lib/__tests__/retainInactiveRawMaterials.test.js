import { describe, it, expect } from 'vitest'
import { hydrateRawMaterialsForEdit } from '../retainInactiveRawMaterials'
import { buildShiftChildrenPayload } from '../shiftSavePayload'

const sawDust = {
  id: 'rm-sawdust',
  name: 'Saw Dust',
  gcv_kcal_kg: 3800,
  opening_stock_kg: 0,
  opening: 0,
  purchased: 0,
  used: 0,
  closing: 0,
}

const savedActive = {
  raw_material_type_id: 'rm-sawdust',
  quantity_kg: 500,
  opening_kg: 1200,
  purchased_kg: 0,
  closing_kg: 700,
  raw_material_types: { name: 'Saw Dust' },
}

const savedInactive = {
  raw_material_type_id: 'rm-wood-log',
  quantity_kg: 2000,
  opening_kg: 8000,
  purchased_kg: 0,
  closing_kg: 6000,
  raw_material_types: { name: 'Wood Log' },
}

describe('hydrateRawMaterialsForEdit', () => {
  it('merges saved usage onto active materials', () => {
    const rawMaterials = hydrateRawMaterialsForEdit([sawDust], [savedActive], [])
    expect(rawMaterials).toHaveLength(1)
    expect(rawMaterials[0]).toMatchObject({
      id: 'rm-sawdust',
      name: 'Saw Dust',
      opening: 1200,
      purchased: 0,
      used: 500,
      closing: 700,
    })
  })

  it('keeps a deactivated material so Update Report cannot drop its usage', () => {
    const rawMaterials = hydrateRawMaterialsForEdit([sawDust], [savedActive, savedInactive], [])
    expect(rawMaterials.map(rm => rm.id)).toEqual(['rm-sawdust', 'rm-wood-log'])
    expect(rawMaterials[1]).toMatchObject({
      name: 'Wood Log',
      opening: 8000,
      purchased: 0,
      used: 2000,
      closing: 6000,
    })
  })

  it('does not duplicate a material that is still active', () => {
    const rawMaterials = hydrateRawMaterialsForEdit([sawDust], [{
      ...savedActive,
      quantity_kg: 99,
      raw_material_types: { name: 'Should not replace' },
    }], [])
    expect(rawMaterials).toHaveLength(1)
    expect(rawMaterials[0].name).toBe('Saw Dust')
    expect(rawMaterials[0].used).toBe(99)
  })

  it('skips rows with no raw_material_type_id', () => {
    const rawMaterials = hydrateRawMaterialsForEdit([sawDust], [{ quantity_kg: 3 }])
    expect(rawMaterials.map(rm => rm.id)).toEqual(['rm-sawdust'])
  })

  it('recovers mix-only used by subtracting processing input, including inactive RM', () => {
    const processing = [{
      input_material_id: 'rm-wood-log',
      input_material: 'Wood Log',
      input_kg: 1500,
      output_material_id: 'rm-sawdust',
      output_material: 'Saw Dust',
      output_kg: 1200,
    }]
    const rawMaterials = hydrateRawMaterialsForEdit(
      [sawDust],
      [
        { ...savedActive, quantity_kg: 500, closing_kg: 1900 },
        { ...savedInactive, quantity_kg: 2000, closing_kg: 6000 },
      ],
      processing,
    )
    const byId = Object.fromEntries(rawMaterials.map(rm => [rm.id, rm]))
    // Saw Dust: mix used 500 (no proc input); Wood Log: 2000 total − 1500 proc = 500 mix
    expect(byId['rm-sawdust'].used).toBe(500)
    expect(byId['rm-wood-log'].used).toBe(500)
  })
})

describe('inactive raw material round-trip on save', () => {
  it('re-inserts the deactivated material usage (opening / purchased / used / closing)', () => {
    const rawMaterials = hydrateRawMaterialsForEdit([sawDust], [savedActive, savedInactive], [])
    const payload = buildShiftChildrenPayload({
      machines: [],
      production: [],
      mixes: [],
      rawMaterials,
      processing: [],
      diesel: [],
      pelletStock: [],
      issues: [],
      diesel_stock: {},
    }, { id: 'p1', org_id: 'o1' })

    const byId = Object.fromEntries(payload.raw_material_usage.map(r => [r.raw_material_type_id, r]))
    expect(byId['rm-wood-log']).toMatchObject({
      quantity_kg: 2000,
      opening_kg: 8000,
      purchased_kg: 0,
      closing_kg: 6000,
    })
    expect(byId['rm-sawdust']).toMatchObject({
      quantity_kg: 500,
      opening_kg: 1200,
      closing_kg: 700,
    })
  })
})
