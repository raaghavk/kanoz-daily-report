import { supabase } from './supabase'

// Re-sync a SAVED shift report's derived numbers without walking the wizard:
//  - raw-material `purchased` (re-windowed from the purchase ledger) + `closing`
//  - pellet `dispatch` (re-windowed from dispatches) + `opening` (closing_mt is DB-generated)
//  - raw-material / pellet / diesel `opening` carried from the shift immediately before this one
// User-entered fields are preserved: raw-material used (quantity_kg), pellet production/wastage,
// diesel added/used, machines and processing runs are untouched.
export async function resyncShiftReport(reportId) {
  const { data: r, error: rErr } = await supabase
    .from('shift_reports')
    .select('id, plant_id, shift_start_date, start_time, shift_end_date, end_time')
    .eq('id', reportId)
    .single()
  if (rErr || !r) throw new Error('Report not found')

  const norm5 = t => (t || '00:00').substring(0, 5)
  const shiftStart = new Date(`${r.shift_start_date}T${norm5(r.start_time)}:00`)
  const shiftEnd = new Date(`${r.shift_end_date || r.shift_start_date}T${norm5(r.end_time)}:00`)
  const inWindow = (dateStr, timeStr) => {
    if (!timeStr) return true // no timestamp -> keep (best effort)
    const dt = new Date(`${dateStr}T${timeStr}`)
    return dt >= shiftStart && dt < shiftEnd // start-inclusive, end-exclusive
  }

  // The shift immediately before this one (start strictly earlier); excludes this report.
  const { data: reps } = await supabase
    .from('shift_reports')
    .select('id, shift_start_date, start_time')
    .eq('plant_id', r.plant_id)
    .eq('is_deleted', false)
    .lte('shift_start_date', r.shift_start_date)
    .order('shift_start_date', { ascending: false })
    .order('start_time', { ascending: false })
  const prev = (reps || []).find(x =>
    new Date(`${x.shift_start_date}T${(x.start_time || '00:00:00').substring(0, 8)}`) < shiftStart)

  const norm = v => (v || '').toString().trim().toLowerCase()

  // ---------------- RAW MATERIAL ----------------
  const { data: rmRows } = await supabase
    .from('raw_material_usage')
    .select('id, raw_material_type_id, opening_kg, purchased_kg, quantity_kg')
    .eq('shift_report_id', reportId)

  // Map material name -> id (processing_runs stores material by name, not id).
  const { data: rmTypes } = await supabase
    .from('raw_material_types').select('id, name').eq('plant_id', r.plant_id)
  const idByName = {}
  for (const t of (rmTypes || [])) idByName[norm(t.name)] = t.id

  const { data: procRuns } = await supabase
    .from('processing_runs').select('output_material, output_kg').eq('shift_report_id', reportId)
  const producedById = {}
  for (const p of (procRuns || [])) {
    const id = idByName[norm(p.output_material)]
    if (id) producedById[id] = (producedById[id] || 0) + (parseFloat(p.output_kg) || 0)
  }

  let prevRmClose = null
  if (prev) {
    const { data: pr } = await supabase
      .from('raw_material_usage').select('raw_material_type_id, closing_kg').eq('shift_report_id', prev.id)
    prevRmClose = {}
    for (const x of (pr || [])) prevRmClose[x.raw_material_type_id] = parseFloat(x.closing_kg) || 0
  }

  const { data: purch } = await supabase
    .from('raw_material_purchases')
    .select('raw_material_type_id, quantity_kg, purchase_time, date')
    .eq('plant_id', r.plant_id).eq('is_deleted', false)
    .gte('date', r.shift_start_date).lte('date', r.shift_end_date || r.shift_start_date)
  const purchById = {}
  for (const p of (purch || [])) {
    if (!inWindow(p.date, p.purchase_time)) continue
    purchById[p.raw_material_type_id] = (purchById[p.raw_material_type_id] || 0) + (parseFloat(p.quantity_kg) || 0)
  }

  for (const row of (rmRows || [])) {
    const opening = prevRmClose ? (prevRmClose[row.raw_material_type_id] || 0) : (parseFloat(row.opening_kg) || 0)
    const purchased = Math.round(purchById[row.raw_material_type_id] || 0)
    const produced = producedById[row.raw_material_type_id] || 0
    const totalUsed = parseFloat(row.quantity_kg) || 0 // mix used + processing input (preserved)
    const closing = opening + purchased + produced - totalUsed
    await supabase.from('raw_material_usage')
      .update({ opening_kg: opening, purchased_kg: purchased, closing_kg: closing }).eq('id', row.id)
  }

  // ---------------- PELLET (closing_mt is DB-generated) ----------------
  const { data: psRows } = await supabase
    .from('pellet_stock').select('id, pellet_type_id, opening_mt').eq('shift_report_id', reportId)
  let prevPsClose = null
  if (prev) {
    const { data: pp } = await supabase
      .from('pellet_stock').select('pellet_type_id, closing_mt').eq('shift_report_id', prev.id)
    prevPsClose = {}
    for (const x of (pp || [])) prevPsClose[x.pellet_type_id] = parseFloat(x.closing_mt) || 0
  }
  const { data: disp } = await supabase
    .from('vehicle_dispatches')
    .select('date, dispatch_date, dispatch_time, dispatch_pellets(pellet_type_id, quantity_mt)')
    .eq('plant_id', r.plant_id).eq('is_deleted', false)
    .gte('date', r.shift_start_date).lte('date', r.shift_end_date || r.shift_start_date)
  const dispById = {}
  for (const d of (disp || [])) {
    const dd = d.dispatch_date || d.date
    if (!inWindow(dd, d.dispatch_time)) continue
    for (const p of (d.dispatch_pellets || [])) {
      if (p.pellet_type_id) dispById[p.pellet_type_id] = (dispById[p.pellet_type_id] || 0) + (parseFloat(p.quantity_mt) || 0)
    }
  }
  for (const row of (psRows || [])) {
    const opening = prevPsClose ? (prevPsClose[row.pellet_type_id] || 0) : (parseFloat(row.opening_mt) || 0)
    const dispatch = dispById[row.pellet_type_id] || 0
    await supabase.from('pellet_stock')
      .update({ opening_mt: opening, dispatch_mt: dispatch }).eq('id', row.id)
  }

  // ---------------- DIESEL (opening carries from prev; closing recomputed) ----------------
  if (prev) {
    const { data: dRows } = await supabase
      .from('equipment_diesel_log')
      .select('id, equipment_id, equipment_name, added_litres, used_litres').eq('shift_report_id', reportId)
    const { data: pd } = await supabase
      .from('equipment_diesel_log')
      .select('equipment_id, equipment_name, closing_litres').eq('shift_report_id', prev.id)
    const closeById = {}, closeByName = {}
    for (const x of (pd || [])) {
      const c = parseFloat(x.closing_litres) || 0
      if (x.equipment_id) closeById[x.equipment_id] = c
      else closeByName[norm(x.equipment_name)] = c
    }
    for (const row of (dRows || [])) {
      const hasId = row.equipment_id && row.equipment_id in closeById
      const nameKey = norm(row.equipment_name)
      if (!hasId && !(nameKey in closeByName)) continue
      const opening = hasId ? closeById[row.equipment_id] : closeByName[nameKey]
      const closing = opening + (parseFloat(row.added_litres) || 0) - (parseFloat(row.used_litres) || 0)
      await supabase.from('equipment_diesel_log')
        .update({ opening_litres: opening, closing_litres: closing }).eq('id', row.id)
    }
  }

  await supabase.from('shift_reports').update({ updated_at: new Date().toISOString() }).eq('id', reportId)
}
