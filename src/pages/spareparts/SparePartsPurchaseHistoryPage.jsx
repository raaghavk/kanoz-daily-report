import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { Loader2, ChevronRight, Download } from 'lucide-react'

export default function SparePartsPurchaseHistoryPage() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => { if (plant?.id) load() }, [plant, filterMonth]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const [year, month] = filterMonth.split('-')
      const from = `${year}-${month}-01`
      const to = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('spare_parts_purchases')
        .select('id, purchase_date, quantity, rate_per_unit, total_amount, gst_percent, invoice_number, warranty_months, warranty_expiry_date, no_warranty, part_id, supplier_id, purchased_by, spare_parts(name, unit, brand, category), spare_parts_suppliers(name)')
        .eq('plant_id', plant.id)
        .gte('purchase_date', from)
        .lte('purchase_date', to)
        .order('purchase_date', { ascending: false })

      if (error) throw error
      setRecords(data || [])
    } catch { /* silent */ } finally { setLoading(false) }
  }

  function exportCSV() {
    const headers = ['Date', 'Part', 'Brand', 'Category', 'Qty', 'Unit', 'Rate (₹)', 'GST %', 'Total (₹)', 'Supplier', 'Invoice No', 'Warranty', 'Purchased By']
    const rows = records.map(r => [
      r.purchase_date,
      r.spare_parts?.name || '',
      r.spare_parts?.brand || '',
      r.spare_parts?.category || '',
      r.quantity,
      r.spare_parts?.unit || '',
      r.rate_per_unit,
      r.gst_percent,
      r.total_amount,
      r.spare_parts_suppliers?.name || '',
      r.invoice_number || '',
      r.no_warranty ? 'No Warranty' : r.warranty_months ? `${r.warranty_months} months` : '',
      r.purchased_by || '',
    ])
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spare-parts-purchases-${filterMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalSpend = records.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)

  const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtAmt = n => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  // Generate last 12 months for filter
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    return { val, label }
  })

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Purchase History" subtitle={`${plant?.name} · Spare Parts Purchased`} onBack={() => navigate('/spare-parts')} />

      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Filter + Export row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fff', fontSize: 14, outline: 'none' }}>
            {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <button onClick={exportCSV} disabled={!records.length}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#2d6a4f', color: 'white', borderRadius: 12, border: 'none', cursor: records.length ? 'pointer' : 'not-allowed', opacity: records.length ? 1 : 0.5, fontSize: 13, fontWeight: 600 }}>
            <Download size={15} /> CSV
          </button>
        </div>

        {/* Summary */}
        {!loading && records.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2563EB' }}>{records.length}</div>
              <div style={{ fontSize: 11, color: '#8a8d7a' }}>Purchases</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '12px 14px' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#2d6a4f' }}>{fmtAmt(totalSpend)}</div>
              <div style={{ fontSize: 11, color: '#8a8d7a' }}>Total Spend</div>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8a8d7a' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No purchases this month</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            {records.map((r, idx) => (
              <div key={r.id} style={{ padding: '12px 16px', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{r.spare_parts?.name || '—'}</div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>
                    {r.spare_parts?.brand && `${r.spare_parts.brand} · `}{r.quantity} {r.spare_parts?.unit} · {r.spare_parts_suppliers?.name || 'No supplier'}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 1 }}>
                    {fmtDate(r.purchase_date)} {r.purchased_by ? `· by ${r.purchased_by}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2d6a4f' }}>{fmtAmt(r.total_amount)}</div>
                  <div style={{ fontSize: 10, color: '#8a8d7a' }}>GST {r.gst_percent}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
