function norm5(t) {
  return (t || '00:00').substring(0, 5)
}

function toInstant(dateStr, timeStr) {
  return new Date(`${dateStr}T${norm5(timeStr || '00:00')}:00`)
}

/** True when instant falls in [shift_start, shift_end). */
export function reportContainsInstant(report, dateStr, timeStr) {
  if (!report?.shift_start_date || !dateStr) return false
  const shiftStart = toInstant(report.shift_start_date, report.start_time)
  const shiftEnd = toInstant(report.shift_end_date || report.shift_start_date, report.end_time)
  const dt = toInstant(dateStr, timeStr)
  return dt >= shiftStart && dt < shiftEnd
}

/**
 * Pick report ids to cascade-resync, oldest→newest.
 * reportsAsc must already be sorted by shift_start_date, start_time ascending.
 *
 * Start at the first report whose window contains the instant; if none,
 * start at the first report that begins at/after the instant.
 */
export function selectCascadeReportIds(reportsAsc, fromDate, fromTime) {
  const reports = reportsAsc || []
  if (!fromDate || reports.length === 0) return []

  let startIdx = reports.findIndex(r => reportContainsInstant(r, fromDate, fromTime))
  if (startIdx < 0) {
    const fromDt = toInstant(fromDate, fromTime)
    startIdx = reports.findIndex(r => toInstant(r.shift_start_date, r.start_time) >= fromDt)
  }
  if (startIdx < 0) return []
  return reports.slice(startIdx).map(r => r.id)
}

/** Prefer the earlier of two purchase datetimes (for edit: old vs new). */
export function earlierCascadePoint(a, b) {
  if (!a?.date) return b || null
  if (!b?.date) return a
  const aDt = toInstant(a.date, a.time)
  const bDt = toInstant(b.date, b.time)
  return aDt <= bDt ? { date: a.date, time: a.time || null } : { date: b.date, time: b.time || null }
}
