import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { Loader2, Package, AlertTriangle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

export default function PartDetailPage() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const [part, setPart] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [usages, setUsages] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('history') // 'history' | 'purchases' | 'usage'

  useEffect(() => { if (plant?.org_id && id) loadData() }, [plant, id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    try {
      const [partRes, purchasesRes, usageRes] = await Promise.all([
        supabase.from('spare_parts').select('*').eq('id', id).single(),
        supabase.from('spare_parts_purchases').select('*, spare_parts_suppliers(name)').eq('part_id', id).order('purchase_date', { ascending: false }),
        supabase.from('spare_parts_usage').select('*').eq('part_id', id).order('usage_date', { ascending: false }),
      ])
      if (partRes.error) throw partRes.error
      setPart(partRes.data)
      setPurchases(purchasesRes.data || [])
      setUsages(usageRes.data || [])
    } catch { showToast('Failed to load part', 'error') } finally { setLoading(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100%', background: '#fefae0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
    </div>
  )
  if (!part) return null

  const totalIn = purchases.reduce((s, p) => s + Number(p.quantity), 0)
  const totalOut = usages.reduce((s, u) => s + Number(u.quantity), 0)
  const currentStock = totalIn - totalOut
  const isLow = currentStock <= part.min_stock_level

  // Merge purchases + usages into a single timeline
  const timeline = [
    ...purchases.map(p => ({ type: 'in', date: p.purchase_date, qty: p.quantity, label: p.spare_parts_suppliers?.name || 'Unknown supplier', sub: p.bill_number ? `Bill: ${p.bill_number}` : '', amount: p.total_amount, id: p.id })),
    ...usages.map(u => ({ type: 'out', date: u.usage_date, qty: u.quantity, label: u.machine_name || 'General use', sub: u.purpose || '', issued: u.issued_to, id: u.id })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  function fmt(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title={part.name} subtitle={part.category || 'Spare Part'} onBack={() => navigate('/spare-parts/parts')} />

      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stock summary card */}
        <div style={{ background: isLow ? '#fee2e2' : '#fff', borderRadius: 14, border: `1.5px solid ${isLow ? '#fca5a5' : '#e5ddd0'}`, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: isLow ? '#fca5a5' : '#e8f0ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isLow ? <AlertTriangle size={22} style={{ color: '#b91c1c' }} /> : <Package size={22} style={{ color: '#2d6a4f' }} />}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: isLow ? '#b91c1c' : '#2d6a4f', lineHeight: 1 }}>{currentStock}</div>
              <div style={{ fontSize: 12, color: '#595c4a' }}>{part.unit} in stock{isLow ? ' — LOW STOCK' : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: '#e8f0ec', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2d6a4f' }}>{totalIn}</div>
              <div style={{ fontSize: 10, color: '#595c4a' }}>Total In</div>
            </div>
            <div style={{ flex: 1, background: '#fff3e0', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#d97706' }}>{totalOut}</div>
              <div style={{ fontSize: 10, color: '#595c4a' }}>Total Used</div>
            </div>
            <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#595c4a' }}>{part.min_stock_level}</div>
              <div style={{ fontSize: 10, color: '#595c4a' }}>Min Level</div>
            </div>
          </div>
        </div>

        {/* Part number / notes */}
        {(part.part_number || part.notes) && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {part.part_number && <div style={{ fontSize: 13, color: '#595c4a' }}><span style={{ fontWeight: 600, color: '#2c2c2c' }}>Part No:</span> {part.part_number}</div>}
            {part.notes && <div style={{ fontSize: 13, color: '#595c4a' }}>{part.notes}</div>}
          </div>
        )}

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/spare-parts/stock-in')} style={{ flex: 1, padding: '12px 0', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ArrowDownCircle size={16} /> Stock In
          </button>
          <button onClick={() => navigate('/spare-parts/issue')} style={{ flex: 1, padding: '12px 0', background: '#d97706', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ArrowUpCircle size={16} /> Issue Part
          </button>
        </div>

        {/* History */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#595c4a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Transaction History</div>
          {timeline.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', padding: 24, textAlign: 'center', color: '#8a8d7a', fontSize: 13 }}>No transactions yet</div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
              {timeline.map((t, idx) => (
                <div key={t.id} style={{ borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: t.type === 'in' ? '#e8f0ec' : '#fff3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {t.type === 'in'
                      ? <ArrowDownCircle size={16} style={{ color: '#2d6a4f' }} />
                      : <ArrowUpCircle size={16} style={{ color: '#d97706' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</div>
                    {t.sub && <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>{t.sub}</div>}
                    <div style={{ fontSize: 10, color: '#b5b8a8', marginTop: 1 }}>{fmt(t.date)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.type === 'in' ? '#2d6a4f' : '#d97706' }}>
                      {t.type === 'in' ? '+' : '-'}{t.qty} <span style={{ fontSize: 10, fontWeight: 400 }}>{part.unit}</span>
                    </div>
                    {t.type === 'in' && t.amount > 0 && <div style={{ fontSize: 10, color: '#8a8d7a' }}>₹{Number(t.amount).toLocaleString('en-IN')}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
