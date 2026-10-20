/**
 * Edit-load for equipment diesel logs.
 *
 * Active equipment is merged as before (untouched all-zero rows seed opening
 * from settings). Saved logs whose equipment is no longer active are retained
 * so replace_shift_report_children cannot wipe them — the same pattern as
 * inactive pellet types (#36).
 */
export function hydrateDieselForEdit(activeDiesel, savedLogs) {
  const rows = savedLogs || []
  const matched = new Set()

  const diesel = (activeDiesel || []).map(eq => {
    const dieselData = rows.find(d =>
      (d.equipment_id && eq.id && d.equipment_id === eq.id)
      || (!d.equipment_id && d.equipment_name === eq.equipment_name)
    )
    if (dieselData) matched.add(dieselData)
    const sOpen  = dieselData ? parseFloat(dieselData.opening_litres) || 0 : 0
    const sAdded = dieselData ? parseFloat(dieselData.added_litres) || 0 : 0
    const sClose = dieselData ? parseFloat(dieselData.closing_litres) || 0 : 0
    const sHours = dieselData ? parseFloat(dieselData.hours_worked) || 0 : 0
    const untouched = sOpen === 0 && sAdded === 0 && sClose === 0
    const opening = untouched ? (parseFloat(eq.opening_stock_litres) || 0) : sOpen
    const closing = untouched ? opening : sClose
    return {
      ...eq,
      opening,
      added: sAdded,
      used: opening + sAdded - closing,
      closing,
      hours: sHours,
    }
  })

  for (const d of rows) {
    if (matched.has(d)) continue
    const opening = parseFloat(d.opening_litres) || 0
    const added = parseFloat(d.added_litres) || 0
    const closing = parseFloat(d.closing_litres) || 0
    diesel.push({
      id: d.equipment_id || null,
      equipment_name: d.equipment_name || 'Unknown equipment',
      equipment_type: null,
      owner: null,
      company: null,
      identifier: null,
      opening_stock_litres: 0,
      opening,
      added,
      used: opening + added - closing,
      closing,
      hours: parseFloat(d.hours_worked) || 0,
      avg_per_hr: 0,
      collapsed: true,
    })
  }

  return diesel
}
