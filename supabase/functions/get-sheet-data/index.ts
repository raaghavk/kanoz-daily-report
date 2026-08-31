import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, jsonResponse, requireCaller, requirePlantAccess } from '../_shared/callerAuth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const caller = await requireCaller(req)
    if (caller instanceof Response) return caller

    let plantId = caller.employee.plant_id
    try {
      const body = await req.json() as { plantId?: string }
      if (body?.plantId) plantId = body.plantId
    } catch { /* GET or empty body: use caller's plant */ }

    const plant = await requirePlantAccess(caller.admin, caller.employee, plantId)
    if (plant instanceof Response) return plant

    const supabase = caller.admin
    const PLANT_ID = plant.id

    // ── Purchases ──
    const { data: purchases, error: pErr } = await supabase
      .from('raw_material_purchases')
      .select(`
        id, date, serial_no, vehicle_number,
        plants(name),
        suppliers(name),
        raw_material_types(name),
        quantity_kg, rate_per_kg,
        loading_expense, unloading_expense, transport_expense, other_expense,
        total_rm_amount, total_amount
      `)
      .eq('plant_id', PLANT_ID)
      .eq('is_deleted', false)
      .order('date', { ascending: false })

    if (pErr) throw new Error(`Purchases: ${pErr.message}`)

    // ── Dispatches ──
    const { data: dispatches, error: dErr } = await supabase
      .from('vehicle_dispatches')
      .select(`
        id, date, loading_date, dispatch_date,
        plants(name),
        customers(name),
        destination,
        truck_number, driver_name, driver_phone, invoice_no,
        loading_time, dispatch_time, remarks,
        dispatch_pellets(pellet_type_name, quantity_mt)
      `)
      .eq('plant_id', PLANT_ID)
      .eq('is_deleted', false)
      .order('date', { ascending: false })

    if (dErr) throw new Error(`Dispatches: ${dErr.message}`)

    // ── Shift Production ──
    const { data: shiftData, error: sErr } = await supabase
      .from('shift_reports')
      .select(`
        id, date, shift, pellet_production_mt,
        plants(name),
        machine_production(
          production_mt,
          machines(name)
        )
      `)
      .eq('plant_id', PLANT_ID)
      .eq('is_deleted', false)
      .order('date', { ascending: false })

    if (sErr) throw new Error(`Shifts: ${sErr.message}`)

    // ── Flatten purchases ──
    const purchaseRows = (purchases || []).map((p: any) => ({
      id:                String(p.id),
      date:              p.date,
      serial_no:         p.serial_no || '',
      vehicle_number:    p.vehicle_number || '',
      plant:             p.plants?.name || '',
      supplier:          p.suppliers?.name || '',
      rm_type:           p.raw_material_types?.name || '',
      quantity_kg:       p.quantity_kg || 0,
      rate_per_kg:       p.rate_per_kg || 0,
      loading_expense:   p.loading_expense || 0,
      unloading_expense: p.unloading_expense || 0,
      transport_expense: p.transport_expense || 0,
      other_expense:     p.other_expense || 0,
      total_rm_amount:   p.total_rm_amount || 0,
      total_amount:      p.total_amount || 0,
    }))

    // ── Flatten dispatches — one row per pellet type ──
    const dispatchRows: any[] = []
    for (const d of (dispatches || [])) {
      const pellets = d.dispatch_pellets || []
      const base = {
        date:           d.date,
        loading_date:   d.loading_date || d.date,
        dispatch_date:  d.dispatch_date || d.date,
        plant:          d.plants?.name || '',
        customer:       d.customers?.name || '',
        destination:    d.destination || '',
        truck_number:   d.truck_number || '',
        driver_name:    d.driver_name || '',
        driver_phone:   d.driver_phone || '',
        invoice_no:     d.invoice_no || '',
        loading_time:   d.loading_time || '',
        dispatch_time:  d.dispatch_time || '',
        remarks:        d.remarks || '',
      }
      if (pellets.length === 0) {
        dispatchRows.push({ id: `${d.id}_0`, ...base, pellet_type: '', quantity_mt: 0 })
      } else {
        for (let i = 0; i < pellets.length; i++) {
          dispatchRows.push({
            id:          `${d.id}_${i}`,
            ...base,
            pellet_type: pellets[i].pellet_type_name || '',
            quantity_mt: pellets[i].quantity_mt || 0,
          })
        }
      }
    }

    // ── Production rows ──
    const productionRows = (shiftData || []).map((s: any) => ({
      shift_id: String(s.id),
      date:     s.date,
      shift:    s.shift || '',
      plant:    s.plants?.name || '',
      total_mt: parseFloat(s.pellet_production_mt) || 0,
      machines: (s.machine_production || [])
        .filter((mp: any) => mp.machines?.name)
        .map((mp: any) => ({
          name:          (mp.machines.name as string).trim(),
          production_mt: parseFloat(mp.production_mt) || 0,
        })),
    }))

    return new Response(
      JSON.stringify({
        purchases:    purchaseRows,
        dispatches:   dispatchRows,
        production:   productionRows,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('get-sheet-data error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
