import { describe, it, expect, beforeEach } from 'vitest'
import { createDemoClient, resetDemoStore, getDemoStore } from '../client'
import { parseSelect, resolveRelation } from '../relations'
import { DEMO_EMAIL, DEMO_ADMIN_NAME, DEMO_ORG_NAME } from '../mode'
import { IDS } from '../ids'

describe('parseSelect', () => {
  it('parses star and nested embeds with aliases and hints', () => {
    const parsed = parseSelect('*, dispatch_pellets(*, pellet_types(name)), customers(name, address)')
    expect(parsed.star).toBe(true)
    expect(parsed.embeds.map(e => e.alias)).toEqual(['dispatch_pellets', 'customers'])
    expect(parsed.embeds[0].inner.embeds[0].alias).toBe('pellet_types')
  })

  it('parses FK hint aliases used by shift reports', () => {
    const parsed = parseSelect('*, plants(name), employees!supervisor_id(name), creator:employees!created_by(name)')
    expect(parsed.embeds.find(e => e.alias === 'creator').hint).toBe('created_by')
    expect(parsed.embeds.find(e => e.table === 'employees' && e.hint === 'supervisor_id')).toBeTruthy()
  })
})

describe('resolveRelation', () => {
  it('maps tasks assignee alias to assigned_to_employee_id', () => {
    const rel = resolveRelation('tasks', { alias: 'assignee', table: 'employees', hint: 'tasks_assigned_to_employee_id_fkey' })
    expect(rel.local).toBe('assigned_to_employee_id')
    expect(rel.table).toBe('employees')
  })
})

describe('demo supabase adapter', () => {
  let supabase

  beforeEach(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    resetDemoStore()
    supabase = createDemoClient()
  })

  it('rejects non-demo emails and accepts any password for the demo user', async () => {
    const bad = await supabase.auth.signInWithPassword({ email: 'other@example.com', password: 'x' })
    expect(bad.error).toBeTruthy()
    const ok = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: 'anything' })
    expect(ok.error).toBeNull()
    expect(ok.data.user.email).toBe(DEMO_EMAIL)
    const { data: { session } } = await supabase.auth.getSession()
    expect(session.user.id).toBe(IDS.authJordan)
    expect(session.user.user_metadata.name).toBe(DEMO_ADMIN_NAME)
  })

  it('loads Rohan Sharma with nested plant for AuthContext', async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*, plants(*)')
      .eq('auth_user_id', IDS.authJordan)
      .single()
    expect(error).toBeNull()
    expect(data.name).toBe(DEMO_ADMIN_NAME)
    expect(data.role).toBe('admin')
    expect(data.plants.name).toMatch(/Gorakhpur/i)
    expect(data.plants.name).toMatch(/Riverside Demo Plant/i)
  })

  it('returns enough shift reports, dispatches, purchases, parts, and tasks', async () => {
    const reports = await supabase.from('shift_reports').select('id, date, pellet_production_mt, issues(id)').eq('is_deleted', false)
    const dispatches = await supabase.from('vehicle_dispatches').select('*, dispatch_pellets(*), customers(name)').eq('is_deleted', false)
    const purchases = await supabase.from('raw_material_purchases').select('*, suppliers(name), raw_material_types(name)').eq('is_deleted', false)
    const parts = await supabase.from('spare_parts').select('*').eq('is_active', true)
    const tasks = await supabase.from('tasks').select('id, title, status, assignee:employees!tasks_assigned_to_employee_id_fkey(name)')

    expect(reports.data.length).toBeGreaterThanOrEqual(5)
    expect(dispatches.data.length).toBeGreaterThanOrEqual(5)
    expect(dispatches.data[0].dispatch_pellets.length).toBeGreaterThan(0)
    expect(dispatches.data[0].customers?.name).toBeTruthy()
    expect(purchases.data.length).toBeGreaterThanOrEqual(8)
    expect(['Paid', 'Pending']).toContain(purchases.data[0].payment_status)
    expect(parts.data.length).toBeGreaterThanOrEqual(8)
    expect(tasks.data.length).toBeGreaterThanOrEqual(5)
    expect(tasks.data[0].assignee?.name).toBeTruthy()
  })

  it('supports count head queries used by the home dashboard', async () => {
    const { count, data } = await supabase
      .from('vehicle_dispatches')
      .select('id', { count: 'exact', head: true })
      .eq('plant_id', IDS.plant)
      .eq('is_deleted', false)
    expect(data).toBeNull()
    expect(count).toBeGreaterThanOrEqual(5)
  })

  it('filters with or() for live rows', async () => {
    const { data } = await supabase
      .from('shift_reports')
      .select('id')
      .eq('plant_id', IDS.plant)
      .or('is_deleted.is.null,is_deleted.eq.false')
    expect(data.length).toBe(getDemoStore().shift_reports.length)
  })

  it('answers insights from sample seed and never claims Gemini', async () => {
    const ai = await supabase.functions.invoke('ai-query', { body: { question: 'Pending payments' } })
    expect(ai.error).toBeNull()
    expect(ai.data.answer).toMatch(/sample data only/i)
    expect(ai.data.answer).toMatch(/Pending/i)
    const weather = await supabase.functions.invoke('plant-chat', { body: { question: 'will it rain tomorrow' } })
    expect(weather.data.answer).toMatch(/weather is turned off/i)
  })

  it('persists in-memory updates (mark purchase paid)', async () => {
    const { data: first } = await supabase.from('raw_material_purchases').select('id').limit(1)
    const id = first[0].id
    await supabase.from('raw_material_purchases').update({ payment_status: 'Paid' }).eq('id', id)
    const { data } = await supabase.from('raw_material_purchases').select('payment_status').eq('id', id).single()
    expect(data.payment_status).toBe('Paid')
  })

  it('seeds attendance with check_in_at, fictional GPS, labour roster, assets, finance, and transfers', async () => {
    const att = await supabase.from('attendance').select('check_in_at, check_out_at, status, hours, check_in_lat').eq('plant_id', IDS.plant)
    expect(att.data.length).toBeGreaterThanOrEqual(5)
    expect(att.data.every(r => r.check_in_at)).toBe(true)
    expect(att.data[0].check_in_lat).toBeCloseTo(0.0123, 4)

    const people = await supabase.from('employees').select('name, worker_type, labour_daily_wage, role')
    expect(people.data.some(e => e.worker_type === 'labour')).toBe(true)
    expect(people.data.some(e => e.worker_type === 'driver')).toBe(true)
    expect(people.data.some(e => e.role === 'plant_manager')).toBe(true)

    const assets = await supabase.from('assets').select('code, status')
    expect(assets.data.length).toBeGreaterThanOrEqual(5)
    expect(assets.data.some(a => a.code === 'MTR-0001')).toBe(true)
    expect(assets.data.some(a => a.status === 'in_repair')).toBe(true)

    const events = await supabase.from('asset_events').select('event_type')
    expect(events.data.some(e => e.event_type === 'sent_vendor')).toBe(true)

    const costs = await supabase.from('finance_costs').select('*').eq('is_deleted', false)
    expect(costs.data.length).toBeGreaterThanOrEqual(5)

    const transfers = await supabase.from('stock_transfers').select('*').eq('is_deleted', false)
    expect(transfers.data.length).toBeGreaterThanOrEqual(2)

    const plant = await supabase.from('plants').select('location_lat, electricity_rate_day').eq('id', IDS.plant).single()
    expect(plant.data.location_lat).toBeCloseTo(0.0123, 4)
    expect(plant.data.electricity_rate_day).toBe(7.9)
  })

  it('replaces shift report children via rpc so new/edit shift can persist', async () => {
    const reportId = getDemoStore().shift_reports[0].id
    const before = (await supabase.from('machine_production').select('id').eq('shift_report_id', reportId)).data.length
    expect(before).toBeGreaterThan(0)
    const { error } = await supabase.rpc('replace_shift_report_children', {
      p_report_id: reportId,
      p_payload: {
        machine_production: [{ machine_id: IDS.mPellet1, hours_run: 3, production_mt: 1.5, pellet_type_name: 'Grade A 6mm' }],
        mixes: [{
          plant_id: IDS.plant, org_id: IDS.org, name: 'Mix Demo', type: 'A',
          opening_kg: 0, prepared_kg: 100, used_kg: 80, closing_kg: 20,
          compositions: [{ raw_material_type_id: IDS.rmSawDust, raw_material_name: 'Saw Dust', quantity_kg: 100 }],
          machine_usages: [{ machine_id: IDS.mPellet1, quantity_kg: 80 }],
        }],
        raw_material_usage: [{ raw_material_type_id: IDS.rmSawDust, quantity_kg: 80, opening_kg: 18000, purchased_kg: 0, closing_kg: 17920 }],
        processing_runs: [],
        equipment_diesel_log: [],
        pellet_stock: [{ pellet_type_id: IDS.ptGradeA, opening_mt: 10, production_mt: 1.5, dispatch_mt: 0, wastage_mt: 0 }],
        issues: [{ issue_type: 'Mechanical', description: 'Sample issue from save', severity: 'low', photo_url: null, machine_id: IDS.mDryer }],
        diesel_stock: { opening_litres: 400, purchased_litres: 0, purchase_cost: 0, used_litres: 10, closing_litres: 390 },
        diesel_purchases: [],
      },
    })
    expect(error).toBeNull()
    const mp = await supabase.from('machine_production').select('*').eq('shift_report_id', reportId)
    expect(mp.data.length).toBe(1)
    expect(mp.data[0].production_mt).toBe(1.5)
    const mixes = await supabase.from('shift_mixes').select('*').eq('shift_report_id', reportId)
    expect(mixes.data.length).toBe(1)
    const comps = await supabase.from('shift_mix_compositions').select('*').eq('mix_id', mixes.data[0].id)
    expect(comps.data.length).toBe(1)
    const issues = await supabase.from('issues').select('description, machine_id').eq('shift_report_id', reportId)
    expect(issues.data[0].machine_id).toBe(IDS.mDryer)
  })

  it('stubs OCR and other paid edge functions', async () => {
    const ocr = await supabase.functions.invoke('extract-receipt', { body: {} })
    expect(ocr.error?.name).toBe('DemoModeError')
  })

  it('rejects duplicate purchase serials after stripping leading zeros', async () => {
    const row = {
      plant_id: IDS.plant,
      date: '2026-09-01',
      serial_no: '025194',
      supplier_name: 'Maharajganj Timber Traders',
      quantity_kg: 1000,
      rate_per_kg: 4,
      payment_status: 'Pending',
    }
    const first = await supabase.from('raw_material_purchases').insert(row).select().single()
    expect(first.error).toBeNull()
    const dup = await supabase.from('raw_material_purchases').insert({ ...row, serial_no: '25194' })
    expect(dup.error?.code).toBe('23505')
  })

  it('seeds Indian locale names, +91 phones, INR-style vehicles, and Gorakhpur plant', async () => {
    const db = getDemoStore()
    expect(db.organizations[0].name).toBe(DEMO_ORG_NAME)
    expect(db.plants[0].name).toMatch(/Gorakhpur/)
    expect(db.plants[0].address).toMatch(/Gorakhpur/)
    expect(db.plants[0].state).toBe('Uttar Pradesh')
    expect(db.employees.every(e => String(e.mobile).startsWith('+91'))).toBe(true)
    expect(db.employees.map(e => e.name)).toEqual(expect.arrayContaining([
      DEMO_ADMIN_NAME, 'Sandeep Yadav', 'Priya Singh', 'Ankit Tiwari', 'Neha Gupta', 'Raju', 'Munna',
    ]))
    expect(db.vehicles.some(v => v.number === 'UP53 AB 1234')).toBe(true)
    expect(db.transporter_vehicles.some(v => v.vehicle_number === 'UP53 EF 9012')).toBe(true)
    expect(db.customers.some(c => c.name === 'Purvanchal Agro Energy Pvt Ltd')).toBe(true)
    const blob = JSON.stringify(db)
    expect(blob).not.toMatch(/Acme/i)
    expect(blob).not.toMatch(/\+1-555/)
    expect(blob).not.toMatch(/Jordan Admin/)
    expect(blob).not.toMatch(/Oak Valley/)
    expect(blob).not.toMatch(/Northwind Biofuel/)
  })

  it('create+view: suppliers, purchases, customers, dispatch, stock, attendance, tasks, spares, assets, shifts', async () => {
    const { data: supplier, error: sErr } = await supabase.from('suppliers').insert({
      org_id: IDS.org, plant_id: IDS.plant, name: 'Faizabad Cane Trash Co-op',
      mobile: '+91 94152 77101', raw_material_type: 'Rice Husk', address: 'Ayodhya, Uttar Pradesh',
    }).select().single()
    expect(sErr).toBeNull()
    const listedSup = await supabase.from('suppliers').select('name').eq('name', 'Faizabad Cane Trash Co-op')
    expect(listedSup.data).toHaveLength(1)

    const { data: purchase, error: pErr } = await supabase.from('raw_material_purchases').insert({
      plant_id: IDS.plant, date: '2026-09-14', purchase_time: '11:30:00', serial_no: 'RM-2501',
      supplier_id: supplier.id, supplier_name: supplier.name, vehicle_number: 'UP42 XY 8899',
      raw_material_type: 'Rice Husk', raw_material_type_id: IDS.rmRiceHusk, quantity_kg: 2500,
      rate_per_kg: 3.2, payment_status: 'Pending',
    }).select().single()
    expect(pErr).toBeNull()
    expect(purchase.is_deleted).toBe(false)
    expect(purchase.quantity_kg).toBe(2500)
    const listedPur = await supabase.from('raw_material_purchases').select('serial_no').eq('serial_no', 'RM-2501').eq('is_deleted', false)
    expect(listedPur.data).toHaveLength(1)

    const { data: customer, error: cErr } = await supabase.from('customers').insert({
      org_id: IDS.org, name: 'Basti Boiler Works', mobile: '+91 94152 77102',
      address: 'Khalilabad Road, Basti, Uttar Pradesh', contact_person: 'Rakesh Pal',
    }).select().single()
    expect(cErr).toBeNull()
    expect(customer.is_active).toBe(true)

    const { data: transporter } = await supabase.from('transporters').insert({
      org_id: IDS.org, name: 'Saryu Roadlines', phone: '+91 94152 77103', address: 'Basti, Uttar Pradesh',
    }).select().single()
    const { data: dispatch, error: dErr } = await supabase.from('vehicle_dispatches').insert({
      plant_id: IDS.plant, truck_number: 'UP51 ZA 4422', customer_id: customer.id,
      destination: 'Basti Boiler Works', transporter: transporter.name, transporter_id: transporter.id,
      driver_name: 'Kallu', driver_phone: '+91 94152 77104', serial_no: 'DS-1100',
      date: '2026-09-14', dispatch_date: '2026-09-14',
    }).select().single()
    expect(dErr).toBeNull()
    await supabase.from('dispatch_pellets').insert({
      dispatch_id: dispatch.id, pellet_type_id: IDS.ptGradeA, pellet_type_name: 'Grade A 6mm', quantity_mt: 9,
    })
    const listedDisp = await supabase.from('vehicle_dispatches').select('*, dispatch_pellets(*), customers(name)').eq('id', dispatch.id).single()
    expect(listedDisp.data.customers.name).toBe('Basti Boiler Works')
    expect(listedDisp.data.dispatch_pellets[0].quantity_mt).toBe(9)

    const { data: transfer } = await supabase.from('stock_transfers').insert({
      plant_id: IDS.plant, from_plot_id: IDS.plotYard, to_plot_id: IDS.plotCovered,
      raw_material_type_id: IDS.rmSawDust, raw_material_name: 'Saw Dust',
      quantity_kg: 1500, transfer_date: '2026-09-14', vehicle_number: 'UP53 AB 1234',
    }).select().single()
    expect(transfer.is_deleted).toBe(false)
    const listedTr = await supabase.from('stock_transfers').select('id').eq('id', transfer.id).eq('is_deleted', false)
    expect(listedTr.data).toHaveLength(1)

    const { error: aErr } = await supabase.from('attendance').upsert({
      org_id: IDS.org, plant_id: IDS.plant, employee_id: IDS.empCasey,
      work_date: '2026-09-14', status: 'present', check_in_at: '2026-09-14T08:05:00.000Z',
      check_in_lat: 0.0123, check_in_lng: 0.0456,
    }, { onConflict: 'employee_id,work_date' })
    expect(aErr).toBeNull()
    const att = await supabase.from('attendance').select('status').eq('employee_id', IDS.empCasey).eq('work_date', '2026-09-14').single()
    expect(att.data.status).toBe('present')

    const { data: task } = await supabase.from('tasks').insert({
      org_id: IDS.org, plant_id: IDS.plant, title: 'Inspect pellet mill 2 die',
      due_date: '2026-09-15', assigned_to_employee_id: IDS.empAlex, assigned_by_employee_id: IDS.empJordan, status: 'open',
    }).select().single()
    const listedTask = await supabase.from('tasks').select('title, assignee:employees!tasks_assigned_to_employee_id_fkey(name)').eq('id', task.id).single()
    expect(listedTask.data.title).toMatch(/pellet mill 2/)
    expect(listedTask.data.assignee?.name).toBe('Amit Verma')

    const { data: part } = await supabase.from('spare_parts').insert({
      org_id: IDS.org, name: 'Pellet Mill Roller Shell', part_number: 'RLR-6MM', category: 'Other', unit: 'pcs',
    }).select().single()
    expect(part.is_active).toBe(true)
    const listedPart = await supabase.from('spare_parts').select('name').eq('id', part.id)
    expect(listedPart.data[0].name).toBe('Pellet Mill Roller Shell')

    const { data: asset } = await supabase.from('assets').insert({
      org_id: IDS.org, plant_id: IDS.plant, code: 'MTR-0002', asset_type: 'Motor',
      name: 'Spare Hammer Mill Motor', status: 'in_store', current_location: 'Main Store',
    }).select().single()
    expect(asset.is_active).toBe(true)
    await supabase.from('asset_events').insert({
      asset_id: asset.id, org_id: IDS.org, plant_id: IDS.plant, event_type: 'purchased',
      event_date: '2026-09-14', to_location: 'Main Store',
    })
    const listedAsset = await supabase.from('assets').select('code, name').eq('code', 'MTR-0002')
    expect(listedAsset.data).toHaveLength(1)
    const events = await supabase.from('asset_events').select('event_type').eq('asset_id', asset.id)
    expect(events.data.some(e => e.event_type === 'purchased')).toBe(true)

    const { data: report, error: rErr } = await supabase.from('shift_reports').insert({
      plant_id: IDS.plant, date: '2026-09-14', shift: 'B', start_time: '20:00:00', end_time: '08:00:00',
      pellet_production_mt: 4.2, supervisor_id: IDS.empSam, status: 'submitted',
    }).select().single()
    expect(rErr).toBeNull()
    expect(report.is_deleted).toBe(false)
    const { error: rpcErr } = await supabase.rpc('replace_shift_report_children', {
      p_report_id: report.id,
      p_payload: {
        machine_production: [{ machine_id: IDS.mPellet1, hours_run: 4, production_mt: 4.2, pellet_type_name: 'Grade A 6mm' }],
        mixes: [{
          plant_id: IDS.plant, org_id: IDS.org, name: 'Mix Night', type: 'A',
          opening_kg: 0, prepared_kg: 500, used_kg: 480, closing_kg: 20,
          compositions: [{ raw_material_type_id: IDS.rmSawDust, raw_material_name: 'Saw Dust', quantity_kg: 500 }],
          machine_usages: [{ machine_id: IDS.mPellet1, quantity_kg: 480 }],
        }],
        raw_material_usage: [], processing_runs: [], equipment_diesel_log: [],
        pellet_stock: [], issues: [], diesel_purchases: [],
      },
    })
    expect(rpcErr).toBeNull()
    const mixes = await supabase.from('shift_mixes').select('used_kg').eq('shift_report_id', report.id)
    expect(mixes.data[0].used_kg).toBe(480)
    const listedShift = await supabase.from('shift_reports').select('id, pellet_production_mt').eq('id', report.id).eq('is_deleted', false)
    expect(listedShift.data[0].pellet_production_mt).toBe(4.2)
  })
})
