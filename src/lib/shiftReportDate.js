/** Canonical shift-report `date` used by the unique index and save payload. */
export function canonicalReportDate(data) {
  return data?.shift_end_date || data?.shift_start_date || data?.date || ''
}

export function isDispatchInShiftWindow(dispatch, shiftStart, shiftEnd) {
  const dDate = dispatch.dispatch_date || dispatch.date
  const dTime = dispatch.dispatch_time || '00:00:00'
  const dt = new Date(`${dDate}T${dTime}`)
  // Start-inclusive, end-exclusive so an 8:00 handover counts for exactly one shift.
  return dt >= new Date(shiftStart) && dt < new Date(shiftEnd)
}
