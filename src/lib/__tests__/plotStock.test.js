import { describe, it, expect } from 'vitest'
import { plotMaterialBalance, balancesByPlot, plotLabel, plotsWithSaved } from '../plotStock'

describe('plotLabel', () => {
  it('returns empty string when plot or name is missing', () => {
    expect(plotLabel(null)).toBe('')
    expect(plotLabel({})).toBe('')
    expect(plotLabel({ is_primary: true })).toBe('')
  })

  it('appends (Main) for the primary plot and leaves others as the name', () => {
    expect(plotLabel({ name: 'Main factory land plot A', is_primary: true })).toBe('Main factory land plot A (Main)')
    expect(plotLabel({ name: 'Ravindra singh plot B', is_primary: false })).toBe('Ravindra singh plot B')
  })
})

describe('plotsWithSaved', () => {
  const main = { id: 'main', name: 'Main factory land plot A', is_primary: true, is_active: true }
  const plotB = { id: 'b', name: 'Ravindra singh plot B', is_primary: false, is_active: true }
  const archived = { id: 'old', name: 'Plot A', is_primary: false, is_active: false }

  it('keeps the saved plot in the list when it is no longer active', () => {
    expect(plotsWithSaved([main, plotB], archived).map(p => p.id)).toEqual(['main', 'b', 'old'])
  })

  it('does not duplicate a saved plot that is already in the active list', () => {
    expect(plotsWithSaved([main, plotB], plotB).map(p => p.id)).toEqual(['main', 'b'])
  })

  it('ignores a missing saved plot', () => {
    expect(plotsWithSaved([main], null)).toEqual([main])
    expect(plotsWithSaved(undefined, undefined)).toEqual([])
  })
})

describe('plotMaterialBalance', () => {
  it('credits purchases and inbound transfers, debits usage and outbound', () => {
    expect(plotMaterialBalance({
      opening: 1000,
      purchased: 200,
      transfersIn: 50,
      transfersOut: 80,
      produced: 10,
      used: 100,
    })).toBe(1080)
  })
})

describe('balancesByPlot', () => {
  const plots = [
    { id: 'main', name: 'Factory', is_primary: true, is_active: true },
    { id: 'far', name: '500m plot', is_primary: false, is_active: true },
  ]
  const materials = [{ id: 'bhusa', name: 'Bhusa', opening_stock_kg: 5000 }]

  it('puts historical opening and usage on the primary plot', () => {
    const out = balancesByPlot({
      plots,
      materials,
      purchases: [
        { plot_id: 'far', raw_material_type_id: 'bhusa', quantity_kg: 2000 },
      ],
      transfers: [
        { from_plot_id: 'far', to_plot_id: 'main', raw_material_type_id: 'bhusa', quantity_kg: 800 },
      ],
      usageByMaterial: { bhusa: 100 },
      producedByMaterial: {},
    })
    const main = out.find(x => x.plot.id === 'main')
    const far = out.find(x => x.plot.id === 'far')
    expect(main.rows[0].kg).toBe(5000 + 800 - 100)
    expect(far.rows[0].kg).toBe(2000 - 800)
  })
})
