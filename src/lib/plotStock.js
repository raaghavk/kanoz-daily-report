const num = v => Number(v) || 0

export function plotMaterialBalance({
  opening = 0,
  purchased = 0,
  transfersIn = 0,
  transfersOut = 0,
  produced = 0,
  used = 0,
}) {
  return num(opening) + num(purchased) + num(transfersIn) + num(produced) - num(transfersOut) - num(used)
}

/**
 * Split plant-level RM stock across plots.
 * Existing opening + usage + in-house production live on the primary (factory) plot.
 * Purchases credit the plot they were unloaded at. Transfers move kg between plots.
 */
export function balancesByPlot({ plots, materials, purchases, transfers, usageByMaterial, producedByMaterial }) {
  const primary = (plots || []).find(p => p.is_primary && p.is_active !== false) || (plots || [])[0]
  const result = []
  for (const plot of (plots || []).filter(p => p.is_active !== false)) {
    const rows = (materials || []).map(m => {
      const purchased = (purchases || [])
        .filter(p => (p.plot_id ? p.plot_id === plot.id : primary && plot.id === primary.id)
          && (p.raw_material_type_id === m.id || (!p.raw_material_type_id && p.raw_material_type === m.name)))
        .reduce((s, p) => s + num(p.quantity_kg), 0)
      const transfersIn = (transfers || [])
        .filter(t => t.to_plot_id === plot.id && (t.raw_material_type_id === m.id || t.raw_material_name === m.name))
        .reduce((s, t) => s + num(t.quantity_kg), 0)
      const transfersOut = (transfers || [])
        .filter(t => t.from_plot_id === plot.id && (t.raw_material_type_id === m.id || t.raw_material_name === m.name))
        .reduce((s, t) => s + num(t.quantity_kg), 0)
      const isPrimary = primary && plot.id === primary.id
      const opening = isPrimary ? num(m.opening_stock_kg) : 0
      const used = isPrimary ? num(usageByMaterial?.[m.id]) : 0
      const produced = isPrimary ? num(producedByMaterial?.[m.id]) : 0
      return {
        materialId: m.id,
        name: m.name,
        kg: plotMaterialBalance({ opening, purchased, transfersIn, transfersOut, produced, used }),
      }
    }).filter(r => Math.abs(r.kg) > 0.001 || r.kg !== 0)
    result.push({ plot, rows, totalKg: rows.reduce((s, r) => s + r.kg, 0) })
  }
  return result
}
