import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { can } from '../../lib/permissions'
import PageHeader from '../../components/PageHeader'
import { showToast } from '../../components/Toast'
import { getLocalDate } from '../../lib/dateUtils'
import { Plus, Trash2, Loader2, IndianRupee } from 'lucide-react'

const GREEN = '#2d6a4f', DARK = '#1b4332', MUTED = '#8a8d7a', TEXT = '#2c2c2c', BORDER = '#e5ddd0'
const CATEGORIES = ['Electricity', 'Diesel / Fuel', 'Labour & Wages', 'Salaries', 'Raw Material', 'Maintenance & Spares', 'Transport / Freight', 'Rent / Lease', 'Packing', 'Admin / Office', 'Interest / Finance', 'Other']

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

export default function FinancePage() {
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const isAdmin = can(employee?.role, 'view_finance')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const [category, setCategory] = useState(CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [costDate, setCostDate] = useState(getLocalDate())

  const load = useCallback(async () => {
    if (!plant?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('finance_costs')
        .select('*')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      setRows(data || [])
    } catch { showToast('Failed to load costs', 'error') } finally { setLoading(false) }
  }, [plant?.id])

  useEffect(() => { load() }, [load])

  async function addCost() {
    if (saving) return
    const amt = Number(amount)
    if (!category) { showToast('Pick a category', 'error'); return }
    if (Number.isNaN(amt) || amt <= 0) { showToast('Enter a valid amount', 'error'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('finance_costs').insert({
        org_id: plant.org_id,
        plant_id: plant.id,
        category,
        description: description.trim() || null,
        amount: amt,
        frequency,
        cost_date: frequency === 'one_time' ? costDate : null,
        created_by: employee?.id || null,
      })
      if (error) throw error
      showToast('Cost added', 'success')
      setDescription(''); setAmount('')
      await load()
    } catch { showToast('Failed to add cost', 'error') } finally { setSaving(false) }
  }

  async function removeCost(row) {
    if (deletingId) return
    if (!window.confirm(`Remove "${row.category}" cost of ${inr(row.amount)}?`)) return
    setDeletingId(row.id)
    try {
      const { error } = await supabase.from('finance_costs').update({ is_deleted: true }).eq('id', row.id)
      if (error) throw error
      setRows(prev => prev.filter(r => r.id !== row.id))
    } catch { showToast('Failed to remove', 'error') } finally { setDeletingId(null) }
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100%', background: '#fefae0' }}>
        <PageHeader title="Finance" subtitle={plant?.name || 'Plant'} backTo="/" />
        <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK, marginTop: 8 }}>Admin only</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>The finance module is visible to admins only.</div>
          <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 10, border: 'none', background: GREEN, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Back to app</button>
        </div>
      </div>
    )
  }

  const monthly = rows.filter(r => r.frequency === 'monthly').reduce((a, r) => a + (Number(r.amount) || 0), 0)
  const thisMonth = getLocalDate().slice(0, 7)
  const oneTimeThisMonth = rows.filter(r => r.frequency === 'one_time' && (r.cost_date || '').slice(0, 7) === thisMonth).reduce((a, r) => a + (Number(r.amount) || 0), 0)

  // Group by category for the recurring picture
  const byCat = {}
  for (const r of rows) {
    if (r.frequency !== 'monthly') continue
    byCat[r.category] = (byCat[r.category] || 0) + (Number(r.amount) || 0)
  }
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1])

  const card = { background: '#fff', borderRadius: 14, border: `1.5px solid ${BORDER}` }
  const label = { fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }
  const input = { width: '100%', padding: '11px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 14, color: TEXT, outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Finance" subtitle={plant?.name || 'Plant'} backTo="/" />
      <div style={{ padding: '16px 20px 40px' }}>

        {/* Summary */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <div style={{ ...card, flex: 1, padding: '14px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{inr(monthly)}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', marginTop: 4 }}>Monthly recurring</div>
          </div>
          <div style={{ ...card, flex: 1, padding: '14px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>{inr(oneTimeThisMonth)}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', marginTop: 4 }}>One-time this month</div>
          </div>
        </div>

        {/* Add cost */}
        <div style={{ ...card, padding: 16, marginBottom: 18 }}>
          <div style={label}>Add a cost</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>Category</div>
            <select value={category} onChange={e => setCategory(e.target.value)} style={input}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>Description (optional)</div>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. UPPCL bill, June" style={input} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>Amount ₹</div>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" inputMode="decimal" min="0" placeholder="0" style={input} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>Type</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['monthly', 'Monthly'], ['one_time', 'One-time']].map(([v, l]) => (
                  <button key={v} onClick={() => setFrequency(v)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${frequency === v ? GREEN : BORDER}`, background: frequency === v ? '#e8f0ec' : '#fff', color: frequency === v ? GREEN : MUTED, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          {frequency === 'one_time' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>Date</div>
              <input type="date" value={costDate} max={getLocalDate()} onChange={e => setCostDate(e.target.value)} style={input} />
            </div>
          )}
          <button onClick={addCost} disabled={saving} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 12, border: 'none', background: saving ? '#c3d2c9' : GREEN, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />} Add cost
          </button>
        </div>

        {/* Recurring by category */}
        {catList.length > 0 && (
          <>
            <div style={label}>Monthly cost breakdown</div>
            <div style={{ ...card, marginBottom: 18, overflow: 'hidden' }}>
              {catList.map(([c, v], i) => (
                <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderTop: i > 0 ? `1px solid #f0ebe0` : 'none' }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{c}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{inr(v)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* All entries */}
        <div style={label}>All entries</div>
        <div style={{ ...card, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: MUTED }}>No costs added yet. Add your first cost above — build this up over time.</div>
          ) : (
            rows.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i > 0 ? `1px solid #f0ebe0` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{r.category}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, background: '#f0ebe0', color: MUTED, borderRadius: 5, padding: '1px 5px', textTransform: 'uppercase' }}>{r.frequency === 'monthly' ? 'Monthly' : 'One-time'}</span>
                  </div>
                  {(r.description || r.cost_date) && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{r.description || ''}{r.description && r.cost_date ? ' · ' : ''}{r.cost_date || ''}</div>}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{inr(r.amount)}</span>
                <button disabled={deletingId === r.id} onClick={() => removeCost(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', padding: 4 }}>
                  {deletingId === r.id ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={15} />}
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ fontSize: 11, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>
          Add costs as you go — electricity, diesel, wages, spares, rent and more. This builds the foundation for full per-MT cost of production in the dashboard.
        </div>
      </div>
    </div>
  )
}
