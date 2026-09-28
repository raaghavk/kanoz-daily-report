import { computeProcessingDeltas } from './processingDeltas'

/**
 * After merging saved raw_material_usage onto currently-active materials,
 * append unmatched saved rows so Update Report cannot drop opening /
 * purchased / used / closing for a material that has since been deactivated.
 *
 * Same failure mode as inactive pellet types (already retained in ShiftWizard):
 * replace_shift_report_children DELETEs every raw_material_usage row and
 * re-inserts the wizard payload.
 *
 * Saved quantity_kg is TOTAL consumed (mix + in-house processing input).
 * Recover mix-only `used` by subtracting this shift's processing input so
 * foldProcessingIntoRawMaterials stays idempotent.
 */
export function hydrateRawMaterialsForEdit(activeRawMaterials, savedUsage, processing) {
  const rows = savedUsage || []
  const knownIds = new Set()

  const merged = (activeRawMaterials || []).map(m => {
    knownIds.add(m.id)
    const rmData = rows.find(r => r.raw_material_type_id === m.id)
    return {
      ...m,
      opening: rmData ? parseFloat(rmData.opening_kg) || 0 : 0,
      purchased: rmData ? parseFloat(rmData.purchased_kg) || 0 : 0,
      _totalUsed: rmData ? parseFloat(rmData.quantity_kg) || 0 : 0,
      closing: rmData ? parseFloat(rmData.closing_kg) || 0 : 0,
    }
  })

  for (const r of rows) {
    if (!r.raw_material_type_id || knownIds.has(r.raw_material_type_id)) continue
    knownIds.add(r.raw_material_type_id)
    merged.push({
      id: r.raw_material_type_id,
      name: r.raw_material_types?.name || 'Unknown material',
      gcv_kcal_kg: null,
      opening_stock_kg: 0,
      opening: parseFloat(r.opening_kg) || 0,
      purchased: parseFloat(r.purchased_kg) || 0,
      _totalUsed: parseFloat(r.quantity_kg) || 0,
      closing: parseFloat(r.closing_kg) || 0,
    })
  }

  // Deltas must see the retained inactive rows so processing input/output
  // still lands on the right material after an RM type is deactivated.
  const procDeltas = computeProcessingDeltas(processing, merged)
  return merged.map(m => {
    const procUsed = (procDeltas[m.id] || {}).procUsed || 0
    const { _totalUsed, ...rest } = m
    return {
      ...rest,
      used: Math.max(0, (_totalUsed || 0) - procUsed),
    }
  })
}
