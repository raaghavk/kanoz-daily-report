// Compute per-material stock deltas from processing runs.
//  - output material gains `produced` kg
//  - input material is consumed -> added to `used`
// Matching is done by material id when the run stores one, else by name.
// A run now carries route-derived fields (input_material_id/name +
// output_material_id/name), but the delta logic is unchanged so chaining via
// intermediate materials falls out automatically: one route's output material
// gains `produced`, another route consuming it as input gains `procUsed`.
export function computeProcessingDeltas(processing, rawMaterials) {
  const producedById = {}
  const usedById = {}
  const producedByName = {}
  const usedByName = {}
  ;(processing || []).forEach(run => {
    const inKg = parseFloat(run.input_kg) || 0
    const outKg = parseFloat(run.output_kg) || 0
    if (run.input_material_id) usedById[run.input_material_id] = (usedById[run.input_material_id] || 0) + inKg
    else if (run.input_material) usedByName[run.input_material] = (usedByName[run.input_material] || 0) + inKg
    if (run.output_material_id) producedById[run.output_material_id] = (producedById[run.output_material_id] || 0) + outKg
    else if (run.output_material) producedByName[run.output_material] = (producedByName[run.output_material] || 0) + outKg
  })
  const perMaterial = {}
  ;(rawMaterials || []).forEach(rm => {
    const produced = (producedById[rm.id] || 0) + (producedByName[rm.name] || 0)
    const procUsed = (usedById[rm.id] || 0) + (usedByName[rm.name] || 0)
    perMaterial[rm.id] = { produced, procUsed }
  })
  return perMaterial
}

export function newProcessingRunId() {
  return 'proc_' + Date.now() + '_' + Math.random().toString(36).slice(2)
}
