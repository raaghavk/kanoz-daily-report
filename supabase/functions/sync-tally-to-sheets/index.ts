import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders, jsonResponse, requireCaller } from '../_shared/callerAuth.ts'
import {
  loadServiceAccount,
  getGoogleAccessToken,
  ensureSheetTab,
  getSheetValues,
  updateSheetValues,
} from '../_shared/googleSheets.ts'
import { buildTallyEnvelope } from '../_shared/tallyXml.ts'

const VOUCHER_HEADERS = [
  'Synced At',
  'Batch Id',
  'Voucher Id',
  'Date',
  'Type',
  'Party Ledger',
  'Account Ledger',
  'Amount',
  'Narration',
  'Source Table',
  'Source Id',
  'Status',
  'Company',
  'Plant',
]

/**
 * Sync a reviewed Tally voucher batch to Google Sheets, then optionally
 * POST the Tally XML envelope to the configured Gateway URL.
 *
 * Body: { batch_id: string, post_to_gateway?: boolean }
 *
 * Writes (or updates) rows on plants.google_sheet_id → tab TallyVouchers
 * (or tally_settings.sheets_tab). Also writes full import XML to tab TallyXML!A1
 * so an Apps Script / connector can create vouchers in Tally automatically.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const caller = await requireCaller(req)
    if (caller instanceof Response) return caller

    const body = await req.json().catch(() => ({}))
    const batchId = body.batch_id as string | undefined
    if (!batchId) return jsonResponse({ error: 'batch_id is required' }, 400)

    const supabase = caller.admin
    const { data: batch, error: batchErr } = await supabase
      .from('tally_export_batches')
      .select('*, plants(id, name, org_id, google_sheet_id)')
      .eq('id', batchId)
      .maybeSingle()

    if (batchErr || !batch) return jsonResponse({ error: 'Batch not found' }, 404)
    if (batch.org_id !== caller.employee.org_id) return jsonResponse({ error: 'Forbidden' }, 403)

    const plant = batch.plants
    const sheetId = plant?.google_sheet_id
    if (!sheetId) {
      return jsonResponse({
        error: 'No Google Sheet configured for this plant. Paste the Sheet ID on the Tally sync page and save.',
      }, 400)
    }

    const { data: settings } = await supabase
      .from('tally_settings')
      .select('*')
      .eq('plant_id', batch.plant_id)
      .maybeSingle()

    const { data: vouchers, error: vErr } = await supabase
      .from('tally_vouchers')
      .select('*')
      .eq('batch_id', batchId)
      .order('voucher_date')

    if (vErr) throw vErr

    // Prefer client-sent skip state if provided; else use DB status
    const clientVouchers = Array.isArray(body.vouchers) ? body.vouchers : null
    let working = vouchers || []
    if (clientVouchers?.length) {
      const statusByKey = new Map(
        clientVouchers.map((v: { source_id?: string; voucher_type?: string; status?: string; amount?: number }) => [
          `${v.source_id || ''}|${v.voucher_type || ''}|${v.amount ?? ''}`,
          v.status,
        ]),
      )
      working = working.map((v) => {
        const key = `${v.source_id || ''}|${v.voucher_type || ''}|${v.amount ?? ''}`
        const st = statusByKey.get(key)
        return st ? { ...v, status: st } : v
      })
      // Persist skip/include from the review UI
      for (const v of working) {
        await supabase.from('tally_vouchers').update({ status: v.status === 'skipped' ? 'skipped' : 'included' }).eq('id', v.id)
      }
    }

    const included = working.filter((v) => v.status !== 'skipped')
    const company = settings?.company_name || plant?.name || ''
    const tabName = settings?.sheets_tab || 'TallyVouchers'
    const syncedAt = new Date().toISOString()

    const serviceAccount = loadServiceAccount()
    const accessToken = await getGoogleAccessToken(serviceAccount)
    await ensureSheetTab(accessToken, sheetId, tabName)
    await ensureSheetTab(accessToken, sheetId, 'TallyXML')

    // Idempotent: drop existing rows for this batch_id, keep other batches
    const existing = await getSheetValues(accessToken, sheetId, `${tabName}!A:N`)
    const header = existing[0]?.[0] === 'Synced At' ? existing[0] : VOUCHER_HEADERS
    const kept = (existing[0]?.[0] === 'Synced At' ? existing.slice(1) : existing)
      .filter((row) => row[1] !== batchId)
    const newRows = included.map((v) => [
      syncedAt,
      batchId,
      v.id,
      String(v.voucher_date || '').slice(0, 10),
      v.voucher_type || '',
      v.party_ledger || '',
      v.account_ledger || '',
      Number(v.amount) || 0,
      v.narration || '',
      v.source_table || '',
      v.source_id || '',
      'synced',
      company,
      plant?.name || '',
    ])
    const allRows = [header, ...kept, ...newRows]
    const writeRes = await updateSheetValues(accessToken, sheetId, `${tabName}!A1`, allRows)

    const xml = buildTallyEnvelope(included, company)
    await updateSheetValues(accessToken, sheetId, 'TallyXML!A1', [
      ['Batch Id', 'Synced At', 'Company', 'Voucher Count', 'XML'],
      [batchId, syncedAt, company, included.length, xml],
    ])

    let gateway: { ok: boolean; status?: number; body?: string } | null = null
    const shouldPost = body.post_to_gateway === true || settings?.auto_post_gateway === true
    const gatewayUrl = (settings?.tally_gateway_url || '').trim()
    if (shouldPost && gatewayUrl) {
      try {
        const gRes = await fetch(gatewayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml' },
          body: xml,
        })
        gateway = { ok: gRes.ok, status: gRes.status, body: (await gRes.text()).slice(0, 500) }
      } catch (err) {
        gateway = { ok: false, body: err instanceof Error ? err.message : String(err) }
      }
    }

    const status = gateway?.ok ? 'posted' : 'synced'
    await supabase.from('tally_export_batches').update({
      status,
      xml,
      voucher_count: included.length,
      total_amount: included.reduce((s, v) => s + (Number(v.amount) || 0), 0),
      sheets_synced_at: syncedAt,
      sheets_range: writeRes.updatedRange || `${tabName}!A1`,
      reviewed_by: caller.employee.id,
      reviewed_at: syncedAt,
    }).eq('id', batchId)

    await supabase.from('tally_settings').upsert({
      plant_id: batch.plant_id,
      company_name: settings?.company_name || company,
      last_synced_at: syncedAt,
      updated_at: syncedAt,
    }, { onConflict: 'plant_id' })

    return jsonResponse({
      success: true,
      synced: included.length,
      skipped: working.length - included.length,
      sheetId,
      tab: tabName,
      updatedRange: writeRes.updatedRange,
      gateway,
      status,
    })
  } catch (err) {
    console.error('sync-tally-to-sheets', err)
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
