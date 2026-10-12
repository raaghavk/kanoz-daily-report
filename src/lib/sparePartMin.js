/**
 * Min stock for the operator's current plant lives on spare_parts_plant_config
 * (joined into plantStock[].min). spare_parts.min_stock_level is unused by
 * Stock In, Home, the catalogue, and the dashboard.
 */
export function currentPlantMin(plantStock, plantId) {
  if (!plantId) return null
  const row = (plantStock || []).find(ps => ps.id === plantId)
  if (!row || row.min == null || row.min === '') return null
  return row.min
}

export function formatMinLevel(min) {
  if (min == null || min === '') return '—'
  return String(min)
}
