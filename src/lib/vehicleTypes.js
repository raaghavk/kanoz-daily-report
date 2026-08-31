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
