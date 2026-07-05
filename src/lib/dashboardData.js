import { supabase } from './supabase'
import { getLocalDate } from './dateUtils'

// Local date string (YYYY-MM-DD). Never toISOString() — UTC date is wrong before 5:30am IST.
const iso = d => getLocalDate(d)
const num = v => Number(v) || 0
// include rows where is_deleted is null OR false
const live = q => q.or('is_deleted.is.null,is_deleted.eq.false')

export function periodRange(period) {
  const now = new Date(), to = iso(now)
  let from
  if (period === 'today') from = to
  else if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - 6); from = iso(d) }
  else if (period === 'qtr') { const q = Math.floor(now.getMonth() / 3) * 3; from = iso(new Date(now.getFullYear(), q, 1)) }
  else { from = iso(new Date(now.getFullYear(), now.getMonth(), 1)) } // mtd
  return { from, to }
}
export const PERIOD_LABEL = { today: 'Today', week: 'This week', mtd: 'This month', qtr: 'This quarter' }

export async function loadPeriod(plant, period) {
  const { from, to } = periodRange(period)
  const [srRes, machRes] = await Promise.all([
    live(supabase.from('shift_reports').select('id,date,pellet_production_mt,power_consumed_kwh').eq('plant_id', plant.id).gte('date', from).lte('date', to)),
    supabase.from('machines').select('id,name').eq('plant_id', plant.id),
  ])
  const srs = srRes.data || [], srIds = srs.map(s => s.id)
  const machineName = Object.fromEntries((machRes.data || []).map(m => [m.id, m.name]))

  const [mpRes, rmpRes, dispRes, sppRes] = await Promise.all([
    srIds.length ? supabase.from('machine_production').select('shift_report_id,machine_id,production_mt,total_hours,breakdown_hours').in('shift_report_id', srIds) : Promise.resolve({ data: [] }),
    live(supabase.from('raw_material_purchases').select('total_amount,quantity_kg,raw_material_type,date').eq('plant_id', plant.id).gte('date', from).lte('date', to)),
    live(supabase.from('vehicle_dispatches').select('id,date,customer_id').eq('plant_id', plant.id).gte('date', from).lte('date', to)),
    supabase.from('spare_parts_purchases').select('grand_total,total_amount,purchase_date').eq('plant_id', plant.id).gte('purchase_date', from).lte('purchase_date', to),
  ])
  const disps = dispRes.data || [], dispIds = disps.map(d => d.id)
  const custIds = [...new Set(disps.map(d => d.customer_id).filter(Boolean))]
  const [dpRes, custRes] = await Promise.all([
    dispIds.length ? supabase.from('dispatch_pellets').select('dispatch_id,quantity_mt').in('dispatch_id', dispIds) : Promise.resolve({ data: [] }),
    custIds.length ? supabase.from('customers').select('id,name').in('id', custIds) : Promise.resolve({ data: [] }),
  ])
  const custName = Object.fromEntries((custRes.data || []).map(c => [c.id, c.name]))
  const dpByDisp = {}
  for (const p of (dpRes.data || [])) dpByDisp[p.dispatch_id] = (dpByDisp[p.dispatch_id] || 0) + num(p.quantity_mt)

  const production = srs.reduce((s, r) => s + num(r.pellet_production_mt), 0)
  const power = srs.reduce((s, r) => s + num(r.power_consumed_kwh), 0)
  const dispatched = Object.values(dpByDisp).reduce((s, v) => s + v, 0)
  const rmSpend = (rmpRes.data || []).reduce((s, r) => s + num(r.total_amount), 0)
  const rmKg = (rmpRes.data || []).reduce((s, r) => s + num(r.quantity_kg), 0)
  const spareSpend = (sppRes.data || []).reduce((s, r) => s + (num(r.grand_total) || num(r.total_amount)), 0)

  const byMachineMap = {}
  for (const mp of (mpRes.data || [])) {
    const k = machineName[mp.machine_id] || 'Unknown'
    byMachineMap[k] = byMachineMap[k] || { name: k, mt: 0, hours: 0, breakdown: 0 }
    byMachineMap[k].mt += num(mp.production_mt); byMachineMap[k].hours += num(mp.total_hours); byMachineMap[k].breakdown += num(mp.breakdown_hours)
  }
  const byCustomerMap = {}
  for (const d of disps) { const k = custName[d.customer_id] || 'Unknown'; byCustomerMap[k] = (byCustomerMap[k] || 0) + (dpByDisp[d.id] || 0) }
  const rmByTypeMap = {}
  for (const r of (rmpRes.data || [])) { const k = r.raw_material_type || 'Other'; rmByTypeMap[k] = rmByTypeMap[k] || { type: k, kg: 0, spend: 0 }; rmByTypeMap[k].kg += num(r.quantity_kg); rmByTypeMap[k].spend += num(r.total_amount) }
  const prodByDayMap = {}
  for (const r of srs) prodByDayMap[r.date] = (prodByDayMap[r.date] || 0) + num(r.pellet_production_mt)

  return {
    from, to, production, dispatched, rmSpend, rmKg, spareSpend, power,
    byMachine: Object.values(byMachineMap).sort((a, b) => b.mt - a.mt),
    byCustomer: Object.entries(byCustomerMap).map(([name, mt]) => ({ name, mt })).sort((a, b) => b.mt - a.mt),
    rmByType: Object.values(rmByTypeMap).sort((a, b) => b.kg - a.kg),
    prodByDay: Object.entries(prodByDayMap).map(([date, mt]) => ({ date, mt })).sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export async function loadDaily(plant, date) {
  const srRes = await live(supabase.from('shift_reports').select('id,shift,pellet_production_mt').eq('plant_id', plant.id).eq('date', date))
  const srs = srRes.data || [], srIds = srs.map(s => s.id)
  const [machRes, mpRes, rmuRes, rmpRes, dispRes] = await Promise.all([
    supabase.from('machines').select('id,name').eq('plant_id', plant.id).order('sort_order'),
    srIds.length ? supabase.from('machine_production').select('shift_report_id,machine_id,production_mt').in('shift_report_id', srIds) : Promise.resolve({ data: [] }),
    srIds.length ? supabase.from('raw_material_usage').select('raw_material_type_id,quantity_kg').in('shift_report_id', srIds) : Promise.resolve({ data: [] }),
    live(supabase.from('raw_material_purchases').select('raw_material_type,quantity_kg').eq('plant_id', plant.id).eq('date', date)),
    live(supabase.from('vehicle_dispatches').select('id,customer_id').eq('plant_id', plant.id).eq('date', date)),
  ])
  const machines = machRes.data || [], machineName = Object.fromEntries(machines.map(m => [m.id, m.name]))
  const shiftMap = {}
  for (const sr of srs) shiftMap[sr.id] = { shift: sr.shift, total: num(sr.pellet_production_mt), byMachine: {} }
  for (const mp of (mpRes.data || [])) { const s = shiftMap[mp.shift_report_id]; if (s) s.byMachine[machineName[mp.machine_id] || '?'] = num(mp.production_mt) }
  const shifts = Object.values(shiftMap).sort((a, b) => (a.shift || '').localeCompare(b.shift || ''))

  const rmTypeRes = await supabase.from('raw_material_types').select('id,name').eq('plant_id', plant.id)
  const rmTypeName = Object.fromEntries((rmTypeRes.data || []).map(t => [t.id, t.name]))
  const rmMap = {}
  for (const u of (rmuRes.data || [])) { const k = rmTypeName[u.raw_material_type_id] || 'Other'; rmMap[k] = rmMap[k] || { type: k, purchased: 0, used: 0 }; rmMap[k].used += num(u.quantity_kg) }
  for (const p of (rmpRes.data || [])) { const k = p.raw_material_type || 'Other'; rmMap[k] = rmMap[k] || { type: k, purchased: 0, used: 0 }; rmMap[k].purchased += num(p.quantity_kg) }

  const disps = dispRes.data || [], dispIds = disps.map(d => d.id)
  const custIds = [...new Set(disps.map(d => d.customer_id).filter(Boolean))]
  const [dpRes, custRes] = await Promise.all([
    dispIds.length ? supabase.from('dispatch_pellets').select('dispatch_id,pellet_type_name,quantity_mt').in('dispatch_id', dispIds) : Promise.resolve({ data: [] }),
    custIds.length ? supabase.from('customers').select('id,name').in('id', custIds) : Promise.resolve({ data: [] }),
  ])
  const custName = Object.fromEntries((custRes.data || []).map(c => [c.id, c.name]))
  const dispById = Object.fromEntries(disps.map(d => [d.id, d]))
  const dispatch = (dpRes.data || []).map(p => ({ customer: custName[dispById[p.dispatch_id]?.customer_id] || 'Unknown', type: p.pellet_type_name, qty: num(p.quantity_mt) }))

  return {
    machines: machines.map(m => m.name), shifts, rm: Object.values(rmMap), dispatch,
    production: shifts.reduce((s, x) => s + x.total, 0),
    rmUsed: Object.values(rmMap).reduce((s, x) => s + x.purchased * 0 + x.used, 0),
    rmPurchased: Object.values(rmMap).reduce((s, x) => s + x.purchased, 0),
    dispatched: dispatch.reduce((s, x) => s + x.qty, 0),
  }
}

const isWork = e => (e.event_type === 'returned' && Number(e.cost)) || e.event_type === 'repaired'
export async function loadAssets(plant) {
  const [aRes, eRes] = await Promise.all([
    supabase.from('assets').select('id,code,name,asset_type,status,current_location,new_price').eq('plant_id', plant.id).eq('is_active', true),
    supabase.from('asset_events').select('asset_id,event_type,cost,supplier_id').eq('org_id', plant.org_id),
  ])
  const assets = aRes.data || [], events = eRes.data || []
  const byAsset = {}
  for (const e of events) { (byAsset[e.asset_id] = byAsset[e.asset_id] || []).push(e) }
  const rows = assets.map(a => {
    const evs = byAsset[a.id] || []
    const spend = evs.filter(isWork).reduce((s, e) => s + num(e.cost), 0)
    const repairs = evs.filter(isWork).length
    const ratio = a.new_price ? spend / num(a.new_price) : 0
    return { ...a, spend, repairs, ratio }
  })
  const active = rows.filter(r => r.status !== 'scrapped')
  return {
    active: active.length,
    atRepair: active.filter(r => r.status === 'in_repair'),
    flagged: active.filter(r => r.status !== 'scrapped' && r.ratio >= 0.5),
    lifetimeRepair: rows.reduce((s, r) => s + r.spend, 0),
    rvr: rows.filter(r => r.repairs > 0).sort((a, b) => b.ratio - a.ratio),
  }
}

export async function loadSpares(plant) {
  const partsRes = await supabase.from('spare_parts').select('id,name,unit,min_stock_level').eq('org_id', plant.org_id).eq('is_active', true)
  const parts = partsRes.data || [], ids = parts.map(p => p.id)
  const [purAll, useAll, cfg] = await Promise.all([
    ids.length ? supabase.from('spare_parts_purchases').select('part_id,quantity,grand_total,total_amount').eq('plant_id', plant.id).in('part_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('spare_parts_usage').select('part_id,quantity').eq('plant_id', plant.id).in('part_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('spare_parts_plant_config').select('part_id,min_stock_level').eq('plant_id', plant.id).in('part_id', ids) : Promise.resolve({ data: [] }),
  ])
  const pMap = {}, uMap = {}, minMap = {}
  for (const r of (purAll.data || [])) pMap[r.part_id] = (pMap[r.part_id] || 0) + num(r.quantity)
  for (const r of (useAll.data || [])) uMap[r.part_id] = (uMap[r.part_id] || 0) + num(r.quantity)
  for (const r of (cfg.data || [])) minMap[r.part_id] = num(r.min_stock_level)
  const spend = (purAll.data || []).reduce((s, r) => s + (num(r.grand_total) || num(r.total_amount)), 0)
  const items = parts.map(p => ({ name: p.name, unit: p.unit, stock: (pMap[p.id] || 0) - (uMap[p.id] || 0), min: minMap[p.id] ?? null }))
  return { items, spend, low: items.filter(i => i.min != null && i.stock <= i.min) }
}

export async function latestReportDate(plant) {
  const r = await live(supabase.from('shift_reports').select('date').eq('plant_id', plant.id).order('date', { ascending: false }).limit(1))
  return (r.data && r.data[0] && r.data[0].date) || iso(new Date())
}
