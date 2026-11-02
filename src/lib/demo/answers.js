import { DEMO_PLANT_NAME } from './mode.js'
import { localDateOffset } from './seed.js'

const PREFIX = `Sample data only (${DEMO_PLANT_NAME} — fictional numbers):\n\n`

function inr(n) {
  return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
}

function mt(n) {
  return (Math.round(Number(n) * 100) / 100).toLocaleString('en-IN') + ' MT'
}

function livePurchases(db) {
  return (db.raw_material_purchases || []).filter(p => !p.is_deleted)
}

function liveDispatches(db) {
  return (db.vehicle_dispatches || []).filter(d => !d.is_deleted)
}

function liveReports(db) {
  return (db.shift_reports || []).filter(r => !r.is_deleted)
}

function nameById(rows, id) {
  return (rows || []).find(r => r.id === id)?.name || 'Unknown'
}

function sumProduction(rows) {
  return rows.reduce((s, r) => s + Number(r.pellet_production_mt || 0), 0)
}

function pendingPurchases(db) {
  return livePurchases(db).filter(p =>
    p.payment_status === 'Pending' || p.rm_payment_status === 'Pending' || p.transport_payment_status === 'Pending'
  )
}

function pelletStockLatest(db) {
  const reports = liveReports(db).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const latestId = reports[0]?.id
  if (!latestId) return []
  const types = Object.fromEntries((db.pellet_types || []).map(t => [t.id, t.name]))
  return (db.pellet_stock || [])
    .filter(s => s.shift_report_id === latestId)
    .map(s => `${types[s.pellet_type_id] || 'Pellet'}: ${mt(s.closing_mt)} closing`)
}

export function answerDemoQuestion(question, { fn, db: seed } = {}) {
  const q = String(question || '').trim()
  const ql = q.toLowerCase()
  const db = seed
  if (!db) {
    return PREFIX + 'Demo sample store is not loaded.'
  }
  const today = localDateOffset(0)
  const weekStart = localDateOffset(-6)
  const monthPrefix = today.slice(0, 7)

  if (fn === 'plant-chat' && /weather|rain|forecast|temperature|humidity|open-?meteo/i.test(q)) {
    return PREFIX + 'Weather is turned off in this demo. The plant pin is a fictional geofence (not a real site), so live forecasts are not shown.'
  }

  if (!q || /help|what can|try:|ask me/i.test(ql)) {
    return PREFIX + 'Ask about sample production, purchases, pending payments, dispatches, stock, suppliers, customers, tasks, attendance, spare parts, assets, or finance. Numbers are fictional tour data only.'
  }

  if ((/pending|unpaid|outstanding/.test(ql) && /pay|payment|bill|purchase/.test(ql)) || ql === 'pending payments') {
    const rows = pendingPurchases(db)
    const total = rows.reduce((s, p) => s + Number(p.total_amount || 0), 0)
    const lines = rows.slice(0, 6).map(p =>
      `• ${p.serial_no} ${p.supplier_name} — ${p.raw_material_type} ${Math.round(p.quantity_kg / 1000)} MT, ${inr(p.total_amount)} (${p.payment_status})`
    )
    return PREFIX + `${rows.length} sample purchase(s) still show Pending (RM or transport). Outstanding total ${inr(total)}.\n${lines.join('\n')}`
  }

  if (/purchase/.test(ql)) {
    const rows = livePurchases(db)
    const target = /yesterday/.test(ql) ? localDateOffset(-1) : /today/.test(ql) ? today : null
    const filtered = target ? rows.filter(p => p.date === target) : rows
    const label = target === today ? 'today' : target ? 'yesterday' : 'in the sample window'
    const lines = filtered.slice(0, 6).map(p =>
      `• ${p.date} ${p.serial_no} ${p.supplier_name} — ${p.raw_material_type} ${p.quantity_kg} kg @ ${p.rate_per_kg}/kg (${p.payment_status})`
    )
    if (filtered.length === 0) return PREFIX + `No sample purchases ${label}.`
    return PREFIX + `${filtered.length} sample purchase(s) ${label}.\n${lines.join('\n')}`
  }

  if (/dispatch|truck|customer wise|customer-wise/.test(ql) || /customer/.test(ql) && /wise|summary/.test(ql)) {
    const rows = liveDispatches(db)
    const week = /week/.test(ql)
    const filtered = week ? rows.filter(d => d.date >= weekStart) : rows
    const pellets = db.dispatch_pellets || []
    const byCustomer = {}
    for (const d of filtered) {
      const name = nameById(db.customers, d.customer_id)
      const qty = pellets.filter(p => p.dispatch_id === d.id).reduce((s, p) => s + Number(p.quantity_mt || 0), 0)
      byCustomer[name] = (byCustomer[name] || 0) + qty
    }
    const lines = Object.entries(byCustomer).map(([name, qty]) => `• ${name}: ${mt(qty)}`)
    const window = week ? 'this week (sample dates)' : 'in the sample window'
    return PREFIX + `${filtered.length} sample dispatch(es) ${window}.\n${lines.join('\n') || 'None.'}`
  }

  if (/production/.test(ql) || /summary today|today summary/.test(ql)) {
    const rows = liveReports(db)
    const todayRows = rows.filter(r => r.date === today)
    const monthRows = rows.filter(r => String(r.date).startsWith(monthPrefix))
    const scope = /today/.test(ql) ? todayRows : /month/.test(ql) ? monthRows : monthRows
    const label = /today/.test(ql) ? 'today' : 'this month (sample dates)'
    return PREFIX + `Sample pellet production ${label}: ${mt(sumProduction(scope))} across ${scope.length} shift report(s). Latest handover: “${todayRows[0]?.handover_notes || rows[0]?.handover_notes || 'n/a'}”.`
  }

  if (/stock|inventory|all stock/.test(ql)) {
    const rm = (db.raw_material_types || []).filter(m => m.is_active)
    const rmLines = rm.map(m => `• ${m.name}: opening ${Math.round(Number(m.opening_stock_kg || 0) / 1000 * 10) / 10} MT (${m.source})`)
    const pelletLines = pelletStockLatest(db)
    return PREFIX + `Raw-material opening stocks (sample):\n${rmLines.join('\n')}\n\nFinished goods from the latest sample shift:\n${pelletLines.join('\n') || 'None.'}`
  }

  if (/supplier/.test(ql)) {
    const lines = (db.suppliers || []).map(s => `• ${s.name} — ${s.raw_material_type} @ ${s.rate_offered}/kg (sample GCV ${s.sample_gcv})`)
    return PREFIX + `Sample suppliers:\n${lines.join('\n')}`
  }

  if (/customer/.test(ql)) {
    const lines = (db.customers || []).map(c => `• ${c.name} (${c.contact_person})`)
    return PREFIX + `Sample customers:\n${lines.join('\n')}`
  }

  if (/average rate|avg rate|rate/.test(ql) && /purchase|rm|material/.test(ql) || ql === 'average rate') {
    const rows = livePurchases(db)
    const qty = rows.reduce((s, p) => s + Number(p.quantity_kg || 0), 0)
    const amt = rows.reduce((s, p) => s + Number(p.total_amount || 0), 0)
    const avg = qty ? amt / qty : 0
    return PREFIX + `Sample landed average across ${rows.length} purchases: ${avg.toFixed(2)} ₹/kg (total ${inr(amt)} on ${Math.round(qty)} kg).`
  }

  if (/task/.test(ql)) {
    const open = (db.tasks || []).filter(t => t.status === 'open')
    const lines = open.map(t => `• ${t.title} (due ${t.due_date})`)
    return PREFIX + `${open.length} open sample task(s):\n${lines.join('\n') || 'None.'}`
  }

  if (/attend/.test(ql)) {
    const todayAtt = (db.attendance || []).filter(a => a.work_date === today)
    const present = todayAtt.filter(a => a.check_in_at || a.status === 'present').length
    return PREFIX + `Sample attendance for ${today}: ${present} check-in(s) on the roster. Self check-in uses a fictional geofence, not a real plant GPS.`
  }

  if (/spare|bearing|belt|reorder/.test(ql)) {
    const pending = (db.spare_parts_reorder_requests || []).filter(r => r.status === 'pending' || r.status === 'ordered')
    return PREFIX + `Sample spare catalogue has ${(db.spare_parts || []).length} parts. ${pending.length} reorder request(s) are still open in the tour data.`
  }

  if (/asset|motor|gearbox|repair shop/.test(ql)) {
    const assets = db.assets || []
    const repair = assets.filter(a => a.status === 'in_repair')
    const lines = assets.map(a => `• ${a.code} ${a.name} — ${a.status.replace(/_/g, ' ')}`)
    return PREFIX + `${assets.length} sample assets. ${repair.length} at repair.\n${lines.join('\n')}`
  }

  if (/finance|cost|electricity|rent|wage/.test(ql)) {
    const costs = (db.finance_costs || []).filter(c => !c.is_deleted)
    const monthly = costs.filter(c => c.frequency === 'monthly').reduce((s, c) => s + Number(c.amount || 0), 0)
    const lines = costs.map(c => `• ${c.category}: ${inr(c.amount)} (${c.frequency === 'monthly' ? 'monthly' : c.cost_date})`)
    return PREFIX + `Sample monthly recurring costs ${inr(monthly)}.\n${lines.join('\n')}\nTally / accounting export is not available in this tour.`
  }

  if (/who|directory|employee|staff|supervisor/.test(ql)) {
    const people = (db.employees || []).filter(e => e.is_active && (e.worker_type || 'staff') === 'staff')
    const lines = people.map(e => `• ${e.name} — ${e.role.replace(/_/g, ' ')}`)
    return PREFIX + `Sample staff directory:\n${lines.join('\n')}`
  }

  return PREFIX + 'I can summarise this tour’s sample production, purchases, pending payments, dispatches, stock, suppliers, customers, tasks, attendance, spares, assets, or finance. Rephrase using one of those words — all figures are fictional.'
}
