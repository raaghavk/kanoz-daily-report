import { describe, it, expect } from 'vitest'
import { hydrateDieselForEdit } from '../retainInactiveDiesel'
import { buildShiftChildrenPayload } from '../shiftSavePayload'

const loader = { id: 'eq-loader', equipment_name: 'Loader', opening_stock_litres: 40 }
const gen = { id: 'eq-gen', equipment_name: 'Generator', opening_stock_litres: 100 }

describe('hydrateDieselForEdit', () => {
  it('merges saved litres onto active equipment', () => {
    const diesel = hydrateDieselForEdit([loader], [{
      equipment_id: 'eq-loader',
      equipment_name: 'Loader',
      opening_litres: 40,
      added_litres: 20,
      used_litres: 15,
      closing_litres: 45,
      hours_worked: 5,
    }])
    expect(diesel).toHaveLength(1)
    expect(diesel[0]).toMatchObject({
      id: 'eq-loader',
      opening: 40,
      added: 20,
      used: 15,
      closing: 45,
      hours: 5,
    })
  })

  it('seeds opening from settings when the saved row is all zeros', () => {
    const diesel = hydrateDieselForEdit([gen], [{
      equipment_id: 'eq-gen',
      equipment_name: 'Generator',
      opening_litres: 0,
      added_litres: 0,
      closing_litres: 0,
      hours_worked: 0,
    }])
    expect(diesel[0].opening).toBe(100)
    expect(diesel[0].closing).toBe(100)
    expect(diesel[0].used).toBe(0)
  })

  it('keeps deactivated equipment so an edit-save cannot wipe its log', () => {
    const saved = [
      {
        equipment_id: 'eq-loader',
        equipment_name: 'Loader',
        opening_litres: 10,
        added_litres: 50,
        used_litres: 30,
        closing_litres: 30,
        hours_worked: 4,
      },
      {
        equipment_id: 'eq-old-genset',
        equipment_name: 'Old Genset',
        opening_litres: 80,
        added_litres: 40,
        used_litres: 25,
        closing_litres: 95,
        hours_worked: 6,
      },
    ]
    const diesel = hydrateDieselForEdit([loader], saved)
    expect(diesel.map(d => d.id)).toEqual(['eq-loader', 'eq-old-genset'])
    expect(diesel[1]).toMatchObject({
      equipment_name: 'Old Genset',
      opening: 80,
      added: 40,
      used: 25,
      closing: 95,
      hours: 6,
    })

    const payload = buildShiftChildrenPayload({
      machines: [],
      production: [],
      mixes: [],
      rawMaterials: [],
      processing: [],
      diesel,
      pelletStock: [],
      issues: [],
      diesel_stock: { opening: 200, purchases: [] },
    }, { id: 'p1', org_id: 'o1' })

    expect(payload.equipment_diesel_log).toHaveLength(2)
    expect(payload.equipment_diesel_log.find(r => r.equipment_id === 'eq-old-genset')).toMatchObject({
      equipment_name: 'Old Genset',
      added_litres: 40,
      used_litres: 25,
      closing_litres: 95,
    })
    // Tank issued = sum of equipment `added`, including the deactivated unit.
    expect(payload.diesel_stock.used_litres).toBe(90)
  })

  it('does not duplicate a name-only saved row that already matched an active unit', () => {
    const diesel = hydrateDieselForEdit([loader], [{
      equipment_id: null,
      equipment_name: 'Loader',
      opening_litres: 12,
      added_litres: 0,
      closing_litres: 12,
      hours_worked: 0,
    }])
    expect(diesel).toHaveLength(1)
    expect(diesel[0].opening).toBe(12)
  })
})
