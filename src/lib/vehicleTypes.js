export const VEHICLE_TYPES = ['Tractor', 'Truck', 'Hywa', 'Pickup', 'Trolley', 'Mini Truck', 'Three Wheeler', 'Other']

export function vehicleSummary(vehicles) {
  const active = (vehicles || []).filter(v => v && v.is_active !== false)
  if (!active.length) return ''
  if (active.length === 1) {
    return [active[0].vehicle_type, active[0].vehicle_number].filter(Boolean).join(' · ')
  }
  const plates = active.map(v => v.vehicle_number).filter(Boolean)
  return `${active.length} vehicles · ${plates.join(', ')}`
}

export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/^\+91/, '').replace(/\D/g, '')
  if (!digits) return ''
  return '+91' + digits
}

/** Digits of an Indian mobile: optional +91 / 91 prefix, then 10 digits. */
export function indianMobileDigits(raw) {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2)
  return digits
}

export function isValidIndianMobile(raw) {
  return /^\d{10}$/.test(indianMobileDigits(raw))
}

export function normalizeIndianMobile(raw) {
  const digits = indianMobileDigits(raw)
  if (!/^\d{10}$/.test(digits)) return ''
  return '+91' + digits
}
