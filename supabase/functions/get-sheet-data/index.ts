import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ORG_ID = 'a0000000-0000-0000-0000-000000000001'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

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
      .eq('org_id', ORG_ID)
      .eq('is_deleted', false)
      .order('date', { ascending: false })

    if (pErr) throw new Error(`Purchases: ${pErr.message}`)

    // ── Dispatches ──
    const { data: dispatches, error: dErr } = await supabase
      .from('vehicle_dispatches')
      .select(`
        id, date, loading_date,
        plants(name),
        customers(name),
        destination,
        truck_number, driver_name, driver_phone, invoice_number,
        loading_time, dispatch_time, remarks,
        dispatch_pellets(pellet_type_name, quantity_mt)
      `)
      .eq('org_id', ORG_ID)
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
      .eq('org_id', ORG_ID)
      .eq('is_deleted', false)
      .order('date', { ascending: false })

    if (sErr) throw new Error(`Shifts: ${sErr.message}`)

    // ── Flatten purchases (add id for incremental sync dedup) ──
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

    // ── Flatten dispatches — one row per pellet type, compound id for dedup ──
    const dispatchRows: any[] = []
    for (const d of (dispatches || [])) {
      const pellets = d.dispatch_pellets || []
      if (pellets.length === 0) {
        dispatchRows.push({
          id:             `${d.id}_0`,
          date:           d.date,
          loading_date:   d.loading_date || d.date,
          dispatch_date:  d.date,
          plant:          d.plants?.name || '',
          customer:       d.customers?.name || '',
          destination:    d.destination || '',
          pellet_type:    '',
          quantity_mt:    0,
          truck_number:   d.truck_number || '',
          driver_name:    d.driver_name || '',
          driver_phone:   d.driver_phone || '',
          invoice_number: d.invoice_number || '',
          loading_time:   d.loading_time || '',
          dispatch_time:  d.dispatch_time || '',
          remarks:        d.remarks || '',
        })
      } else {
        for (let i = 0; i < pellets.length; i++) {
          const pellet = pellets[i]
          dispatchRows.push({
            id:             `${d.id}_${i}`,
            date:           d.date,
            loading_date:   d.loading_date || d.date,
            dispatch_date:  d.date,
            plant:          d.plants?.name || '',
            customer:       d.customers?.name || '',
            destination:    d.destination || '',
            pellet_type:    pellet.pellet_type_name || '',
            quantity_mt:    pellet.quantity_mt || 0,
            truck_number:   d.truck_number || '',
            driver_name:    d.driver_name || '',
            driver_phone:   d.driver_phone || '',
            invoice_number: d.invoice_number || '',
            loading_time:   d.loading_time || '',
            dispatch_time:  d.dispatch_time || '',
            remarks:        d.remarks || '',
          })
        }
      }
    }

    // ── Production rows — one row per shift, machine data as array ──
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
