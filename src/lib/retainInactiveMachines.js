/**
 * After merging saved machine_production onto currently-active machines,
 * append unmatched saved rows so Update Report cannot drop hours / timings /
 * production_mt for a machine that has since been deactivated.
 *
 * Same failure mode as inactive pellet types (already retained in ShiftWizard):
 * replace_shift_report_children DELETEs every machine_production row and
 * re-inserts the wizard payload.
 */

function mapSavedMachine(mp) {
  return {
    id: mp.machine_id,
    name: mp.machines?.name || 'Unknown machine',
    machine_type: mp.machines?.machine_type ?? null,
    did_not_run: mp.did_not_run || false,
    production_hours: parseFloat(mp.hours_run) || 0,
    total_hours: parseFloat(mp.total_hours) || parseFloat(mp.hours_run) || 0,
    from_time: mp.from_time || '',
    to_time: mp.to_time || '',
    breakdown_hrs: parseFloat(mp.breakdown_hours) || 0,
    remarks: mp.remarks || '',
  }
}

export function appendInactiveMachines(mergedActive, savedRows) {
  const knownIds = new Set((mergedActive || []).map(m => m.id))
  const extra = []
  for (const mp of savedRows || []) {
    if (!mp.machine_id || knownIds.has(mp.machine_id)) continue
    extra.push(mapSavedMachine(mp))
    knownIds.add(mp.machine_id)
  }
  return extra.length ? [...(mergedActive || []), ...extra] : (mergedActive || [])
}
