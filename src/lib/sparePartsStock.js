/**
 * Plant min-stock lives on spare_parts_plant_config, not spare_parts.
 * Home / catalogue treat stock <= min as low (inclusive).
 */
export function shouldNotifyLowStock(stock, plantMin) {
  if (plantMin == null || plantMin === '') return false
  const min = Number(plantMin)
  if (Number.isNaN(min)) return false
  return Number(stock) <= min
}

export function plantMinByPartId(configRows) {
  const map = {}
  for (const row of configRows || []) {
    if (!row?.part_id) continue
    map[row.part_id] = Number(row.min_stock_level)
  }
  return map
}
