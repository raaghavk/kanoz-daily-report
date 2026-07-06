import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Detect weather keywords
function isWeatherQuery(q: string): boolean {
  const keywords = ['weather', 'mausam', 'baarish', 'barish', 'rain', 'raining', 'temperature', 'temp', 'garmi', 'sardi', 'thand', 'bijli', 'aandhi', 'fog', 'dhund', 'cloudy', 'sunny', 'storm']
  const lower = q.toLowerCase()
  return keywords.some(k => lower.includes(k))
}

// Fetch weather from Open-Meteo
async function fetchWeather(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weathercode,windspeed_10m&daily=precipitation_sum,precipitation_probability_max&forecast_days=3&timezone=Asia/Kolkata`
    const res = await fetch(url)
    const data = await res.json()
    const cur = data?.current
    const daily = data?.daily
    const code = cur?.weathercode
    const conditions: Record<number, string> = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Heavy drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      80: 'Slight showers', 81: 'Moderate showers', 82: 'Heavy showers',
      95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm'
    }
    const condition = conditions[code] ?? `Code ${code}`
    let result = `Current weather: ${condition}, ${Math.round(cur?.temperature_2m ?? 0)}°C, wind ${Math.round(cur?.windspeed_10m ?? 0)} km/h, precipitation ${cur?.precipitation ?? 0}mm now.\n`
    result += 'Next 3 days forecast:\n'
    const days = ['Today', 'Tomorrow', 'Day after']
    for (let i = 0; i < 3; i++) {
      const rain = (daily?.precipitation_sum?.[i] ?? 0).toFixed(1)
      const prob = daily?.precipitation_probability_max?.[i] ?? 0
      result += `  ${days[i]}: ${rain}mm rain, ${prob}% chance of rain\n`
    }
    return result
  } catch {
    return 'Weather data not available.'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { question, plantId, location } = await req.json() as { question?: string; plantId?: string; location?: { lat: number; lon: number } }

    if (!question || !plantId) {
      return new Response(JSON.stringify({ error: 'Missing question or plantId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch weather if relevant
    let weatherContext = ''
    if (isWeatherQuery(question) && location?.lat && location?.lon) {
      weatherContext = '\n\n## Current Weather & Forecast\n' + await fetchWeather(location.lat, location.lon)
    } else if (isWeatherQuery(question)) {
      weatherContext = '\n\n## Weather\nLocation not provided by user device — cannot fetch live weather.'
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ answer: 'AI is not configured. Please set GEMINI_API_KEY.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Calculate date range (last 30 days)
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    // Fetch plant data in parallel
    const [purchasesRes, dispatchesRes, reportsRes, pendingRes, stockRes] = await Promise.all([
      supabase.from('raw_material_purchases')
        .select('date, quantity_kg, total_amount, rate_per_kg, payment_status, suppliers(name), raw_material_types(name)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .gte('date', fromDate)
        .order('date', { ascending: false })
        .limit(200),

      supabase.from('vehicle_dispatches')
        .select('date, truck_number, customers(name), dispatch_pellets(quantity_mt, pellet_type_name)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .gte('date', fromDate)
        .order('date', { ascending: false })
        .limit(200),

      supabase.from('shift_reports')
        .select('date, shift, pellet_production_mt')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .gte('date', fromDate)
        .order('date', { ascending: false }),

      supabase.from('raw_material_purchases')
        .select('total_amount, suppliers(name)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .eq('payment_status', 'Pending'),

      supabase.from('shift_reports')
        .select('date, shift, pellet_stock(pellet_types(name), closing_mt), raw_material_usage(raw_material_types(name), closing_kg), diesel_stock(closing_litres)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const purchases = purchasesRes.data || []
    const dispatches = dispatchesRes.data || []
    const reports = reportsRes.data || []
    const pending = pendingRes.data || []
    const latestShift = stockRes.data

    // Build summary
    const totalPurchaseKg = purchases.reduce((s: number, p: any) => s + (parseFloat(p.quantity_kg) || 0), 0)
    const totalPurchaseAmt = purchases.reduce((s: number, p: any) => s + (parseFloat(p.total_amount) || 0), 0)
    const totalDispatchMT = dispatches.reduce((s: number, d: any) => s + ((d.dispatch_pellets || []).reduce((ss: number, p: any) => ss + (parseFloat(p.quantity_mt) || 0), 0)), 0)
    const totalProductionMT = reports.reduce((s: number, r: any) => s + (parseFloat(r.pellet_production_mt) || 0), 0)
    const pendingAmt = pending.reduce((s: number, p: any) => s + (parseFloat(p.total_amount) || 0), 0)

    // By material
    const byMaterial: Record<string, { qty: number, amt: number }> = {}
    purchases.forEach((p: any) => {
      const n = p.raw_material_types?.name || 'Other'
      if (!byMaterial[n]) byMaterial[n] = { qty: 0, amt: 0 }
      byMaterial[n].qty += parseFloat(p.quantity_kg) || 0
      byMaterial[n].amt += parseFloat(p.total_amount) || 0
    })

    // By supplier
    const bySupplier: Record<string, number> = {}
    purchases.forEach((p: any) => {
      const n = p.suppliers?.name || 'Unknown'
      bySupplier[n] = (bySupplier[n] || 0) + (parseFloat(p.total_amount) || 0)
    })

    // By customer
    const byCustomer: Record<string, number> = {}
    dispatches.forEach((d: any) => {
      const n = d.customers?.name || 'Unknown'
      byCustomer[n] = (byCustomer[n] || 0) + ((d.dispatch_pellets || []).reduce((s: number, p: any) => s + (parseFloat(p.quantity_mt) || 0), 0))
    })

    // Today's data
    const todayPurchases = purchases.filter((p: any) => p.date === todayStr)
    const todayDispatches = dispatches.filter((d: any) => d.date === todayStr)
    const todayReports = reports.filter((r: any) => r.date === todayStr)

    // Stock summary
    let stockSummary = ''
    if (latestShift) {
      const pellets = (latestShift.pellet_stock || []).map((ps: any) => `${ps.pellet_types?.name}: ${parseFloat(ps.closing_mt || 0).toFixed(1)} MT`).join(', ')
      const rm = (latestShift.raw_material_usage || []).map((r: any) => `${r.raw_material_types?.name}: ${Math.round(parseFloat(r.closing_kg || 0))} kg`).join(', ')
      const diesel = Array.isArray(latestShift.diesel_stock) ? latestShift.diesel_stock[0] : latestShift.diesel_stock
      stockSummary = `Latest stock (Shift ${latestShift.shift}, ${latestShift.date}): Pellets: ${pellets || 'none'}. RM: ${rm || 'none'}. Diesel: ${diesel?.closing_litres || 0} L.`
    }

    const context = `=== PLANT DATA (Last 30 days: ${fromDate} to ${todayStr}) ===

PRODUCTION: ${totalProductionMT.toFixed(1)} MT total, ${reports.length} shifts
PURCHASES: ${(totalPurchaseKg/1000).toFixed(2)} MT (${Math.round(totalPurchaseKg)} kg) for ₹${Math.round(totalPurchaseAmt).toLocaleString('en-IN')}
DISPATCHES: ${totalDispatchMT.toFixed(1)} MT dispatched, ${dispatches.length} trucks
PENDING PAYMENTS: ₹${Math.round(pendingAmt).toLocaleString('en-IN')} (${pending.length} bills)

BY MATERIAL TYPE: ${Object.entries(byMaterial).map(([n, d]) => `${n}: ${Math.round(d.qty)} kg @ avg ₹${(d.qty > 0 ? d.amt/d.qty : 0).toFixed(2)}/kg`).join('; ')}
BY SUPPLIER: ${Object.entries(bySupplier).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([n, amt]) => `${n}: ₹${Math.round(amt as number).toLocaleString('en-IN')}`).join('; ')}
BY CUSTOMER: ${Object.entries(byCustomer).sort((a,b) => b[1]-a[1]).map(([n, mt]) => `${n}: ${(mt as number).toFixed(1)} MT`).join('; ')}

TODAY (${todayStr}): ${todayPurchases.length} purchases, ${todayDispatches.length} dispatches, ${todayReports.length} shift reports

${stockSummary}${weatherContext}`

    // Call Gemini Flash
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a helpful data assistant for a biomass pellet manufacturing plant in India called Kanoz. You help the plant manager understand their production, purchase, and dispatch data.

Here is recent plant data:
${context}

The user asks: "${question}"

Instructions:
- Answer directly and concisely based on the data above
- Use Indian number formatting (lakhs/crores) for large amounts
- Show key numbers prominently
- If the question is in Hindi or mixed Hindi-English, answer in the same style
- Keep answer under 200 words
- If you cannot answer from the available data, say so clearly
- Do NOT make up numbers not in the data`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.1,
          }
        })
      }
    )

    const geminiData = await geminiRes.json()
    const answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!answer) {
      return new Response(JSON.stringify({ answer: 'Could not get a response. Please try again.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ answer }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('plant-chat error:', err)
    return new Response(JSON.stringify({ answer: 'Something went wrong. Please try again.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
