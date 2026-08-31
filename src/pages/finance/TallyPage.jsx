import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { getLocalDate } from '../../lib/dateUtils'
import {
  buildTallyEnvelope,
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

export default function TallyPage() {
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate, setToDate] = useState(getLocalDate())
  const [settings, setSettings] = useState({
    company_name: '', gstin: '', tally_gateway_url: '',
    purchase_ledger: 'Purchase Accounts', sales_ledger: 'Sales Accounts',
    bank_ledger: 'Bank', sundry_creditors_ledger: 'Sundry Creditors',
    sundry_debtors_ledger: 'Sundry Debtors',
  })
  const [vouchers, setVouchers] = useState([])
  const [batchId, setBatchId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    if (!plant?.id) return
    supabase.from('tally_settings').select('*').eq('plant_id', plant.id).maybeSingle()
      .then(({ data }) => { if (data) setSettings(s => ({ ...s, ...data })) })
  }, [plant?.id])

  async function saveSettings() {
    setSavingSettings(true)
    try {
      const { error } = await supabase.from('tally_settings').upsert({
        plant_id: plant.id,
        company_name: settings.company_name || null,
        gstin: settings.gstin || null,
        tally_gateway_url: settings.tally_gateway_url || null,
        purchase_ledger: settings.purchase_ledger,
        sales_ledger: settings.sales_ledger,
        bank_ledger: settings.bank_ledger,
        sundry_creditors_ledger: settings.sundry_creditors_ledger,
        sundry_debtors_ledger: settings.sundry_debtors_ledger,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      showToast('Tally company settings saved', 'success')
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
        const { error: vErr } = await supabase.from('tally_vouchers').insert(rows)
        if (vErr) throw vErr
      }
      setBatchId(batch.id)
      setVouchers(next)
      showToast(`Prepared ${next.length} voucher${next.length === 1 ? '' : 's'} for review`, 'success')
    } catch (err) {
      showToast(err.message || 'Failed to prepare vouchers', 'error')
    } finally { setLoading(false) }
  }

  function toggleSkip(idx) {
    setVouchers(list => list.map((v, i) => i === idx ? { ...v, status: v.status === 'skipped' ? 'pending' : 'skipped' } : v))
  }

  function downloadXml() {
    const xml = buildTallyEnvelope(vouchers, settings.company_name || plant?.name)
    const blob = new Blob([xml], { type: 'text/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tally-${fromDate}-to-${toDate}.xml`
    a.click()
    URL.revokeObjectURL(url)
    if (batchId) {
      supabase.from('tally_export_batches').update({
        status: 'exported',
        xml,
        reviewed_by: employee?.id || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', batchId).then(() => {})
    }
    showToast('XML downloaded — import this in Tally Prime (Gateway / Import Data)', 'success')
  }

  const inp = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }
  const included = vouchers.filter(v => v.status !== 'skipped')

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Tally export" subtitle="Accountant reviews vouchers — Tally gets the XML, not a spreadsheet" backTo="/finance" />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#e8f0ec', borderRadius: 14, padding: 14, fontSize: 12, color: '#2d6a4f', lineHeight: 1.55 }}>
          Amounts are taken from this app (purchases, payments, dispatches, costs) — they are not invented by AI.
          Map supplier/customer names to Tally ledgers, review the list, then download Tally XML.
          In Tally Prime Cloud: Gateway of Tally → Import Data → Vouchers, or POST the XML to your Tally Gateway URL (port 9000).
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Company (must match Tally)</div>
          <div>
            <label style={lbl}>Tally company name</label>
            <input value={settings.company_name} onChange={e => setSettings(s => ({ ...s, company_name: e.target.value }))} placeholder="As shown in Tally Prime" style={inp} />
          </div>
          <div>
            <label style={lbl}>GSTIN</label>
            <input value={settings.gstin || ''} onChange={e => setSettings(s => ({ ...s, gstin: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Tally Gateway URL (optional)</label>
            <input value={settings.tally_gateway_url || ''} onChange={e => setSettings(s => ({ ...s, tally_gateway_url: e.target.value }))} placeholder="https://localhost:9000" style={inp} />
          </div>
          <button onClick={saveSettings} disabled={savingSettings} style={{ padding: '10px 0', background: '#1b4332', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
            {savingSettings ? 'Saving…' : 'Save ledger defaults'}
          </button>
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
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{included.length} vouchers</div>
                <div style={{ fontSize: 11, color: '#8a8d7a' }}>Tap a row to skip it from the XML</div>
              </div>
              <button onClick={downloadXml} style={{ padding: '8px 12px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                Download Tally XML
              </button>
            </div>
            {vouchers.map((v, i) => (
              <button
                key={i}
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
