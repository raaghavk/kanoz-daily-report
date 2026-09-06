/**
 * Weighbridge parchi numbers are often typed or OCR'd with leading zeros
 * (025194 vs 25194). Uniqueness is per plant on the canonical form.
 *
 * Rule: trim whitespace. Digit-only values drop leading zeros
 * (all-zeros become "0"). Mixed alphanumeric values are trimmed only —
 * "A001" stays "A001".
 */
export function normalizePurchaseSerial(raw) {
  if (raw == null) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''
  if (/^[0-9]+$/.test(trimmed)) {
    return trimmed.replace(/^0+/, '') || '0'
  }
  return trimmed
}

/** Postgres unique_violation on the per-plant live-serial index. */
export function isPurchaseSerialUniqueViolation(error) {
  if (!error) return false
  if (error.code === '23505') {
    const blob = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`
    return /raw_material_purchases_plant_serial/i.test(blob) || /serial_no/i.test(blob)
  }
  return false
}
