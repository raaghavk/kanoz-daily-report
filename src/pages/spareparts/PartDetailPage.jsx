import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { Loader2, Package, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Building2, Pencil, Check, X } from 'lucide-react'

export default function PartDetailPage() {
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const [part, setPart] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [usages, setUsages] = useState([])
  const [plantStock, setPlantStock] = useState([]) // [{id, name, stock, min_stock_level}]
  const [loading, setLoading] = useState(true)
  const [editingMinPlant, setEditingMinPlant] = useState(null) // plant_id being edited
  const [editMinValue, setEditMinValue] = useState('')
  const [savingMin, setSavingMin] = useState(false)

  useEffect(() => { if (plant?.org_id && id) loadData() }, [plant, id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    try {
      const [partRes, purchasesRes, usageRes, plantsRes, configRes] = await Promise.all([
        supabase.from('spare_parts').select('*').eq('id', id).single(),
        supabase.from('spare_parts_purchases').select('*, spare_parts_suppliers(name), plants(name)').eq('part_id', id).order('purchase_date', { ascending: false }),
        supabase.from('spare_parts_usage').select('*, plants(name)').eq('part_id', id).order('usage_date', { ascending: false }),
        supabase.from('plants').select('id, name').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
        supabase.from('spare_parts_plant_config').select('plant_id, min_stock_level').eq('part_id', id),
      ])
      if (partRes.error) throw partRes.error
      setPart(partRes.data)
      setPurchases(purchasesRes.data || [])
      setUsages(usageRes.data || [])

      const allPlants = plantsRes.data || []
      const configMap = {}
      for (const c of (configRes.data || [])) configMap[c.plant_id] = Number(c.min_stock_level)

      const plantStockMap = {}
      for (const p of allPlants) plantStockMap[p.id] = { name: p.name, stockIn: 0, stockOut: 0, min: configMap[p.id] ?? null }
      for (const r of (purchasesRes.data || [])) {
        if (r.plant_id && plantStockMap[r.plant_id]) plantStockMap[r.plant_id].stockIn += Number(r.quantity)
      }
      for (const r of (usageRes.data || [])) {
        if (r.plant_id && plantStockMap[r.plant_id]) plantStockMap[r.plant_id].stockOut += Number(r.quantity)
      }
      setPlantStock(
        Object.entries(plantStockMap)
          .map(([pid, v]) => ({ id: pid, name: v.name, stock: v.stockIn - v.stockOut, min: v.min }))
          .filter(p => p.stock !== 0 || p.min !== null || allPlants.length <= 3)
      )
    } catch { showToast('Failed to load part', 'error') } finally { setLoading(false) }
  }

  async function requestDeletion() {
    const reason = window.prompt('Reason for deletion request:')
    if (!reason?.trim()) return
    const { error } = await supabase.from('delete_requests').insert([{
      entity_type: 'spare_part',
      entity_id: part.id,
      requested_by: employee.id,
      reason: reason.trim(),
      status: 'pending',
      org_id: plant.org_id,
    }])
    if (error) { showToast('Failed to submit request', 'error'); return }
    showToast('Deletion request submitted', 'success')
  }

  async function deactivatePart() {
    if (!window.confirm(`Deactivate "${part.name}"? It will no longer appear in stock in or usage forms. This can be undone by contacting admin.`)) return
    try {
      await supabase.from('spare_parts').update({ is_active: false }).eq('id', id)
      showToast('Part deactivated', 'success')
      navigate('/spare-parts/parts')
    } catch { showToast('Failed to deactivate', 'error') }
  }

  async function saveMinStock(plantId) {
    if (editMinValue === '' || editMinValue === null) { showToast('Enter a value', 'error'); return }
    setSavingMin(true)
    try {
      await supabase.from('spare_parts_plant_config').upsert({
        org_id: plant.org_id, plant_id: plantId, part_id: id,
        min_stock_level: parseFloat(editMinValue) || 0,
      }, { onConflict: 'plant_id,part_id' })
      setPlantStock(prev => prev.map(p => p.id === plantId ? { ...p, min: parseFloat(editMinValue) || 0 } : p))
      setEditingMinPlant(null)
      showToast('Min stock updated', 'success')
    } catch { showToast('Failed to update', 'error') } finally { setSavingMin(false) }
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
  // isLow: check against current plant's configured min (if any)
  const currentPlantConfig = plantStock.find(ps => ps.id === plant.id)
  const isLow = currentPlantConfig?.min != null
    ? currentPlantConfig.stock <= currentPlantConfig.min
    : false

  // Merge purchases + usages into a single timeline
  const timeline = [
    ...purchases.map(p => ({ type: 'in', date: p.purchase_date, qty: p.quantity, label: p.spare_parts_suppliers?.name || 'Unknown supplier', sub: [p.plants?.name, p.bill_number ? `Bill: ${p.bill_number}` : ''].filter(Boolean).join(' · '), amount: p.total_amount, id: p.id })),
    ...usages.map(u => ({ type: 'out', date: u.usage_date, qty: u.quantity, label: u.machine_name || 'General use', sub: [u.plants?.name, u.purpose].filter(Boolean).join(' · '), issued: u.issued_to, id: u.id })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  function fmt(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title={part.name} subtitle={part.category || 'Spare Part'} />

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

        {/* Part details — number, brand, notes */}
        {(part.part_number || part.brand || part.notes) && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {part.part_number && <div style={{ fontSize: 13, color: '#595c4a' }}><span style={{ fontWeight: 600, color: '#2c2c2c' }}>Part No:</span> {part.part_number}</div>}
            {part.brand && <div style={{ fontSize: 13, color: '#595c4a' }}><span style={{ fontWeight: 600, color: '#2c2c2c' }}>Brand:</span> {part.brand}</div>}
            {part.notes && <div style={{ fontSize: 13, color: '#595c4a' }}>{part.notes}</div>}
          </div>
        )}

        {/* Per-plant stock breakdown with editable min stock */}
        {plantStock.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#f0f7f3', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={14} style={{ color: '#2d6a4f' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.4 }}>Stock by Plant</span>
            </div>
            {plantStock.map((ps, idx) => {
              const low = ps.min != null && ps.stock <= ps.min
              return (
                <div key={ps.id} style={{ borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', padding: '10px 14px', background: low ? '#fff9f9' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#2c2c2c', fontWeight: 600 }}>{ps.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: low ? '#b91c1c' : '#2d6a4f' }}>
                      {ps.stock} <span style={{ fontSize: 10, fontWeight: 400 }}>{part.unit}</span>
                      {low && <span style={{ fontSize: 9, color: '#b91c1c', fontWeight: 700, marginLeft: 4 }}>LOW</span>}
                    </span>
                  </div>
                  {/* Min stock display / edit */}
                  {editingMinPlant === ps.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: '#8a8d7a', flexShrink: 0 }}>Min:</span>
                      <input type="number" value={editMinValue} onChange={e => setEditMinValue(e.target.value)}
                        min="0" step="1" autoFocus
                        style={{ width: 70, padding: '4px 8px', borderRadius: 8, border: '1.5px solid #2d6a4f', background: '#fefae0', fontSize: 13, outline: 'none' }} />
                      <span style={{ fontSize: 11, color: '#8a8d7a' }}>{part.unit}</span>
                      <button onClick={() => saveMinStock(ps.id)} disabled={savingMin}
                        style={{ padding: '4px 8px', background: '#2d6a4f', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600 }}>
                        <Check size={12} /> Save
                      </button>
                      <button onClick={() => setEditingMinPlant(null)}
                        style={{ padding: '4px 6px', background: '#f3f4f6', color: '#595c4a', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: '#8a8d7a' }}>
                        Min: {ps.min != null ? `${ps.min} ${part.unit}` : <span style={{ color: '#d97706' }}>not set</span>}
                      </span>
                      <button onClick={() => { setEditingMinPlant(ps.id); setEditMinValue(ps.min != null ? String(ps.min) : '') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 6px', background: 'none', border: '1px solid #e5ddd0', borderRadius: 5, cursor: 'pointer', fontSize: 10, color: '#8a8d7a', fontWeight: 600 }}>
                        <Pencil size={9} /> Edit
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/spare-parts/stock-in')} style={{ flex: 1, padding: '12px 0', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ArrowDownCircle size={16} /> Purchase
          </button>
          <button onClick={() => navigate('/spare-parts/issue')} style={{ flex: 1, padding: '12px 0', background: '#d97706', color: 'white', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ArrowUpCircle size={16} /> Record Usage
          </button>
        </div>

        {/* Deactivate */}
        <button onClick={deactivatePart} style={{ width: '100%', padding: '12px 0', background: 'none', color: '#b91c1c', borderRadius: 12, fontSize: 13, fontWeight: 600, border: '1.5px solid #fca5a5', cursor: 'pointer' }}>
          Deactivate Part
        </button>

        {/* Request Deletion */}
        <button onClick={requestDeletion} style={{ width: '100%', padding: '12px 0', background: 'none', color: '#d32f2f', borderRadius: 12, fontSize: 13, fontWeight: 600, border: '1.5px solid #fca5a5', cursor: 'pointer' }}>
          Request Deletion
        </button>

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
