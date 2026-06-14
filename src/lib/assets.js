// Asset lifecycle helpers — event-sourced model.
// Source of truth = asset_events; assets.status/current_location are cached for fast lists.

export const ASSET_TYPES = ['Motor', 'Gearbox', 'Pump', 'Fan', 'Conveyor', 'Die', 'Other']
export const WORK_TYPES = ['Rewinding', 'Bearing replacement', 'Seal / oil change', 'Mechanical repair', 'Electrical repair', 'Other']
export const CODE_PREFIX = { Motor: 'MTR', Gearbox: 'GBX', Pump: 'PMP', Fan: 'FAN', Conveyor: 'CNV', Die: 'DIE' }

export const STATUS = {
  running:   { label: 'Running',   color: '#15803d', bg: '#dcfce7' },
  in_store:  { label: 'In Store',  color: '#475569', bg: '#e2e8f0' },
  in_repair: { label: 'At Repair', color: '#b45309', bg: '#fef3c7' },
  scrapped:  { label: 'Scrapped',  color: '#b91c1c', bg: '#fee2e2' },
}

export const EVENT_TYPES = {
  purchased:   { label: 'Purchased',           emoji: '🛒', color: '#15803d' },
  installed:   { label: 'Installed',           emoji: '🔧', color: '#2563eb' },
  removed:     { label: 'Removed',             emoji: '⏏️', color: '#64748b' },
  sent_vendor: { label: 'Sent for Repair',     emoji: '🚚', color: '#d97706' },
  returned:    { label: 'Returned (Repaired)', emoji: '📦', color: '#7c3aed' },
  repaired:    { label: 'Repaired in-house',   emoji: '🛠️', color: '#7c3aed' },
  moved_store: { label: 'Moved to Store',      emoji: '🏬', color: '#475569' },
  scrapped:    { label: 'Scrapped',            emoji: '🗑️', color: '#b91c1c' },
}

const isWork = e => (e.event_type === 'returned' && Number(e.cost)) || e.event_type === 'repaired'

// events ordered oldest-first
export function summarise(events) {
  const repairs = (events || []).filter(isWork).length
  const spend = (events || []).filter(isWork).reduce((s, e) => s + (Number(e.cost) || 0), 0)
  const lifetime = (events || []).reduce((s, e) => s + (Number(e.cost) || 0), 0)
  const purchase = (events || []).find(e => e.event_type === 'purchased')
  return { repairs, spend, lifetime, purchaseDate: purchase ? purchase.event_date : null }
}

// Given an event, return the cached state to write back onto the asset row.
export function cacheForEvent(type, { location, machineId } = {}) {
  switch (type) {
    case 'installed':   return { status: 'running',   current_location: location || null, current_machine_id: machineId || null }
    case 'removed':     return { status: 'in_repair',  current_location: location || null, current_machine_id: null }
    case 'sent_vendor': return { status: 'in_repair',  current_location: location || null, current_machine_id: null }
    case 'returned':    return { status: 'in_store',   current_location: location || 'Store', current_machine_id: null }
    case 'moved_store': return { status: 'in_store',   current_location: location || 'Store', current_machine_id: null }
    case 'purchased':   return { status: 'in_store',   current_location: location || 'Main Store', current_machine_id: null }
    case 'scrapped':    return { status: 'scrapped',   current_location: 'Scrap Yard', current_machine_id: null }
    case 'repaired':    return {} // in-house fix: no location/status change
    default:            return {}
  }
}

export const COST_ROLES = ['admin', 'plant_manager', 'accountant']
export const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN')

// Recompute cached status/location from the full ordered event list (used after edit/undo).
export function deriveCacheFromLatest(events) {
  if (!events || !events.length) return { status: 'in_store', current_location: 'Main Store', current_machine_id: null }
  const last = events[events.length - 1]
  const t = last.event_type
  let status = 'running'
  if (t === 'scrapped') status = 'scrapped'
  else if (t === 'sent_vendor' || t === 'removed') status = 'in_repair'
  else if (t === 'moved_store' || t === 'returned' || t === 'purchased' || t === 'repaired') status = 'in_store'
  else if (t === 'installed') status = 'running'
  return { status, current_location: last.to_location || last.from_location || null, current_machine_id: t === 'installed' ? (last.machine_id || null) : null }
}
