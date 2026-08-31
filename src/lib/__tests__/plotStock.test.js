import { describe, it, expect } from 'vitest'
import { plotMaterialBalance, balancesByPlot } from '../plotStock'

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
