/**
 * HH:MM for `<input type="time">`.
 * Postgres `time` comes back as HH:MM:SS; the default minute-step time input
 * treats a value with seconds as invalid and shows empty, so an edit-save
 * would write start/end and machine from/to times back as null.
 */
export function timeToInputValue(t) {
  if (t == null || t === '') return ''
  const s = String(t).trim()
  return s.length >= 5 ? s.slice(0, 5) : s
}

export function hydrateShiftTimesFromReport(report) {
  return {
    start_time: timeToInputValue(report?.start_time) || '08:00',
    end_time: timeToInputValue(report?.end_time) || '20:00',
  }
}

export function hydrateMachineTimesFromProd(prod) {
  return {
    from_time: timeToInputValue(prod?.from_time),
    to_time: timeToInputValue(prod?.to_time),
  }
}
