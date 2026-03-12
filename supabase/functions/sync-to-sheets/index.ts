import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Sync a shift report to Google Sheets.
 *
 * Expected body:
 * { report_id: string }
 *
 * Required secrets:
 * - GOOGLE_SERVICE_ACCOUNT_JSON: The full JSON key for a Google service account
 * - The target sheet ID is read from the plants.google_sheet_id column
 *
 * The service account must have Editor access to the target sheet.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { report_id } = await req.json()
    if (!report_id) {
      return new Response(JSON.stringify({ error: 'report_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceAccountJSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!serviceAccountJSON) {
      return new Response(JSON.stringify({ error: 'Google service account not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch the full report with all child data
    const { data: report, error: reportErr } = await supabase
      .from('shift_reports')
      .select('*, plants(name, google_sheet_id), employees(name)')
      .eq('id', report_id)
      .single()

    if (reportErr || !report) {
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sheetId = report.plants?.google_sheet_id
    if (!sheetId) {
      return new Response(JSON.stringify({ error: 'No Google Sheet configured for this plant. Add google_sheet_id to the plants table.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch child data
    const [machRes, rmRes, dieselRes, stockRes, issuesRes] = await Promise.all([
      supabase.from('machine_production').select('*, machines(name)').eq('shift_report_id', report_id),
      supabase.from('raw_material_usage').select('*, raw_material_types(name)').eq('shift_report_id', report_id),
      supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', report_id),
      supabase.from('pellet_stock').select('*, pellet_types(name)').eq('shift_report_id', report_id),
      supabase.from('issues').select('*').eq('shift_report_id', report_id),
    ])

    const machines = machRes.data || []
    const rawMaterials = rmRes.data || []
    const dieselLog = dieselRes.data || []
    const pelletStock = stockRes.data || []
    const issues = issuesRes.data || []

    // Build the row data
    const machineHours = machines.map(m => `${m.machines?.name}: ${m.hours_run || 0}h`).join(', ')
    const rmSummary = rawMaterials.map(r => `${r.raw_material_types?.name}: ${r.quantity_kg || 0}kg`).join(', ')
    const dieselSummary = dieselLog.map(d => `${d.equipment_name}: ${d.closing_litres || 0}L`).join(', ')
    const stockSummary = pelletStock.map(p => `${p.pellet_types?.name}: ${p.closing_mt || 0}MT`).join(', ')
    const issueSummary = issues.map(i => `[${i.severity}] ${i.issue_type}: ${i.description}`).join('; ')

    const row = [
      report.date,
      report.shift,
      report.employees?.name || 'N/A',
      report.start_time?.slice(0, 5) || '',
      report.end_time?.slice(0, 5) || '',
      report.pellet_production_mt || 0,
      machineHours,
      rmSummary,
      dieselSummary,
      stockSummary,
      issueSummary,
      report.handover_notes || '',
      report.remarks || '',
    ]

    // Get Google access token using service account
    const serviceAccount = JSON.parse(serviceAccountJSON)
    const accessToken = await getGoogleAccessToken(serviceAccount)

    // Append row to Google Sheet
    const range = 'Sheet1!A:M'
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`

    const sheetsRes = await fetch(sheetsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    })

    if (!sheetsRes.ok) {
      const errBody = await sheetsRes.text()
      throw new Error(`Google Sheets API error: ${sheetsRes.status} ${errBody}`)
    }

    const result = await sheetsRes.json()

    return new Response(JSON.stringify({
      success: true,
      updatedRange: result.updates?.updatedRange,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Get a Google API access token using a service account JWT.
 */
async function getGoogleAccessToken(serviceAccount: {
  client_email: string
  private_key: string
}) {
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encoder = new TextEncoder()

  function base64url(data: string) {
    return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const headerB64 = base64url(JSON.stringify(header))
  const claimB64 = base64url(JSON.stringify(claim))
  const signInput = `${headerB64}.${claimB64}`

  // Import the private key
  const pemContent = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const keyData = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signInput)
  )

  const sigB64 = base64url(String.fromCharCode(...new Uint8Array(signature)))
  const jwt = `${signInput}.${sigB64}`

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`)
  }

  return tokenData.access_token
}
