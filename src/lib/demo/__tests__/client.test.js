import { describe, it, expect, beforeEach } from 'vitest'
import { createDemoClient, resetDemoStore, getDemoStore } from '../client'
import { parseSelect, resolveRelation } from '../relations'
import { DEMO_EMAIL } from '../mode'
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
  })

  it('loads Jordan with nested plant for AuthContext', async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*, plants(*)')
      .eq('auth_user_id', IDS.authJordan)
      .single()
    expect(error).toBeNull()
    expect(data.name).toBe('Jordan Admin')
    expect(data.role).toBe('admin')
    expect(data.plants.name).toMatch(/Demo Bio Pellets/i)
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
})
