import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { getLocalDate } from '../../lib/dateUtils'
import {
  mapPurchaseToVoucher,
  mapDispatchToVoucher,
  mapCostToVoucher,
  mapPaymentToVoucher,
} from '../../lib/tallyXml'
import { Loader2 } from 'lucide-react'

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function sheetIdFromUrlOrRaw(value) {
  const v = (value || '').trim()
  const m = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : v
}

export default function TallyPage() {
  const { plant, employee, refreshPlant } = useAuth()
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate, setToDate] = useState(getLocalDate())
  const [settings, setSettings] = useState({
    company_name: '', gstin: '', tally_gateway_url: '',
    purchase_ledger: 'Purchase Accounts', sales_ledger: 'Sales Accounts',
    bank_ledger: 'Bank', sundry_creditors_ledger: 'Sundry Creditors',
    sundry_debtors_ledger: 'Sundry Debtors',
    sheets_tab: 'TallyVouchers', auto_post_gateway: false, last_synced_at: null,
  })
  const [sheetId, setSheetId] = useState('')
  const [vouchers, setVouchers] = useState([])
  const [batchId, setBatchId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [lastSync, setLastSync] = useState(null)

  useEffect(() => {
    if (!plant?.id) return
    setSheetId(plant.google_sheet_id || '')
    supabase.from('tally_settings').select('*').eq('plant_id', plant.id).maybeSingle()
      .then(({ data }) => { if (data) setSettings(s => ({ ...s, ...data })) })
  }, [plant?.id, plant?.google_sheet_id])

  async function saveSettings() {
    setSavingSettings(true)
    try {
      const cleanedSheetId = sheetIdFromUrlOrRaw(sheetId)
      const [{ error: plantErr }, { error: setErr }] = await Promise.all([
        supabase.from('plants').update({ google_sheet_id: cleanedSheetId || null }).eq('id', plant.id),
        supabase.from('tally_settings').upsert({
          plant_id: plant.id,
          company_name: settings.company_name || null,
          gstin: settings.gstin || null,
          tally_gateway_url: settings.tally_gateway_url || null,
          purchase_ledger: settings.purchase_ledger,
          sales_ledger: settings.sales_ledger,
          bank_ledger: settings.bank_ledger,
          sundry_creditors_ledger: settings.sundry_creditors_ledger,
          sundry_debtors_ledger: settings.sundry_debtors_ledger,
          sheets_tab: settings.sheets_tab || 'TallyVouchers',
          auto_post_gateway: !!settings.auto_post_gateway,
          updated_at: new Date().toISOString(),
        }),
      ])
      if (plantErr) throw plantErr
      if (setErr) throw setErr
      setSheetId(cleanedSheetId)
      if (typeof refreshPlant === 'function') await refreshPlant()
      showToast('Tally sync settings saved', 'success')
    } catch (err) { showToast(err.message || 'Failed to save', 'error') }
    finally { setSavingSettings(false) }
  }

  async function prepare() {
    if (!plant?.id) return
    setLoading(true)
    try {
      const [purchasesRes, dispRes, costsRes, mapsRes] = await Promise.all([
        supabase.from('raw_material_purchases').select('*, suppliers(name)').eq('plant_id', plant.id).eq('is_deleted', false).gte('date', fromDate).lte('date', toDate),
        supabase.from('vehicle_dispatches').select('*, customers(name), dispatch_pellets(quantity_mt)').eq('plant_id', plant.id).eq('is_deleted', false).gte('date', fromDate).lte('date', toDate),
        supabase.from('finance_costs').select('*').eq('plant_id', plant.id).eq('is_deleted', false).gte('cost_date', fromDate).lte('cost_date', toDate),
        supabase.from('tally_ledger_maps').select('*').eq('org_id', plant.org_id),
      ])
      if (purchasesRes.error) throw purchasesRes.error
      const maps = mapsRes.data || []
      const ledgerFor = (type, id, name) =>
        maps.find(m => m.entity_type === type && (m.entity_id === id || m.entity_name === name))?.tally_ledger_name

      const next = []
      for (const p of purchasesRes.data || []) {
        next.push(mapPurchaseToVoucher(p, settings, ledgerFor('supplier', p.supplier_id, p.supplier_name)))
        const payRm = mapPaymentToVoucher(p, settings, 'rm')
        if (payRm) next.push(payRm)
        const payTr = mapPaymentToVoucher(p, settings, 'transport')
        if (payTr) next.push(payTr)
      }
      for (const d of dispRes.data || []) {
        const qty = (d.dispatch_pellets || []).reduce((s, x) => s + (Number(x.quantity_mt) || 0), 0)
        next.push(mapDispatchToVoucher(d, settings, ledgerFor('customer', d.customer_id, d.customers?.name), qty))
      }
      for (const c of costsRes.data || []) {
        next.push(mapCostToVoucher(c, settings))
      }

      const { data: batch, error: bErr } = await supabase.from('tally_export_batches').insert({
        plant_id: plant.id,
        org_id: plant.org_id,
        from_date: fromDate,
        to_date: toDate,
        status: 'draft',
        voucher_count: next.length,
        total_amount: next.reduce((s, v) => s + (Number(v.amount) || 0), 0),
        created_by: employee?.id || null,
      }).select().single()
      if (bErr) throw bErr

      if (next.length) {
        const rows = next.map(v => ({ ...v, batch_id: batch.id }))
        const { data: inserted, error: vErr } = await supabase.from('tally_vouchers').insert(rows).select()
        if (vErr) throw vErr
        setVouchers(inserted || rows)
      } else {
        setVouchers([])
      }
      setBatchId(batch.id)
      setLastSync(null)
      showToast(`Prepared ${next.length} voucher${next.length === 1 ? '' : 's'} — review, then sync to Sheets`, 'success')
    } catch (err) {
      showToast(err.message || 'Failed to prepare vouchers', 'error')
    } finally { setLoading(false) }
  }

  function toggleSkip(idx) {
    setVouchers(list => list.map((v, i) => i === idx ? { ...v, status: v.status === 'skipped' ? 'pending' : 'skipped' } : v))
  }

  async function syncToSheets({ postToGateway = false } = {}) {
    if (!batchId) { showToast('Prepare vouchers first', 'error'); return }
    if (!sheetIdFromUrlOrRaw(sheetId) && !plant?.google_sheet_id) {
      showToast('Save a Google Sheet ID first', 'error')
      return
    }
    setSyncing(true)
    try {
      // Persist skip/include before invoking the edge function
      await Promise.all(vouchers.filter(v => v.id).map(v =>
        supabase.from('tally_vouchers').update({
          status: v.status === 'skipped' ? 'skipped' : 'included',
        }).eq('id', v.id)
      ))

      const { data, error } = await supabase.functions.invoke('sync-tally-to-sheets', {
        body: {
          batch_id: batchId,
          post_to_gateway: postToGateway || !!settings.auto_post_gateway,
          vouchers: vouchers.map(v => ({
            source_id: v.source_id,
            voucher_type: v.voucher_type,
            amount: v.amount,
            status: v.status === 'skipped' ? 'skipped' : 'included',
          })),
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      setLastSync({
        synced: data.synced,
        tab: data.tab,
        status: data.status,
        gateway: data.gateway,
        at: new Date().toISOString(),
      })
      if (data.gateway && !data.gateway.ok) {
        showToast(`Synced ${data.synced} rows to Sheets, but Tally Gateway failed: ${data.gateway.body || data.gateway.status}`, 'error')
      } else if (data.status === 'posted') {
        showToast(`Synced ${data.synced} vouchers to Sheets and posted to Tally Gateway`, 'success')
      } else {
        showToast(`Synced ${data.synced} vouchers to Google Sheets (${data.tab})`, 'success')
      }
    } catch (err) {
      showToast(err.message || 'Sync failed', 'error')
    } finally { setSyncing(false) }
  }

  const inp = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }
  const included = vouchers.filter(v => v.status !== 'skipped')

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Tally sync" subtitle="App → Google Sheets → Tally vouchers" backTo="/finance" />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#e8f0ec', borderRadius: 14, padding: 14, fontSize: 12, color: '#2d6a4f', lineHeight: 1.55 }}>
          Money movements in this app become voucher rows. Sync writes them to a <b>TallyVouchers</b> tab
          in your plant Google Sheet (and a <b>TallyXML</b> tab with the import envelope). From there,
          Tally Gateway can create vouchers automatically if you enable gateway post, or an Apps Script
          can POST the XML from the sheet.
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Sync destination</div>
          <div>
            <label style={lbl}>Google Sheet ID or URL</label>
            <input
              value={sheetId}
              onChange={e => setSheetId(e.target.value)}
              placeholder="Paste spreadsheet URL or ID"
              style={inp}
            />
            <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 6 }}>
              Share the sheet with your Google service account as Editor.
            </div>
          </div>
          <div>
            <label style={lbl}>Sheet tab for voucher rows</label>
            <input value={settings.sheets_tab || 'TallyVouchers'} onChange={e => setSettings(s => ({ ...s, sheets_tab: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Tally company name (must match Tally)</label>
            <input value={settings.company_name} onChange={e => setSettings(s => ({ ...s, company_name: e.target.value }))} placeholder="As shown in Tally Prime" style={inp} />
          </div>
          <div>
            <label style={lbl}>GSTIN</label>
            <input value={settings.gstin || ''} onChange={e => setSettings(s => ({ ...s, gstin: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Tally Gateway URL (optional — auto-create vouchers)</label>
            <input value={settings.tally_gateway_url || ''} onChange={e => setSettings(s => ({ ...s, tally_gateway_url: e.target.value }))} placeholder="http://localhost:9000" style={inp} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#2c2c2c', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!settings.auto_post_gateway}
              onChange={e => setSettings(s => ({ ...s, auto_post_gateway: e.target.checked }))}
            />
            After Sheets sync, also POST XML to Tally Gateway
          </label>
          <button onClick={saveSettings} disabled={savingSettings} style={{ padding: '10px 0', background: '#1b4332', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
            {savingSettings ? 'Saving…' : 'Save sync settings'}
          </button>
          {settings.last_synced_at && (
            <div style={{ fontSize: 11, color: '#8a8d7a' }}>Last synced: {new Date(settings.last_synced_at).toLocaleString()}</div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Prepare a date range</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inp} />
            </div>
          </div>
          <button onClick={prepare} disabled={loading} style={{ padding: '11px 0', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Prepare vouchers for review'}
          </button>
        </div>

        {vouchers.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{included.length} vouchers to sync</div>
                  <div style={{ fontSize: 11, color: '#8a8d7a' }}>Tap a row to skip it</div>
                </div>
              </div>
              <button
                onClick={() => syncToSheets({ postToGateway: false })}
                disabled={syncing}
                style={{ padding: '11px 0', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: syncing ? 'wait' : 'pointer' }}
              >
                {syncing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Sync to Google Sheets'}
              </button>
              {(settings.tally_gateway_url || '').trim() && !settings.auto_post_gateway && (
                <button
                  onClick={() => syncToSheets({ postToGateway: true })}
                  disabled={syncing}
                  style={{ padding: '10px 0', background: '#1b4332', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 12, cursor: syncing ? 'wait' : 'pointer' }}
                >
                  Sync to Sheets + create in Tally Gateway
                </button>
              )}
              {lastSync && (
                <div style={{ fontSize: 11, color: '#2d6a4f', background: '#e8f0ec', borderRadius: 10, padding: '8px 10px' }}>
                  Synced {lastSync.synced} rows to tab {lastSync.tab}
                  {lastSync.status === 'posted' ? ' · posted to Gateway' : ''}
                </div>
              )}
            </div>
            {vouchers.map((v, i) => (
              <button
                key={v.id || i}
                onClick={() => toggleSkip(i)}
                style={{
                  width: '100%', textAlign: 'left', border: 'none', borderTop: '1px solid #f0ebe0',
                  padding: '10px 14px', background: v.status === 'skipped' ? '#f3f4f6' : '#fff', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: v.status === 'skipped' ? '#8a8d7a' : '#2c2c2c' }}>
                    {v.voucher_type} · {String(v.voucher_date).slice(0, 10)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>₹{Math.round(Number(v.amount) || 0).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>
                  {v.party_ledger} → {v.account_ledger}{v.status === 'skipped' ? ' · skipped' : ''}
                </div>
                {v.narration && <div style={{ fontSize: 11, color: '#595c4a', marginTop: 2 }}>{v.narration}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
