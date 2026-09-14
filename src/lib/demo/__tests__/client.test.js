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
    expect(data.plants.name).toContain('Riverside')
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

  it('stubs paid AI/OCR edge functions', async () => {
    const ocr = await supabase.functions.invoke('extract-receipt', { body: {} })
    expect(ocr.error?.name).toBe('DemoModeError')
    const ai = await supabase.functions.invoke('ai-query', { body: { question: 'hello' } })
    expect(ai.error).toBeNull()
    expect(ai.data.answer).toMatch(/not available in demo/i)
  })

  it('persists in-memory updates (mark purchase paid)', async () => {
    const { data: first } = await supabase.from('raw_material_purchases').select('id').limit(1)
    const id = first[0].id
    await supabase.from('raw_material_purchases').update({ payment_status: 'Paid' }).eq('id', id)
    const { data } = await supabase.from('raw_material_purchases').select('payment_status').eq('id', id).single()
    expect(data.payment_status).toBe('Paid')
  })
})
