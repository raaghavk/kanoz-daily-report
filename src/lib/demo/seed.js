import { IDS } from './ids.js'
import { DEMO_EMAIL, DEMO_ORG_NAME, DEMO_PLANT_NAME } from './mode.js'

function pad(n) {
  return String(n).padStart(2, '0')
}

export function localDateOffset(days, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isoDaysAgo(days, hours = 12) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hours, 0, 0, 0)
  return d.toISOString()
}

const ADMIN_PERMS = [
  'create_report', 'view_reports', 'create_dispatch', 'view_dispatches',
  'create_purchase', 'view_purchases', 'view_spare_parts', 'create_spare_parts',
  'assign_tasks', 'export', 'manage_users', 'plant_settings', 'switch_plant',
  'mark_attendance_others', 'view_dashboard', 'view_finance', 'mark_purchase_paid',
]
const PM_PERMS = ADMIN_PERMS.filter(p => p !== 'switch_plant' && p !== 'manage_users')
const SUP_PERMS = [
  'create_report', 'view_reports', 'create_dispatch', 'view_dispatches',
  'create_purchase', 'view_purchases', 'view_spare_parts', 'create_spare_parts',
  'export', 'mark_attendance_others',
]

function shiftId(n) {
  return `a0000001-d000-4000-8000-0000000010${pad(n)}`
}
function issueId(n) {
  return `a0000001-d000-4000-8000-0000000020${pad(n)}`
}
function dispId(n) {
  return `a0000001-d000-4000-8000-0000000030${pad(n)}`
}
function dpId(n) {
  return `a0000001-d000-4000-8000-0000000031${pad(n)}`
}
function purchId(n) {
  return `a0000001-d000-4000-8000-0000000040${pad(n)}`
}
function taskId(n) {
  return `a0000001-d000-4000-8000-0000000050${pad(n)}`
}
function mpId(n) {
  return `a0000001-d000-4000-8000-0000000060${pad(n)}`
}
function rmuId(n) {
  return `a0000001-d000-4000-8000-0000000070${pad(n)}`
}
function psId(n) {
  return `a0000001-d000-4000-8000-0000000080${pad(n)}`
}
function mixId(n) {
  return `a0000001-d000-4000-8000-0000000090${pad(n)}`
}

/**
 * Build a full in-memory dataset. Dates are relative to "today" so week/month
 * filters on the tour always show rows.
 */
export function createDemoSeed(now = new Date()) {
  const today = localDateOffset(0, now)
  const d = (n) => localDateOffset(n, now)
  const openingDate = d(-45)

  const organizations = [{
    id: IDS.org,
    name: DEMO_ORG_NAME,
    slug: 'acme-biomass-demo',
    logo_url: null,
    created_at: isoDaysAgo(120),
    updated_at: isoDaysAgo(1),
  }]

  const plants = [{
    id: IDS.plant,
    org_id: IDS.org,
    name: DEMO_PLANT_NAME,
    code: 'RIV-01',
    address: '100 Demo Riverside Way, Sample County',
    state: 'Demo State',
    is_active: true,
    financial_year_start: `${now.getFullYear()}-04-01`,
    stock_opening_date: openingDate,
    // No GPS — weather widget stays hidden on purpose.
    location_lat: null,
    location_lng: null,
    electricity_tariff: 8.5,
    diesel_rate: 92,
    created_at: isoDaysAgo(120),
    updated_at: isoDaysAgo(1),
  }]

  const employees = [
    {
      id: IDS.empJordan, org_id: IDS.org, plant_id: IDS.plant,
      name: 'Jordan Admin', mobile: '+1-555-0100', role: 'admin', is_active: true,
      auth_user_id: IDS.authJordan, email: DEMO_EMAIL,
      created_at: isoDaysAgo(100), updated_at: isoDaysAgo(1),
    },
    {
      id: IDS.empSam, org_id: IDS.org, plant_id: IDS.plant,
      name: 'Sam Supervisor', mobile: '+1-555-0101', role: 'supervisor', is_active: true,
      auth_user_id: null, email: 'sam.supervisor@acme-biomass.example',
      created_at: isoDaysAgo(90), updated_at: isoDaysAgo(2),
    },
    {
      id: IDS.empAlex, org_id: IDS.org, plant_id: IDS.plant,
      name: 'Alex Operator', mobile: '+1-555-0102', role: 'supervisor', is_active: true,
      auth_user_id: null, email: 'alex.operator@acme-biomass.example',
      created_at: isoDaysAgo(80), updated_at: isoDaysAgo(3),
    },
  ]

  const roles = [
    { id: IDS.roleAdmin, org_id: IDS.org, key: 'admin', name: 'Admin', description: 'Full access', permissions: ADMIN_PERMS, is_default: true, receive_tasks: false, track_attendance: false },
    { id: IDS.rolePlantManager, org_id: IDS.org, key: 'plant_manager', name: 'Plant Manager', description: 'Plant operations', permissions: PM_PERMS, is_default: true, receive_tasks: true, track_attendance: true },
    { id: IDS.roleSupervisor, org_id: IDS.org, key: 'supervisor', name: 'Supervisor', description: 'Shift operations', permissions: SUP_PERMS, is_default: true, receive_tasks: true, track_attendance: true },
    { id: IDS.rolePurchase, org_id: IDS.org, key: 'purchase_manager', name: 'Purchase Manager', description: 'Purchases', permissions: ['create_purchase', 'view_reports', 'view_purchases'], is_default: true, receive_tasks: true, track_attendance: true },
    { id: IDS.roleAccountant, org_id: IDS.org, key: 'accountant', name: 'Accountant', description: 'Read + export', permissions: ['view_reports', 'view_dispatches', 'view_purchases', 'view_spare_parts', 'export', 'mark_purchase_paid', 'view_finance'], is_default: true, receive_tasks: false, track_attendance: false },
  ]

  const machines = [
    { id: IDS.mLogEater, plant_id: IDS.plant, name: 'Log Eater', machine_type: 'Chipper', capacity_mt_per_hour: 8, motor_hp: 150, is_active: true, sort_order: 1 },
    { id: IDS.mHammer, plant_id: IDS.plant, name: 'Hammer Mill', machine_type: 'Mill', capacity_mt_per_hour: 6, motor_hp: 200, is_active: true, sort_order: 2 },
    { id: IDS.mDryer, plant_id: IDS.plant, name: 'Rotary Dryer', machine_type: 'Dryer', capacity_mt_per_hour: 5, motor_hp: 75, is_active: true, sort_order: 3 },
    { id: IDS.mPellet1, plant_id: IDS.plant, name: 'Pellet Mill 1', machine_type: 'Pellet mill', capacity_mt_per_hour: 2.5, motor_hp: 220, is_active: true, sort_order: 4 },
    { id: IDS.mPellet2, plant_id: IDS.plant, name: 'Pellet Mill 2', machine_type: 'Pellet mill', capacity_mt_per_hour: 2.5, motor_hp: 220, is_active: true, sort_order: 5 },
  ]

  const equipment = [
    { id: IDS.eqGen, plant_id: IDS.plant, name: 'Standby Generator', equipment_type: 'Generator', fuel_type: 'Diesel', rating: '250 kVA', owner: 'Company', company: DEMO_ORG_NAME, identifier: 'GEN-01', opening_stock_litres: 420, is_active: true, sort_order: 1 },
    { id: IDS.eqLoader, plant_id: IDS.plant, name: 'Yard Loader', equipment_type: 'Loader', fuel_type: 'Diesel', rating: '3 ton', owner: 'Company', company: DEMO_ORG_NAME, identifier: 'LDR-01', opening_stock_litres: 80, is_active: true, sort_order: 2 },
    { id: IDS.eqWeigh, plant_id: IDS.plant, name: 'Weighbridge', equipment_type: 'Weighbridge', fuel_type: null, rating: '60 ton', owner: 'Company', company: DEMO_ORG_NAME, identifier: 'WB-01', opening_stock_litres: 0, is_active: true, sort_order: 3 },
  ]

  const pellet_types = [
    { id: IDS.ptGradeA, plant_id: IDS.plant, name: 'Grade A 6mm', is_active: true, gcv_kcal_kg: 4300, grade: 'A' },
    { id: IDS.ptGradeB, plant_id: IDS.plant, name: 'Grade B 8mm', is_active: true, gcv_kcal_kg: 4000, grade: 'B' },
    { id: IDS.ptIndustrial, plant_id: IDS.plant, name: 'Industrial Mix', is_active: true, gcv_kcal_kg: 3800, grade: 'Industrial' },
  ]

  const raw_material_types = [
    { id: IDS.rmWoodLog, plant_id: IDS.plant, name: 'Wood Log', unit: 'kg', is_active: true, opening_stock_kg: 48000, gcv_kcal_kg: 3200, source: 'purchased' },
    { id: IDS.rmSmallLog, plant_id: IDS.plant, name: 'Small Log', unit: 'kg', is_active: true, opening_stock_kg: 12000, gcv_kcal_kg: 3100, source: 'in-house' },
    { id: IDS.rmSawDust, plant_id: IDS.plant, name: 'Saw Dust', unit: 'kg', is_active: true, opening_stock_kg: 18000, gcv_kcal_kg: 3400, source: 'in-house' },
    { id: IDS.rmRiceHusk, plant_id: IDS.plant, name: 'Rice Husk', unit: 'kg', is_active: true, opening_stock_kg: 9000, gcv_kcal_kg: 3000, source: 'purchased' },
    { id: IDS.rmBinder, plant_id: IDS.plant, name: 'Binder', unit: 'kg', is_active: true, opening_stock_kg: 800, gcv_kcal_kg: 0, source: 'purchased' },
  ]

  const customers = [
    { id: IDS.custNorthwind, org_id: IDS.org, name: 'Northwind Biofuel Co.', mobile: '+1-555-0140', address: '12 Harbor Ave, Sample Port', contact_person: 'Riley Chen', contact_phone: '+1-555-0141', gst_number: 'DEMOGST0001', email: 'ops@northwind.example', account_owner: 'Jordan Admin', notes: 'Contract customer — weekly 2 trucks', is_active: true },
    { id: IDS.custCedar, org_id: IDS.org, name: 'Cedar Ridge Energy', mobile: '+1-555-0142', address: '88 Ridge Road, Cedar Demo', contact_person: 'Morgan Patel', contact_phone: '+1-555-0143', gst_number: 'DEMOGST0002', email: 'buying@cedarridge.example', account_owner: 'Sam Supervisor', notes: null, is_active: true },
    { id: IDS.custGreenfield, org_id: IDS.org, name: 'Greenfield Mills Ltd.', mobile: '+1-555-0144', address: '5 Mill Lane, Greenfield Demo', contact_person: 'Casey Nguyen', contact_phone: '+1-555-0145', gst_number: 'DEMOGST0003', email: 'procurement@greenfield.example', account_owner: 'Jordan Admin', notes: 'Industrial Mix only', is_active: true },
  ]

  const suppliers = [
    { id: IDS.supOak, org_id: IDS.org, plant_id: IDS.plant, name: 'Oak Valley Timber', mobile: '+1-555-0160', raw_material_type: 'Wood Log', rate_offered: 4.2, sample_gcv: 3250, address: 'Oak Valley Demo', is_active: true },
    { id: IDS.supPine, org_id: IDS.org, plant_id: IDS.plant, name: 'Pinecrest Biomass', mobile: '+1-555-0161', raw_material_type: 'Rice Husk', rate_offered: 3.1, sample_gcv: 3050, address: 'Pinecrest Demo', is_active: true },
    { id: IDS.supRiver, org_id: IDS.org, plant_id: IDS.plant, name: 'Riverbend Sawmill', mobile: '+1-555-0162', raw_material_type: 'Saw Dust', rate_offered: 3.8, sample_gcv: 3380, address: 'Riverbend Demo', is_active: true },
  ]

  const transporters = [
    { id: IDS.trSummit, org_id: IDS.org, name: 'Summit Haulage', phone: '+1-555-0170', address: 'Summit Depot, Demo', is_active: true },
    { id: IDS.trLakeside, org_id: IDS.org, name: 'Lakeside Logistics', phone: '+1-555-0171', address: 'Lakeside Yard, Demo', is_active: true },
  ]

  const vehicles = [
    { id: IDS.vehAcme1, plant_id: IDS.plant, number: 'DEMO-101', type: 'company', vehicle_type: 'tractor', is_active: true },
    { id: IDS.vehAcme2, plant_id: IDS.plant, number: 'DEMO-102', type: 'company', vehicle_type: 'tractor', is_active: true },
  ]

  const transporter_vehicles = [
    { id: IDS.tvSummit1, transporter_id: IDS.trSummit, vehicle_number: 'SH-4401', is_active: true },
    { id: IDS.tvLake1, transporter_id: IDS.trLakeside, vehicle_number: 'LL-2209', is_active: true },
  ]

  const storage_plots = [
    { id: IDS.plotYard, plant_id: IDS.plant, name: 'Open Yard A', is_primary: true, is_active: true, capacity_mt: 400 },
    { id: IDS.plotCovered, plant_id: IDS.plant, name: 'Covered Shed B', is_primary: false, is_active: true, capacity_mt: 180 },
  ]

  const process_routes = [
    { id: IDS.routeLog, org_id: IDS.org, plant_id: IDS.plant, name: 'Wood Log → Small Log', input_material_type_id: IDS.rmWoodLog, input_material_name: 'Wood Log', output_material_type_id: IDS.rmSmallLog, output_material_name: 'Small Log', expected_yield_pct: 92, is_active: true, created_at: isoDaysAgo(60) },
    { id: IDS.routeSaw, org_id: IDS.org, plant_id: IDS.plant, name: 'Small Log → Saw Dust', input_material_type_id: IDS.rmSmallLog, input_material_name: 'Small Log', output_material_type_id: IDS.rmSawDust, output_material_name: 'Saw Dust', expected_yield_pct: 88, is_active: true, created_at: isoDaysAgo(60) },
  ]

  const process_route_stages = [
    { id: IDS.routeStage1, route_id: IDS.routeLog, seq: 1, machine_id: IDS.mLogEater, machine_name: 'Log Eater' },
    { id: IDS.routeStage2, route_id: IDS.routeSaw, seq: 1, machine_id: IDS.mHammer, machine_name: 'Hammer Mill' },
    { id: IDS.routeStage3, route_id: IDS.routeSaw, seq: 2, machine_id: IDS.mDryer, machine_name: 'Rotary Dryer' },
  ]

  // 8 shift reports: last 4 calendar days × A/B. Index 0 = today A.
  const shiftSpecs = [
    { n: 1, days: 0, shift: 'A', start: '08:00:00', end: '20:00:00', sameDay: true, prod: 18.4, supervisor: IDS.empSam, handover: 'Dryer belt tracking was noisy near end of shift. Next crew: check tension before start. Mix 2 remaining ~1.2 MT in hopper.', issues: true },
    { n: 2, days: -1, shift: 'B', start: '20:00:00', end: '08:00:00', sameDay: false, prod: 16.1, supervisor: IDS.empAlex, handover: 'Night shift steady. Generator ran 2.5 hrs during a grid dip.', issues: false },
    { n: 3, days: -1, shift: 'A', start: '08:00:00', end: '20:00:00', sameDay: true, prod: 19.2, supervisor: IDS.empSam, handover: 'Pellet Mill 2 die change completed. Grade A quality looks good.', issues: false },
    { n: 4, days: -2, shift: 'B', start: '20:00:00', end: '08:00:00', sameDay: false, prod: 15.8, supervisor: IDS.empAlex, handover: 'Rice husk moisture a bit high — watch Mix 1 ratio.', issues: true },
    { n: 5, days: -2, shift: 'A', start: '08:00:00', end: '20:00:00', sameDay: true, prod: 17.6, supervisor: IDS.empSam, handover: null, issues: false },
    { n: 6, days: -3, shift: 'B', start: '20:00:00', end: '08:00:00', sameDay: false, prod: 14.9, supervisor: IDS.empAlex, handover: 'Loader hydraulic leak spotted — logged as issue.', issues: true },
    { n: 7, days: -3, shift: 'A', start: '08:00:00', end: '20:00:00', sameDay: true, prod: 18.0, supervisor: IDS.empSam, handover: 'Two trucks out before 16:00. Yard plot A getting tight.', issues: false },
    { n: 8, days: -4, shift: 'A', start: '08:00:00', end: '20:00:00', sameDay: true, prod: 16.7, supervisor: IDS.empSam, handover: 'Week start: binder stock low, reorder raised.', issues: false },
  ]

  const shift_reports = shiftSpecs.map(s => {
    const startDate = d(s.days)
    const endDate = s.sameDay ? startDate : d(s.days + 1)
    return {
      id: shiftId(s.n),
      plant_id: IDS.plant,
      date: startDate,
      shift: s.shift,
      start_time: s.start,
      end_time: s.end,
      pellet_production_mt: s.prod,
      start_power_reading: 12000 + s.n * 180,
      end_power_reading: 12000 + s.n * 180 + 2400,
      power_consumed_kwh: 2400,
      supervisor_id: s.supervisor,
      remarks: 'Demo sample shift — fictional numbers only.',
      created_by: s.supervisor,
      last_edited_by: null,
      created_at: isoDaysAgo(-s.days, 9),
      updated_at: isoDaysAgo(-s.days, 20),
      shift_start_date: startDate,
      shift_end_date: endDate,
      handover_notes: s.handover,
      status: 'submitted',
      is_deleted: false,
    }
  })

  const machine_production = []
  const raw_material_usage = []
  const pellet_stock = []
  const diesel_stock = []
  const diesel_purchases = []
  const equipment_diesel_log = []
  const issues = []
  const shift_mixes = []
  const shift_mix_compositions = []
  const processing_runs = []

  shiftSpecs.forEach((s, idx) => {
    const rid = shiftId(s.n)
    const mills = [
      { id: IDS.mPellet1, mt: +(s.prod * 0.55).toFixed(3), hrs: 11.2 },
      { id: IDS.mPellet2, mt: +(s.prod * 0.45).toFixed(3), hrs: 10.8 },
    ]
    mills.forEach((m, mi) => {
      machine_production.push({
        id: mpId(idx * 4 + mi + 1),
        shift_report_id: rid,
        machine_id: m.id,
        hours_run: m.hrs,
        production_mt: m.mt,
        pellet_type_name: 'Grade A 6mm',
        from_time: '08:15',
        to_time: '19:40',
        breakdown_hours: s.issues && mi === 1 ? 0.6 : 0,
        total_hours: 12,
        did_not_run: false,
      })
    })
    machine_production.push({
      id: mpId(idx * 4 + 3),
      shift_report_id: rid, machine_id: IDS.mDryer, hours_run: 11, production_mt: 0,
      pellet_type_name: null, from_time: '08:00', to_time: '19:30', breakdown_hours: 0, total_hours: 12, did_not_run: false,
    })

    const usedSaw = Math.round(s.prod * 1000 * 1.12)
    const usedHusk = Math.round(s.prod * 1000 * 0.22)
    const usedBinder = Math.round(s.prod * 8)
    raw_material_usage.push(
      { id: rmuId(idx * 5 + 1), shift_report_id: rid, raw_material_type_id: IDS.rmWoodLog, quantity_kg: 0, opening_kg: 48000 - idx * 2000, closing_kg: 47000 - idx * 2000, purchased_kg: idx === 0 ? 12000 : 0 },
      { id: rmuId(idx * 5 + 2), shift_report_id: rid, raw_material_type_id: IDS.rmSmallLog, quantity_kg: 4000, opening_kg: 12000, closing_kg: 11000, purchased_kg: 0 },
      { id: rmuId(idx * 5 + 3), shift_report_id: rid, raw_material_type_id: IDS.rmSawDust, quantity_kg: usedSaw, opening_kg: 18000 - idx * 800, closing_kg: 18000 - idx * 800 - usedSaw + 3500, purchased_kg: 0 },
      { id: rmuId(idx * 5 + 4), shift_report_id: rid, raw_material_type_id: IDS.rmRiceHusk, quantity_kg: usedHusk, opening_kg: 9000, closing_kg: 9000 - usedHusk, purchased_kg: idx === 1 ? 6000 : 0 },
      { id: rmuId(idx * 5 + 5), shift_report_id: rid, raw_material_type_id: IDS.rmBinder, quantity_kg: usedBinder, opening_kg: 800, closing_kg: 800 - usedBinder, purchased_kg: 0 },
    )

    const openA = 42 - idx * 2
    const dispA = s.n <= 2 ? 12 : s.n === 3 ? 10 : 8
    pellet_stock.push(
      { id: psId(idx * 3 + 1), shift_report_id: rid, pellet_type_id: IDS.ptGradeA, opening_mt: openA, production_mt: +(s.prod * 0.7).toFixed(3), dispatch_mt: dispA, wastage_mt: 0.1, closing_mt: +(openA + s.prod * 0.7 - dispA - 0.1).toFixed(3) },
      { id: psId(idx * 3 + 2), shift_report_id: rid, pellet_type_id: IDS.ptGradeB, opening_mt: 18, production_mt: +(s.prod * 0.2).toFixed(3), dispatch_mt: 0, wastage_mt: 0, closing_mt: +(18 + s.prod * 0.2).toFixed(3) },
      { id: psId(idx * 3 + 3), shift_report_id: rid, pellet_type_id: IDS.ptIndustrial, opening_mt: 9, production_mt: +(s.prod * 0.1).toFixed(3), dispatch_mt: 0, wastage_mt: 0, closing_mt: +(9 + s.prod * 0.1).toFixed(3) },
    )

    diesel_stock.push({
      id: `a0000001-d000-4000-8000-00000000aa${pad(s.n)}`,
      shift_report_id: rid, opening_litres: 400, purchased_litres: s.n === 2 ? 200 : 0,
      purchase_cost: s.n === 2 ? 18400 : 0, used_litres: 38, closing_litres: s.n === 2 ? 562 : 362,
    })
    if (s.n === 2) {
      diesel_purchases.push({
        id: `a0000001-d000-4000-8000-00000000ab01`,
        shift_report_id: rid, litres: 200, cost_per_litre: 92, total_cost: 18400, receipt_url: null, purchase_time: '21:10:00',
      })
    }

    equipment_diesel_log.push(
      { id: `a0000001-d000-4000-8000-00000000ac${pad(idx * 2 + 1)}`, shift_report_id: rid, equipment_id: IDS.eqGen, equipment_name: 'Standby Generator', equipment_type: 'Generator', owner: 'Company', company: DEMO_ORG_NAME, identifier: 'GEN-01', opening_litres: 420, added_litres: 0, closing_litres: 396, hours_worked: 2.5, used_litres: 24 },
      { id: `a0000001-d000-4000-8000-00000000ac${pad(idx * 2 + 2)}`, shift_report_id: rid, equipment_id: IDS.eqLoader, equipment_name: 'Yard Loader', equipment_type: 'Loader', owner: 'Company', company: DEMO_ORG_NAME, identifier: 'LDR-01', opening_litres: 80, added_litres: 20, closing_litres: 86, hours_worked: 6, used_litres: 14 },
    )

    const mix = mixId(s.n)
    shift_mixes.push({
      id: mix, shift_report_id: rid, plant_id: IDS.plant, org_id: IDS.org,
      name: 'Mix 1', type: 'Grade A', opening_kg: 2000, prepared_kg: usedSaw + usedHusk + usedBinder,
      used_kg: usedSaw + usedHusk + usedBinder - 200, closing_kg: 2200, derived_pellet_name: 'Grade A 6mm', derived_gcv: 4280, derived_grade: 'A',
    })
    shift_mix_compositions.push(
      { id: `a0000001-d000-4000-8000-00000000ad${pad(idx * 3 + 1)}`, mix_id: mix, raw_material_type_id: IDS.rmSawDust, raw_material_name: 'Saw Dust', quantity_kg: usedSaw },
      { id: `a0000001-d000-4000-8000-00000000ad${pad(idx * 3 + 2)}`, mix_id: mix, raw_material_type_id: IDS.rmRiceHusk, raw_material_name: 'Rice Husk', quantity_kg: usedHusk },
      { id: `a0000001-d000-4000-8000-00000000ad${pad(idx * 3 + 3)}`, mix_id: mix, raw_material_type_id: IDS.rmBinder, raw_material_name: 'Binder', quantity_kg: usedBinder },
    )

    processing_runs.push({
      id: `a0000001-d000-4000-8000-00000000ae${pad(s.n)}`,
      shift_report_id: rid, plant_id: IDS.plant, route_id: IDS.routeSaw,
      output_material: 'Saw Dust', output_kg: 3500, input_kg: 4000,
      machine_hours: { [IDS.mHammer]: 6, [IDS.mDryer]: 6 },
    })

    if (s.issues) {
      if (s.n === 1) {
        issues.push({
          id: issueId(1), shift_report_id: rid, machine_id: IDS.mDryer,
          issue_type: 'Mechanical', description: 'Dryer belt tracking noisy — tension check needed next shift.',
          severity: 'medium', is_resolved: false, resolved_at: null, photo_url: null, created_at: isoDaysAgo(0, 18),
        })
      }
      if (s.n === 4) {
        issues.push({
          id: issueId(2), shift_report_id: rid, machine_id: IDS.mPellet1,
          issue_type: 'Quality', description: 'Rice husk moisture high; Mix 1 pellet fines increased.',
          severity: 'low', is_resolved: true, resolved_at: isoDaysAgo(1, 10), photo_url: null, created_at: isoDaysAgo(2, 22),
        })
      }
      if (s.n === 6) {
        issues.push({
          id: issueId(3), shift_report_id: rid, machine_id: null,
          issue_type: 'Equipment', description: 'Yard loader hydraulic leak at hose fitting. Wiped down, tagged for maintenance.',
          severity: 'high', is_resolved: false, resolved_at: null, photo_url: null, created_at: isoDaysAgo(3, 23),
        })
      }
    }
  })

  const dispatchSpecs = [
    { n: 1, days: 0, customer: IDS.custNorthwind, truck: 'SH-4401', dest: 'Northwind Harbor Terminal', mt: 12, type: IDS.ptGradeA, transporter: IDS.trSummit, name: 'Summit Haulage', time: '14:20:00', serial: 'DS-1044', invoice: 'INV-8801', driver: 'Taylor Reed', phone: '+1-555-0180' },
    { n: 2, days: -1, customer: IDS.custCedar, truck: 'LL-2209', dest: 'Cedar Ridge Plant Gate', mt: 10, type: IDS.ptGradeA, transporter: IDS.trLakeside, name: 'Lakeside Logistics', time: '11:05:00', serial: 'DS-1043', invoice: 'INV-8800', driver: 'Jamie Brooks', phone: '+1-555-0181' },
    { n: 3, days: -1, customer: IDS.custGreenfield, truck: 'GF-1188', dest: 'Greenfield Mills siding', mt: 8, type: IDS.ptIndustrial, transporter: IDS.trSummit, name: 'Summit Haulage', time: '16:40:00', serial: 'DS-1042', invoice: 'INV-8799', driver: 'Quinn Alvarez', phone: '+1-555-0182' },
    { n: 4, days: -3, customer: IDS.custNorthwind, truck: 'SH-4401', dest: 'Northwind Harbor Terminal', mt: 12, type: IDS.ptGradeA, transporter: IDS.trSummit, name: 'Summit Haulage', time: '13:10:00', serial: 'DS-1041', invoice: 'INV-8798', driver: 'Taylor Reed', phone: '+1-555-0180' },
    { n: 5, days: -4, customer: IDS.custCedar, truck: 'LL-2209', dest: 'Cedar Ridge Plant Gate', mt: 9.5, type: IDS.ptGradeB, transporter: IDS.trLakeside, name: 'Lakeside Logistics', time: '10:30:00', serial: 'DS-1040', invoice: 'INV-8797', driver: 'Jamie Brooks', phone: '+1-555-0181' },
  ]

  const vehicle_dispatches = dispatchSpecs.map(s => {
    const date = d(s.days)
    const linked = s.days === 0 ? shiftId(1) : s.days === -1 ? shiftId(3) : s.days === -3 ? shiftId(7) : shiftId(8)
    return {
      id: dispId(s.n),
      shift_report_id: linked,
      plant_id: IDS.plant,
      truck_number: s.truck,
      customer_id: s.customer,
      destination: s.dest,
      transporter: s.name,
      transporter_id: s.transporter,
      driver_name: s.driver,
      driver_phone: s.phone,
      invoice_no: s.invoice,
      serial_no: s.serial,
      katta_parchi_url: null,
      loading_time: '09:30:00',
      dispatch_time: s.time,
      remarks: 'Demo sample dispatch',
      date,
      loading_date: date,
      dispatch_date: date,
      created_by: IDS.empSam,
      created_at: isoDaysAgo(-s.days, 10),
      updated_at: isoDaysAgo(-s.days, 15),
      is_deleted: false,
      is_returned: false,
    }
  })

  const pelletName = {
    [IDS.ptGradeA]: 'Grade A 6mm',
    [IDS.ptGradeB]: 'Grade B 8mm',
    [IDS.ptIndustrial]: 'Industrial Mix',
  }
  const dispatch_pellets = dispatchSpecs.map(s => ({
    id: dpId(s.n),
    dispatch_id: dispId(s.n),
    pellet_type_id: s.type,
    pellet_type_name: pelletName[s.type],
    quantity_mt: s.mt,
  }))

  const purchaseSpecs = [
    { n: 1, days: 0, sup: IDS.supOak, rm: IDS.rmWoodLog, rmName: 'Wood Log', kg: 12000, rate: 4.2, pay: 'Pending', rmPay: 'Pending', trPay: 'Paid', serial: 'RM-2401', vehicle: 'DEMO-101', owner: 'Company Owned' },
    { n: 2, days: -1, sup: IDS.supPine, rm: IDS.rmRiceHusk, rmName: 'Rice Husk', kg: 6000, rate: 3.1, pay: 'Paid', rmPay: 'Paid', trPay: 'Paid', serial: 'RM-2400', vehicle: 'PB-3302', owner: 'Pinecrest Biomass' },
    { n: 3, days: -2, sup: IDS.supRiver, rm: IDS.rmSawDust, rmName: 'Saw Dust', kg: 8000, rate: 3.8, pay: 'Pending', rmPay: 'Paid', trPay: 'Pending', serial: 'RM-2399', vehicle: 'LL-2209', owner: 'Lakeside Logistics' },
    { n: 4, days: -3, sup: IDS.supOak, rm: IDS.rmWoodLog, rmName: 'Wood Log', kg: 14000, rate: 4.15, pay: 'Paid', rmPay: 'Paid', trPay: 'Paid', serial: 'RM-2398', vehicle: 'DEMO-102', owner: 'Company Owned' },
    { n: 5, days: -5, sup: IDS.supPine, rm: IDS.rmRiceHusk, rmName: 'Rice Husk', kg: 5000, rate: 3.05, pay: 'Paid', rmPay: 'Paid', trPay: 'Paid', serial: 'RM-2397', vehicle: 'PB-3302', owner: 'Pinecrest Biomass' },
    { n: 6, days: -6, sup: IDS.supOak, rm: IDS.rmBinder, rmName: 'Binder', kg: 400, rate: 18.5, pay: 'Pending', rmPay: 'Pending', trPay: 'Paid', serial: 'RM-2396', vehicle: 'DEMO-101', owner: 'Company Owned' },
    { n: 7, days: -8, sup: IDS.supRiver, rm: IDS.rmSawDust, rmName: 'Saw Dust', kg: 7500, rate: 3.75, pay: 'Paid', rmPay: 'Paid', trPay: 'Paid', serial: 'RM-2395', vehicle: 'RB-1190', owner: 'Riverbend Sawmill' },
    { n: 8, days: -10, sup: IDS.supOak, rm: IDS.rmWoodLog, rmName: 'Wood Log', kg: 11000, rate: 4.25, pay: 'Pending', rmPay: 'Pending', trPay: 'Pending', serial: 'RM-2394', vehicle: 'SH-4401', owner: 'Summit Haulage' },
  ]

  const raw_material_purchases = purchaseSpecs.map(s => {
    const qty = s.kg
    const rmAmt = qty * s.rate
    const loading = 1200
    const unloading = 800
    const transport = s.owner === 'Company Owned' ? 0 : 4500
    const total = rmAmt + loading + unloading + transport
    return {
      id: purchId(s.n),
      plant_id: IDS.plant,
      date: d(s.days),
      serial_no: s.serial,
      supplier_id: s.sup,
      supplier_name: suppliers.find(x => x.id === s.sup)?.name,
      vehicle_number: s.vehicle,
      tractor_owner: s.owner,
      transporter_id: s.owner.includes('Summit') ? IDS.trSummit : s.owner.includes('Lakeside') ? IDS.trLakeside : null,
      raw_material_type: s.rmName,
      raw_material_type_id: s.rm,
      quantity_kg: qty,
      net_weight: qty,
      deduction_kg: 0,
      rate_per_kg: s.rate,
      loading_expense: loading,
      unloading_expense: unloading,
      transport_expense: transport,
      other_expense: 0,
      moisture_percent: 12.5,
      total_rm_amount: rmAmt,
      total_amount: total,
      avg_cost_per_kg: total / qty,
      payment_status: s.pay,
      rm_payment_status: s.rmPay,
      transport_payment_status: s.trPay,
      katta_parchi_url: null,
      remarks: 'Demo sample purchase',
      created_by: IDS.empSam,
      employee_id: IDS.empSam,
      purchase_time: '10:15:00',
      created_at: isoDaysAgo(-s.days, 10),
      updated_at: isoDaysAgo(-s.days, 11),
      is_deleted: false,
      plot_id: IDS.plotYard,
    }
  })

  const spare_parts = [
    { id: IDS.partBearing, org_id: IDS.org, name: 'SKF 6310 Bearing', part_number: 'SKF-6310', category: 'Bearing', unit: 'pcs', brand: 'SKF', notes: 'Pellet mill main shaft', is_active: true, min_stock_level: 4 },
    { id: IDS.partBelt, org_id: IDS.org, name: 'Dryer Drive Belt C-224', part_number: 'C-224', category: 'Belt', unit: 'pcs', brand: 'Fenner', notes: 'Rotary dryer', is_active: true, min_stock_level: 2 },
    { id: IDS.partFilter, org_id: IDS.org, name: 'Generator Oil Filter', part_number: 'GEN-OF-250', category: 'Filter', unit: 'pcs', brand: 'Fleetguard', notes: null, is_active: true, min_stock_level: 3 },
    { id: IDS.partDie, org_id: IDS.org, name: 'Pellet Die 6mm', part_number: 'DIE-6MM', category: 'Other', unit: 'pcs', brand: 'CPM', notes: 'Grade A mill', is_active: true, min_stock_level: 1 },
    { id: IDS.partOil, org_id: IDS.org, name: 'Gearbox Oil ISO 320', part_number: 'OIL-320', category: 'Hydraulic', unit: 'litres', brand: 'Shell', notes: null, is_active: true, min_stock_level: 20 },
    { id: IDS.partCoupling, org_id: IDS.org, name: 'Hammer Mill Coupling', part_number: 'CPL-HM-01', category: 'Coupling', unit: 'set', brand: 'Lovejoy', notes: null, is_active: true, min_stock_level: 1 },
    { id: IDS.partSensor, org_id: IDS.org, name: 'Temperature Sensor PT100', part_number: 'PT100-D', category: 'Sensor', unit: 'pcs', brand: 'Omron', notes: 'Dryer outlet', is_active: true, min_stock_level: 2 },
    { id: IDS.partMotor, org_id: IDS.org, name: 'Fan Motor 15 HP', part_number: 'MTR-15HP', category: 'Motor', unit: 'pcs', brand: 'ABB', notes: 'Spare for dryer fan', is_active: true, min_stock_level: 1 },
  ]

  const spare_parts_plant_config = [
    { id: 'a0000001-d000-4000-8000-00000000b001', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partBearing, min_stock_level: 4 },
    { id: 'a0000001-d000-4000-8000-00000000b002', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partBelt, min_stock_level: 2 },
    { id: 'a0000001-d000-4000-8000-00000000b003', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partFilter, min_stock_level: 3 },
    { id: 'a0000001-d000-4000-8000-00000000b004', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partDie, min_stock_level: 1 },
    { id: 'a0000001-d000-4000-8000-00000000b005', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partOil, min_stock_level: 20 },
    { id: 'a0000001-d000-4000-8000-00000000b006', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partCoupling, min_stock_level: 1 },
    { id: 'a0000001-d000-4000-8000-00000000b007', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partSensor, min_stock_level: 2 },
    { id: 'a0000001-d000-4000-8000-00000000b008', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partMotor, min_stock_level: 1 },
  ]

  const spare_parts_suppliers = [
    { id: IDS.spSupMech, org_id: IDS.org, name: 'MechParts Demo Supply', contact_person: 'Drew Kline', phone: '+1-555-0190', is_active: true },
    { id: IDS.spSupElec, org_id: IDS.org, name: 'Volt & Gear Distributors', contact_person: 'Avery Shah', phone: '+1-555-0191', is_active: true },
  ]

  const spare_parts_purchases = [
    { id: 'a0000001-d000-4000-8000-00000000c001', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partBearing, supplier_id: IDS.spSupMech, quantity: 8, rate_per_unit: 1850, total_amount: 14800, purchase_date: d(-12), bill_number: 'BL-110', purchased_by: 'Jordan Admin', gst_percent: 18, gst_amount: 2664, grand_total: 17464 },
    { id: 'a0000001-d000-4000-8000-00000000c002', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partBelt, supplier_id: IDS.spSupMech, quantity: 3, rate_per_unit: 2400, total_amount: 7200, purchase_date: d(-20), bill_number: 'BL-108', purchased_by: 'Sam Supervisor', gst_percent: 18, gst_amount: 1296, grand_total: 8496 },
    { id: 'a0000001-d000-4000-8000-00000000c003', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partFilter, supplier_id: IDS.spSupMech, quantity: 6, rate_per_unit: 420, total_amount: 2520, purchase_date: d(-8), bill_number: 'BL-112', purchased_by: 'Alex Operator', gst_percent: 18, gst_amount: 453.6, grand_total: 2973.6 },
    { id: 'a0000001-d000-4000-8000-00000000c004', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partOil, supplier_id: IDS.spSupMech, quantity: 40, rate_per_unit: 310, total_amount: 12400, purchase_date: d(-15), bill_number: 'BL-109', purchased_by: 'Jordan Admin', gst_percent: 18, gst_amount: 2232, grand_total: 14632 },
    { id: 'a0000001-d000-4000-8000-00000000c005', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partSensor, supplier_id: IDS.spSupElec, quantity: 4, rate_per_unit: 980, total_amount: 3920, purchase_date: d(0), bill_number: 'BL-115', purchased_by: 'Sam Supervisor', gst_percent: 18, gst_amount: 705.6, grand_total: 4625.6 },
    { id: 'a0000001-d000-4000-8000-00000000c006', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partDie, supplier_id: IDS.spSupMech, quantity: 1, rate_per_unit: 18500, total_amount: 18500, purchase_date: d(-30), bill_number: 'BL-101', purchased_by: 'Jordan Admin', gst_percent: 18, gst_amount: 3330, grand_total: 21830 },
    { id: 'a0000001-d000-4000-8000-00000000c007', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partMotor, supplier_id: IDS.spSupElec, quantity: 1, rate_per_unit: 22000, total_amount: 22000, purchase_date: d(-40), bill_number: 'BL-098', purchased_by: 'Jordan Admin', gst_percent: 18, gst_amount: 3960, grand_total: 25960 },
  ]

  const spare_parts_usage = [
    { id: 'a0000001-d000-4000-8000-00000000d001', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partBearing, quantity: 2, usage_date: d(-6), used_by: 'Alex Operator', notes: 'Pellet Mill 1' },
    { id: 'a0000001-d000-4000-8000-00000000d002', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partBelt, quantity: 2, usage_date: d(-2), used_by: 'Sam Supervisor', notes: 'Dryer tracking' },
    { id: 'a0000001-d000-4000-8000-00000000d003', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partFilter, quantity: 1, usage_date: d(0), used_by: 'Alex Operator', notes: 'Generator service' },
    { id: 'a0000001-d000-4000-8000-00000000d004', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partOil, quantity: 8, usage_date: d(-4), used_by: 'Alex Operator', notes: 'Gearbox top-up' },
    { id: 'a0000001-d000-4000-8000-00000000d005', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partSensor, quantity: 1, usage_date: d(-9), used_by: 'Sam Supervisor', notes: 'Dryer outlet' },
  ]

  const spare_parts_reorder_requests = [
    { id: 'a0000001-d000-4000-8000-00000000e001', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partBelt, status: 'pending', requested_by: 'Sam Supervisor', requested_at: isoDaysAgo(1, 9), notes: 'Second spare after dryer tracking issue' },
    { id: 'a0000001-d000-4000-8000-00000000e002', org_id: IDS.org, plant_id: IDS.plant, part_id: IDS.partOil, status: 'ordered', requested_by: 'Alex Operator', requested_at: isoDaysAgo(5, 11), ordered_by: 'Jordan Admin', ordered_at: isoDaysAgo(4, 15), expected_delivery_date: d(2), supplier_name: 'MechParts Demo Supply', notes: null },
  ]

  const tasks = [
    { id: taskId(1), org_id: IDS.org, plant_id: IDS.plant, title: 'Check dryer belt tension before Shift A', due_date: today, assigned_to_employee_id: IDS.empAlex, assigned_by_employee_id: IDS.empJordan, status: 'open', completion_note: null, created_at: isoDaysAgo(0, 7), done_at: null, closed_at: null },
    { id: taskId(2), org_id: IDS.org, plant_id: IDS.plant, title: 'Follow up loader hydraulic hose', due_date: d(1), assigned_to_employee_id: IDS.empSam, assigned_by_employee_id: IDS.empJordan, status: 'open', completion_note: null, created_at: isoDaysAgo(3, 8), done_at: null, closed_at: null },
    { id: taskId(3), org_id: IDS.org, plant_id: IDS.plant, title: 'Reorder gearbox oil ISO 320', due_date: d(-1), assigned_to_employee_id: IDS.empAlex, assigned_by_employee_id: IDS.empSam, status: 'done', completion_note: 'PO sent to MechParts Demo Supply', created_at: isoDaysAgo(5, 10), done_at: isoDaysAgo(4, 16), closed_at: null },
    { id: taskId(4), org_id: IDS.org, plant_id: IDS.plant, title: 'Calibrate weighbridge weekly check', due_date: d(2), assigned_to_employee_id: IDS.empSam, assigned_by_employee_id: IDS.empJordan, status: 'open', completion_note: null, created_at: isoDaysAgo(1, 9), done_at: null, closed_at: null },
    { id: taskId(5), org_id: IDS.org, plant_id: IDS.plant, title: 'Update Grade A bag stencil count', due_date: d(-2), assigned_to_employee_id: IDS.empAlex, assigned_by_employee_id: IDS.empSam, status: 'closed', completion_note: 'Stencil inventory updated', created_at: isoDaysAgo(6, 12), done_at: isoDaysAgo(3, 11), closed_at: isoDaysAgo(2, 18) },
    { id: taskId(6), org_id: IDS.org, plant_id: IDS.plant, title: 'Northwind weekly schedule confirm', due_date: d(3), assigned_to_employee_id: IDS.empSam, assigned_by_employee_id: IDS.empJordan, status: 'open', completion_note: null, created_at: isoDaysAgo(0, 8), done_at: null, closed_at: null },
    { id: taskId(7), org_id: IDS.org, plant_id: IDS.plant, title: 'Clean cyclone after rice husk fines', due_date: today, assigned_to_employee_id: IDS.empAlex, assigned_by_employee_id: IDS.empSam, status: 'open', completion_note: null, created_at: isoDaysAgo(1, 19), done_at: null, closed_at: null },
  ]

  const attendance = [
    { id: 'a0000001-d000-4000-8000-00000000f001', plant_id: IDS.plant, employee_id: IDS.empSam, work_date: today, status: 'present', check_in: '07:50:00', check_out: null },
    { id: 'a0000001-d000-4000-8000-00000000f002', plant_id: IDS.plant, employee_id: IDS.empAlex, work_date: today, status: 'present', check_in: '07:55:00', check_out: null },
    { id: 'a0000001-d000-4000-8000-00000000f003', plant_id: IDS.plant, employee_id: IDS.empSam, work_date: d(-1), status: 'present', check_in: '07:48:00', check_out: '20:10:00' },
    { id: 'a0000001-d000-4000-8000-00000000f004', plant_id: IDS.plant, employee_id: IDS.empAlex, work_date: d(-1), status: 'present', check_in: '19:40:00', check_out: '08:05:00' },
  ]

  const delete_requests = []
  const notification_preferences = []
  const push_subscriptions = []
  const stock_transfers = []
  const assets = []
  const asset_events = []
  const shift_mix_machine_usage = []

  return {
    organizations,
    plants,
    employees,
    roles,
    machines,
    equipment,
    pellet_types,
    raw_material_types,
    customers,
    suppliers,
    transporters,
    vehicles,
    transporter_vehicles,
    storage_plots,
    process_routes,
    process_route_stages,
    shift_reports,
    machine_production,
    raw_material_usage,
    pellet_stock,
    diesel_stock,
    diesel_purchases,
    equipment_diesel_log,
    issues,
    shift_mixes,
    shift_mix_compositions,
    shift_mix_machine_usage,
    processing_runs,
    raw_material_purchases,
    vehicle_dispatches,
    dispatch_pellets,
    spare_parts,
    spare_parts_plant_config,
    spare_parts_suppliers,
    spare_parts_purchases,
    spare_parts_usage,
    spare_parts_reorder_requests,
    tasks,
    attendance,
    delete_requests,
    notification_preferences,
    push_subscriptions,
    stock_transfers,
    assets,
    asset_events,
  }
}
