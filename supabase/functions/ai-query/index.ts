import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ai-query: natural-language analytics over the plant's live data.
// The AI writes ONE read-only SELECT (schema below), we sandbox-validate it,
// execute via the SELECT-only execute_readonly_query RPC, then the AI
// summarizes the rows. verify_jwt on. Single-org deployment: every project is
// one organization, so all data belongs to the caller's org.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const GEMINI_MODEL = 'gemini-2.5-flash'

// Curated schema the AI may query (analytical tables + key columns).
const SCHEMA = `
plants(id, name, org_id)
employees(id, name, role, mobile, worker_type, labour_daily_wage, machine_id, plant_id, org_id, is_active)
suppliers(id, name, mobile, raw_material_type, rate_offered, address, org_id, plant_id, is_active)
customers(id, name, mobile, contact_person, contact_phone, account_owner, gst_number, address, org_id, is_active)
transporters(id, name, phone, org_id, is_active)
transporter_vehicles(id, transporter_id, vehicle_number, vehicle_type, approx_capacity_kg, is_active)
raw_material_types(id, name, unit, gcv_kcal_kg, opening_stock_kg, plant_id, is_active)
pellet_types(id, name, grade, gcv_kcal_kg, plant_id, is_active)
machines(id, name, machine_type, capacity_mt_per_hour, motor_hp, plant_id, is_active)
equipment(id, name, equipment_type, fuel_type, rating, motor_hp, opening_stock_litres, plant_id, is_active)
raw_material_purchases(id, plant_id, date, supplier_id, supplier_name, transporter_id, vehicle_number, raw_material_type, raw_material_type_id, quantity_kg, rate_per_kg, total_amount, payment_status, is_deleted)
vehicle_dispatches(id, plant_id, date, truck_number, customer_id, transporter_id, destination, invoice_no, is_deleted)
dispatch_pellets(id, dispatch_id, pellet_type_name, quantity_mt)
shift_reports(id, plant_id, date, shift, pellet_production_mt, power_consumed_kwh, is_deleted)
machine_production(id, shift_report_id, machine_id, production_mt, total_hours, breakdown_hours)
pellet_stock(id, shift_report_id, pellet_type_id, opening_mt, production_mt, dispatch_mt, closing_mt)
raw_material_usage(id, shift_report_id, raw_material_type_id, opening_kg, purchased_kg, quantity_kg, closing_kg)
processing_runs(id, shift_report_id, route_id, input_material, input_kg, output_material, output_kg, yield_pct)
process_routes(id, plant_id, name, input_material_name, output_material_name, expected_yield_pct)
spare_parts_purchases(id, plant_id, part_id, supplier_id, quantity, grand_total, purchase_date)
tasks(id, plant_id, title, status, due_date)
attendance(id, plant_id, employee_id, work_date, status, hours, check_in_at, check_out_at, machine_id)
`

function validateSql(sql: string): string | null {
  const lower = sql.toLowerCase().trim()
  if (!(lower.startsWith('select') || lower.startsWith('with'))) return 'Query must be a SELECT.'
  // Block writes / DDL / statement stacking.
  if (/;.*\S/.test(sql)) return 'Only a single statement is allowed.'
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment|copy|call|do|merge|vacuum)\b/.test(lower)) return 'Only read-only SELECT queries are allowed.'
  if (lower.includes('pg_') || lower.includes('information_schema') || lower.includes('auth.') || lower.includes('storage.')) return 'System tables are not queryable.'
  return null
}

async function gemini(apiKey: string, prompt: string, json = false): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, ...(json ? { responseMimeType: 'application/json' } : {}) } }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { question, plantId } = await req.json() as { question?: string; plantId?: string }
    if (!question || !plantId) return new Response(JSON.stringify({ error: 'Missing question or plantId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) return new Response(JSON.stringify({ answer: 'AI is not configured.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: plantRow } = await admin.from('plants').select('org_id, name').eq('id', plantId).maybeSingle()
    const orgId = plantRow?.org_id
    if (!orgId) return new Response(JSON.stringify({ answer: 'Plant not found.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Step 1: AI writes a SELECT.
    const today = new Date().toISOString().split('T')[0]
    const sqlPrompt = `You are a PostgreSQL expert for a biomass pellet plant ERP. Write ONE read-only SELECT that answers the user's question. Today is ${today}. This plant's id is '${plantId}' and org id is '${orgId}'.

SCHEMA (only these tables/columns exist):${SCHEMA}

RULES:
- Output ONLY the SQL, no markdown, no explanation, one statement, no trailing semicolon.
- Read-only SELECT (or WITH ... SELECT) ONLY. Never write/DDL.
- ALWAYS scope to this plant: filter plant-scoped tables by plant_id = '${plantId}', and org-scoped tables (suppliers, customers, transporters, employees) by org_id = '${orgId}'. For child tables join to a parent that carries plant_id.
- Exclude soft-deleted rows: add is_deleted = false (or is_deleted is null) where the column exists (raw_material_purchases, vehicle_dispatches, shift_reports).
- Match a person/supplier/customer/transporter by name loosely with ILIKE '%name%' (names may be partial or lower-case).
- ATTENDANCE: a person is PRESENT on a day when (status = 'present' OR check_in_at IS NOT NULL); ABSENT when status = 'absent'. To count days present, COUNT(DISTINCT work_date) with that present condition. Join attendance.employee_id = employees.id to filter by employee name. Filter a month with work_date >= first-of-month AND work_date < first-of-next-month (e.g. July 2026: work_date >= '2026-07-01' AND work_date < '2026-08-01'). attendance.hours holds worked hours when recorded.
- For "transporter efficiency / who brings more": join raw_material_purchases (transporter_id) to transporters, SUM(quantity_kg) per transporter, order desc.
- Prefer aggregates and clear column aliases. Add LIMIT 200.
- If the question cannot be answered from the schema, output exactly: SELECT 'unanswerable' AS note

USER QUESTION: "${question}"`

    let sql = (await gemini(apiKey, sqlPrompt)).replace(/```sql|```/g, '').trim()
    sql = sql.replace(/;\s*$/, '')

    const invalid = validateSql(sql)
    if (invalid) {
      return new Response(JSON.stringify({ answer: `I couldn't build a safe query for that. (${invalid})`, sql }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Step 2: execute via SELECT-only RPC (service role).
    const { data: rows, error: qErr } = await admin.rpc('execute_readonly_query', { query_text: sql })
    if (qErr) {
      return new Response(JSON.stringify({ answer: `That query didn't run. Try rephrasing. (${qErr.message.slice(0, 120)})`, sql }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const rowArr = Array.isArray(rows) ? rows : []
    const trimmed = rowArr.slice(0, 100)

    // Step 3: AI summarizes results.
    const answerPrompt = `You are a helpful data assistant for the Kanoz biomass pellet plant. The user asked: "${question}"\n\nThe query returned this JSON data:\n${JSON.stringify(trimmed)}\n\nAnswer the user's question directly and concisely from this data. Use Indian number formatting (lakh/crore) for large amounts and ₹ for money. IMPORTANT: raw material and pellet quantities are stored in kg but should be presented to the user in metric tonnes (MT) — divide kg by 1000 and show 2 decimals with the label MT (e.g. 2000 kg → 2.00 MT). Diesel stays in litres; prices stay ₹/kg. If the data is empty, say there's no matching data yet. If the note is 'unanswerable', say you can't answer that from the available data. Reply in the user's language (Hindi/Hinglish if they used it, else English). Under 180 words. Do not invent numbers not in the data.`
    const answer = await gemini(apiKey, answerPrompt)

    return new Response(JSON.stringify({ answer: answer || 'No answer produced.', sql, rowCount: rowArr.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('ai-query error:', err)
    return new Response(JSON.stringify({ answer: 'Something went wrong answering that. Please try again.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
