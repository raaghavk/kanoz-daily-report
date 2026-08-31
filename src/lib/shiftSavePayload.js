import { sanitizeNumber, sanitizeText } from './sanitize'
import { computeProcessingDeltas } from './processingDeltas'

export function buildShiftChildrenPayload(reportData, plant) {
  const derivePelletType = (machineId) => {
    const mixName = (mix) => (mix?.derived_pellet_name || mix?.type || mix?.name || '').trim()
    const kgByName = {}
    ;(reportData.production || []).filter(p => p.machine_id === machineId).forEach(p => {
      ;(p.mix_usages || []).forEach(u => {
        const mix = (reportData.mixes || []).find(m => m.local_id === u.mix_local_id)
        const name = mixName(mix)
        if (name) kgByName[name] = (kgByName[name] || 0) + (sanitizeNumber(u.quantity_kg) || 0)
      })
    })
    const names = Object.keys(kgByName)
    if (names.length === 0) return mixName((reportData.mixes || []).find(m => mixName(m))) || null
    return names.reduce((a, b) => (kgByName[b] > kgByName[a] ? b : a))
  }

  const machine_production = (reportData.machines || [])
    .filter(m => m.did_not_run || sanitizeNumber(m.production_hours) > 0 || sanitizeNumber(m.total_hours) > 0 || m.from_time || m.to_time)
    .map(m => ({
      machine_id: m.id,
      did_not_run: m.did_not_run || false,
      hours_run: sanitizeNumber(m.production_hours) || sanitizeNumber(m.total_hours),
      from_time: m.from_time || null,
      to_time: m.to_time || null,
      total_hours: sanitizeNumber(m.total_hours) || null,
      breakdown_hours: sanitizeNumber(m.breakdown_hrs) || 0,
      remarks: sanitizeText(m.remarks, 500),
      production_mt: (reportData.production || []).filter(p => p.machine_id === m.id).reduce((sum, p) => sum + sanitizeNumber(p.quantity), 0),
      pellet_type_name: derivePelletType(m.id),
    }))

  const mixes = (reportData.mixes || []).map(mix => {
    const computedUsedKg = (reportData.production || []).reduce((sum, p) =>
      sum + (p.mix_usages || []).filter(u => u.mix_local_id === mix.local_id).reduce((s, u) => s + sanitizeNumber(u.quantity_kg), 0), 0)
    const usedKg = (mix.used_kg !== undefined && mix.used_kg !== null) ? sanitizeNumber(mix.used_kg) : computedUsedKg
    const closingKg = (sanitizeNumber(mix.opening_kg) + sanitizeNumber(mix.prepared_kg)) - usedKg
    const machine_usages = []
    ;(reportData.production || []).forEach(p => {
      ;(p.mix_usages || []).filter(u => u.mix_local_id === mix.local_id && sanitizeNumber(u.quantity_kg) > 0).forEach(u => {
        machine_usages.push({ machine_id: p.machine_id, quantity_kg: sanitizeNumber(u.quantity_kg) })
      })
    })
    return {
      plant_id: plant.id,
      org_id: plant.org_id,
      name: sanitizeText(mix.name, 100),
      type: sanitizeText(mix.type, 50),
      opening_kg: sanitizeNumber(mix.opening_kg),
      prepared_kg: sanitizeNumber(mix.prepared_kg),
      used_kg: usedKg,
      closing_kg: closingKg,
      derived_pellet_name: sanitizeText(mix.derived_pellet_name || mix.type, 100) || null,
      derived_gcv: mix.derived_gcv != null ? sanitizeNumber(mix.derived_gcv) : null,
      derived_grade: sanitizeText(mix.derived_grade, 20) || null,
      compositions: (mix.ingredients || [])
        .filter(ing => ing.raw_material_type_id && sanitizeNumber(ing.quantity_kg) > 0)
        .map(ing => ({
          raw_material_type_id: ing.raw_material_type_id,
          raw_material_name: sanitizeText(ing.name, 100),
          quantity_kg: sanitizeNumber(ing.quantity_kg),
        })),
      machine_usages,
    }
  })

  const procDeltasSave = computeProcessingDeltas(reportData.processing, reportData.rawMaterials)
  const raw_material_usage = (reportData.rawMaterials || []).map(rm => {
    const d = procDeltasSave[rm.id] || { produced: 0, procUsed: 0 }
    const opening = sanitizeNumber(rm.opening)
    const purchased = sanitizeNumber(rm.purchased)
    const mixUsed = sanitizeNumber(rm.used)
    const totalUsed = mixUsed + (d.procUsed || 0)
    const closing = opening + purchased + (d.produced || 0) - totalUsed
    return {
      raw_material_type_id: rm.id,
      quantity_kg: totalUsed,
      opening_kg: opening,
      purchased_kg: purchased,
      closing_kg: closing,
    }
  })

  const processing_runs = (reportData.processing || [])
    .filter(r => sanitizeNumber(r.input_kg) > 0 || sanitizeNumber(r.output_kg) > 0)
    .map(r => {
      const inKg = sanitizeNumber(r.input_kg)
      const outKg = sanitizeNumber(r.output_kg)
      const machineHours = {}
      Object.entries(r.machine_hours || {}).forEach(([mid, hrs]) => {
        if (!mid) return
        const n = sanitizeNumber(hrs)
        if (n > 0) machineHours[mid] = n
      })
      return {
        plant_id: plant.id,
        org_id: plant.org_id,
        route_id: r.route_id || null,
        input_material: sanitizeText(r.input_material, 100),
        input_kg: inKg,
        output_material: sanitizeText(r.output_material, 100),
        output_kg: outKg,
        yield_pct: inKg > 0 ? Math.round((outKg / inKg) * 10000) / 100 : null,
        machine_hours: machineHours,
        note: sanitizeText(r.note, 500) || null,
      }
    })

  const equipment_diesel_log = (reportData.diesel || []).map(d => {
    const openL = sanitizeNumber(d.opening)
    const addedL = sanitizeNumber(d.added)
    const usedL = sanitizeNumber(d.used)
    return {
      equipment_id: d.id || null,
      equipment_name: sanitizeText(d.equipment_name, 100),
      opening_litres: openL,
      added_litres: addedL,
      used_litres: usedL,
      closing_litres: openL + addedL - usedL,
      hours_worked: sanitizeNumber(d.hours),
    }
  })

  const pellet_stock = (reportData.pelletStock || []).map(ps => ({
    pellet_type_id: ps.id,
    opening_mt: sanitizeNumber(ps.opening),
    production_mt: sanitizeNumber(ps.production),
    dispatch_mt: sanitizeNumber(ps.dispatch),
    wastage_mt: sanitizeNumber(ps.wastage),
    adjustment_mt: sanitizeNumber(ps.adjustment),
    adjustment_note: sanitizeText(ps.adjustment_note, 200) || null,
  }))

  const issues = (reportData.issues || []).map(i => ({
    issue_type: sanitizeText(i.type, 50),
    description: sanitizeText(i.description, 1000),
    severity: sanitizeText(i.severity, 20),
    photo_url: i.photo_url,
  }))

  const ds = reportData.diesel_stock || {}
  const purchases = ds.purchases || []
  const totalAddedToEquipment = (reportData.diesel || []).reduce((sum, eq) => sum + sanitizeNumber(eq.added), 0)
  const totalPurchased = purchases.reduce((sum, p) => sum + sanitizeNumber(p.litres), 0)
  const totalCost = purchases.reduce((sum, p) => sum + (sanitizeNumber(p.litres) * sanitizeNumber(p.cost_per_litre)), 0)
  const dsOpening = sanitizeNumber(ds.opening)

  return {
    machine_production,
    mixes,
    raw_material_usage,
    processing_runs,
    equipment_diesel_log,
    pellet_stock,
    issues,
    diesel_stock: {
      opening_litres: dsOpening,
      purchased_litres: totalPurchased,
      purchase_cost: totalCost,
      used_litres: totalAddedToEquipment,
      closing_litres: dsOpening + totalPurchased - totalAddedToEquipment,
    },
    diesel_purchases: purchases.filter(p => sanitizeNumber(p.litres) > 0).map(p => ({
      litres: sanitizeNumber(p.litres),
      cost_per_litre: sanitizeNumber(p.cost_per_litre),
      total_cost: sanitizeNumber(p.litres) * sanitizeNumber(p.cost_per_litre),
      receipt_url: p.receipt_url || null,
      purchase_time: p.purchase_time || null,
    })),
  }
}
