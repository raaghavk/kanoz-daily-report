/**
 * Get local date string in YYYY-MM-DD format.
 * IMPORTANT: Never use toISOString().split('T')[0] — that returns UTC date
 * which is wrong for IST (UTC+5:30). At 12:30 AM - 5:29 AM IST, UTC is still the previous day.
 */
export function getLocalDate(date) {
  const d = date || new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Get local time string in HH:MM format
 */
export function getLocalTime(date) {
  const d = date || new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Local calendar date `days` before today, as YYYY-MM-DD. */
export function getLocalDateDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return getLocalDate(d)
}

/** Local Date at today's calendar date plus `days` (negative = past). */
export function localDateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}
