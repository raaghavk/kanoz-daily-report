import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, requireCaller } from '../_shared/callerAuth.ts'

/**
 * Sheet / MIS pull. Live Apps Script and IMPORTDATA used this function with
 * verify_jwt=false and NO auth, via the service role — anyone who knew the
 * URL could dump every plant. Auth is now:
 *
 *   1. Header `x-sheet-sync-secret` matching secret SHEET_SYNC_SECRET, or
 *   2. A logged-in employee JWT (scoped to that employee's org).
 *
 * Keep verify_jwt=false so the gateway does not demand a user JWT; this
 * function enforces the secret itself. The anon key may still be sent as
 * `apikey` (Supabase gateway) but it is not sufficient on its own.
 *
 * Query params (unchanged from the live CSV contract):
 *   plant, date, format=json|csv, section=kpis|production|raw_material|dispatch|raw_stock|pellet_stock
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sheet-sync-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

type NumMap = Record<string, number>
type AdminClient = ReturnType<typeof createClient>

function n(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function s(value: unknown): string {
  return value == null ? '' : String(value)
}

function add(map: NumMap, key: string, value: number) {
  const k = key || 'Unspecified'
  map[k] = (map[k] || 0) + value
}

function sortedObject(map: NumMap) {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, quantity]) => ({ type, quantity }))
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

function emptyCsv(headers: string[], message = 'No data for selected plant/date'): string {
  return csv([headers, [message]])
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i]
  return out === 0
}

async function sha256(text: string): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return new Uint8Array(buf)
}

/** Hash-then-compare so length of the secret is not leaked in timing. */
async function secretHeaderMatches(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)])
  return bytesEqual(a, b)
}

function providedSheetSecret(req: Request): string {
  const header = req.headers.get('x-sheet-sync-secret')?.trim() || ''
  if (header) return header
  const auth = req.headers.get('Authorization') || ''
  const m = /^Bearer\s+(\S+)/i.exec(auth)
  return m?.[1]?.trim() || ''
}

async function authorize(req: Request): Promise<
  { admin: AdminClient; orgId: string | null } | Response
> {
  const expected = Deno.env.get('SHEET_SYNC_SECRET') || ''
  if (!expected) {
    return jsonResponse({ error: 'SHEET_SYNC_SECRET is not configured' }, 503)
  }

  if (await secretHeaderMatches(providedSheetSecret(req), expected)) {
    return {
      admin: createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
      orgId: null,
    }
  }

  const caller = await requireCaller(req)
  if (caller instanceof Response) return caller
  return { admin: caller.admin, orgId: caller.employee.org_id }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const auth = await authorize(req)
    if (auth instanceof Response) {
      const body = await auth.text()
      return new Response(body, { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const { admin: supabase, orgId } = auth

    const url = new URL(req.url)
    let selectedPlant = url.searchParams.get('plant')?.trim() || ''
    let selectedDate = url.searchParams.get('date')?.trim() || ''
    let format = url.searchParams.get('format')?.trim().toLowerCase() || 'json'
    let section = url.searchParams.get('section')?.trim().toLowerCase() || ''

    if (req.method === 'POST') {
      try {
        const body = await req.json() as {
          plant?: string; date?: string; format?: string; section?: string; plantId?: string
        }
        if (body?.plant) selectedPlant = body.plant.trim()
        if (body?.date) selectedDate = body.date.trim()
        if (body?.format) format = body.format.trim().toLowerCase()
        if (body?.section) section = body.section.trim().toLowerCase()
      } catch { /* GET or empty body */ }
    }

    let plantQuery = supabase.from('plants').select('id,name,org_id').eq('is_active', true)
    if (orgId) plantQuery = plantQuery.eq('org_id', orgId)
    if (selectedPlant) plantQuery = plantQuery.eq('name', selectedPlant)
    const { data: plantRows, error: plantErr } = await plantQuery
    if (plantErr) throw new Error(`Plants: ${plantErr.message}`)

    const plantIds = (plantRows || []).map((p: { id: string }) => p.id)
    if (selectedPlant && plantIds.length === 0) {
      return jsonResponse({ error: 'Plant not found' }, 404)
    }
    // Secret + no plant: same as live (no plant_id filter). JWT always scoped to org.
    const restrictToIds = Boolean(selectedPlant || orgId)
    const scopedIds = plantIds.length ? plantIds : ['00000000-0000-0000-0000-000000000000']
    const filterPlant = (query: any, column = 'plant_id') =>
      restrictToIds ? query.in(column, scopedIds) : query

    let machineQuery = supabase
      .from('machines')
      .select('id,name,sort_order,is_active,plants(name)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    // JWT: hide other orgs' machine names. Secret: keep live (all machines) so CSV headers stay stable.
    if (orgId) machineQuery = filterPlant(machineQuery)
    const { data: machines, error: mErr } = await machineQuery
    if (mErr) throw new Error(`Machines: ${mErr.message}`)

    const { data: purchases, error: pErr } = await filterPlant(
      supabase
        .from('raw_material_purchases')
        .select(`
          id, date, serial_no, vehicle_number,
          plants(name), suppliers(name), raw_material_types(name), raw_material_type,
          quantity_kg, rate_per_kg,
          loading_expense, unloading_expense, transport_expense, other_expense,
          total_rm_amount, total_amount, avg_cost_per_kg, is_deleted
        `)
        .eq('is_deleted', false)
        .order('date', { ascending: false }),
    )
    if (pErr) throw new Error(`Purchases: ${pErr.message}`)

    const { data: dispatches, error: dErr } = await filterPlant(
      supabase
        .from('vehicle_dispatches')
        .select(`
          id, date, loading_date, dispatch_date,
          plants(name), customers(name), destination,
          truck_number, driver_name, driver_phone, invoice_no,
          loading_time, dispatch_time, remarks, is_deleted,
          dispatch_pellets(pellet_type_name, quantity_mt)
        `)
        .eq('is_deleted', false)
        .order('date', { ascending: false }),
    )
    if (dErr) throw new Error(`Dispatches: ${dErr.message}`)

    const { data: shiftData, error: sErr } = await filterPlant(
      supabase
        .from('shift_reports')
        .select(`
          id, date, shift, pellet_production_mt, is_deleted,
          plants(name),
          machine_production(production_mt, machines(name)),
          raw_material_usage(quantity_kg, raw_material_types(name)),
          pellet_stock(production_mt, dispatch_mt, wastage_mt, pellet_types(name))
        `)
        .eq('is_deleted', false)
        .order('date', { ascending: false }),
    )
    if (sErr) throw new Error(`Shifts: ${sErr.message}`)

    const purchaseRows = (purchases || []).map((p: any) => {
      const qty = n(p.quantity_kg)
      const total = n(p.total_amount)
      const avg = n(p.avg_cost_per_kg) || (qty ? total / qty : 0)
      return {
        id: s(p.id), date: p.date, serial_no: s(p.serial_no), vehicle_number: s(p.vehicle_number),
        plant: s(p.plants?.name), supplier: s(p.suppliers?.name), rm_type: s(p.raw_material_types?.name || p.raw_material_type),
        quantity_kg: qty, rate_per_kg: n(p.rate_per_kg), loading_expense: n(p.loading_expense),
        unloading_expense: n(p.unloading_expense), transport_expense: n(p.transport_expense), other_expense: n(p.other_expense),
        total_rm_amount: n(p.total_rm_amount), total_amount: total, avg_cost_per_kg: avg,
      }
    })

    const dispatchRows: any[] = []
    for (const d of (dispatches || [])) {
      const base = {
        date: d.date, loading_date: d.loading_date || d.date, dispatch_date: d.dispatch_date || d.date,
        plant: s(d.plants?.name), customer: s(d.customers?.name), destination: s(d.destination),
        truck_number: s(d.truck_number), driver_name: s(d.driver_name), driver_phone: s(d.driver_phone),
        invoice_no: s(d.invoice_no), loading_time: s(d.loading_time), dispatch_time: s(d.dispatch_time), remarks: s(d.remarks),
      }
      const pellets = d.dispatch_pellets || []
      if (!pellets.length) dispatchRows.push({ id: `${d.id}_0`, ...base, pellet_type: '', quantity_mt: 0 })
      for (let i = 0; i < pellets.length; i++) {
        dispatchRows.push({ id: `${d.id}_${i}`, ...base, pellet_type: s(pellets[i].pellet_type_name), quantity_mt: n(pellets[i].quantity_mt) })
      }
    }

    const machineNames = (machines || []).map((m: any) => s(m.name).trim()).filter(Boolean)
    const productionRows = (shiftData || []).map((shift: any) => {
      const machineTotals: NumMap = {}
      for (const mp of (shift.machine_production || [])) {
        const name = s(mp.machines?.name).trim()
        if (name) add(machineTotals, name, n(mp.production_mt))
      }
      return {
        shift_id: s(shift.id), date: shift.date, shift: s(shift.shift), plant: s(shift.plants?.name), total_mt: n(shift.pellet_production_mt),
        machines: Object.entries(machineTotals).map(([name, production_mt]) => ({ name, production_mt })),
        machine_totals: machineTotals,
      }
    })

    const daily = { production: [] as any[], raw_material: [] as any[], dispatch: [] as any[] }
    const rawStock: NumMap = {}
    const pelletStock: NumMap = {}

    for (const p of purchaseRows) {
      if (!selectedDate || p.date === selectedDate) daily.raw_material.push(p)
      if (!selectedDate || p.date <= selectedDate) add(rawStock, p.rm_type, p.quantity_kg)
    }

    for (const shift of (shiftData || [])) {
      if (!selectedDate || shift.date === selectedDate) daily.production.push(productionRows.find((r) => r.shift_id === s(shift.id)))
      for (const usage of (shift.raw_material_usage || [])) {
        if (!selectedDate || shift.date <= selectedDate) add(rawStock, s(usage.raw_material_types?.name), -n(usage.quantity_kg))
      }
      for (const ps of (shift.pellet_stock || [])) {
        if (!selectedDate || shift.date <= selectedDate) add(pelletStock, s(ps.pellet_types?.name), n(ps.production_mt) - n(ps.dispatch_mt) - n(ps.wastage_mt))
      }
    }

    for (const d of dispatchRows) {
      if (!selectedDate || d.date === selectedDate || d.dispatch_date === selectedDate) daily.dispatch.push(d)
    }

    if (format === 'csv') {
      let body = ''
      if (section === 'kpis') {
        const production = daily.production.reduce((sum, row) => sum + n(row?.total_mt), 0)
        const rmQty = daily.raw_material.reduce((sum, row) => sum + n(row.quantity_kg), 0)
        const rmAmount = daily.raw_material.reduce((sum, row) => sum + n(row.total_amount), 0)
        const dispatch = daily.dispatch.reduce((sum, row) => sum + n(row.quantity_mt), 0)
        body = csv([['Production MT', 'RM Qty kg', 'RM Amount', 'Dispatch MT'], [production, rmQty, rmAmount, dispatch]])
      } else if (section === 'production') {
        const headers = ['Date', 'Shift', 'Plant', 'Total MT', ...machineNames.map((name) => `${name} MT`)]
        const rows = daily.production.map((row) => [row.date, row.shift, row.plant, row.total_mt, ...machineNames.map((name) => n(row.machine_totals?.[name]))])
        body = rows.length ? csv([headers, ...rows]) : emptyCsv(headers)
      } else if (section === 'raw_material') {
        const headers = ['Date', 'Supplier', 'RM Type', 'Qty kg', 'Rate/kg', 'Total Amount', 'Average/kg']
        const rows = daily.raw_material.map((row) => [row.date, row.supplier, row.rm_type, row.quantity_kg, row.rate_per_kg, row.total_amount, row.avg_cost_per_kg])
        body = rows.length ? csv([headers, ...rows]) : emptyCsv(headers)
      } else if (section === 'dispatch') {
        const headers = ['Date', 'Customer', 'Destination', 'Pellet Type', 'Qty MT', 'Truck', 'Invoice']
        const rows = daily.dispatch.map((row) => [row.dispatch_date || row.date, row.customer, row.destination, row.pellet_type, row.quantity_mt, row.truck_number, row.invoice_no])
        body = rows.length ? csv([headers, ...rows]) : emptyCsv(headers)
      } else if (section === 'raw_stock') {
        const headers = ['Raw Material', 'Available kg']
        const rows = sortedObject(rawStock).map((row) => [row.type, row.quantity])
        body = rows.length ? csv([headers, ...rows]) : emptyCsv(headers, 'No cumulative raw material stock')
      } else if (section === 'pellet_stock') {
        const headers = ['Pellet Type', 'Available MT']
        const rows = sortedObject(pelletStock).map((row) => [row.type, row.quantity])
        body = rows.length ? csv([headers, ...rows]) : emptyCsv(headers, 'No cumulative pellet stock')
      } else {
        body = csv([['error'], ['Unknown CSV section']])
      }
      return new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=utf-8' } })
    }

    return new Response(JSON.stringify({
      purchases: purchaseRows,
      dispatches: dispatchRows,
      production: productionRows,
      machines: machineNames,
      dashboard: {
        filters: { plant: selectedPlant, date: selectedDate },
        daily,
        cumulative: { raw_material: sortedObject(rawStock), pellets: sortedObject(pelletStock) },
      },
      generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('get-sheet-data error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
