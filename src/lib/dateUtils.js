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
