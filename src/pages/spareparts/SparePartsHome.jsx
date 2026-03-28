import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { Package, ArrowDownCircle, ArrowUpCircle, Users, AlertTriangle, Loader2, History, ClipboardList, RefreshCw } from 'lucide-react'
import { getLocalDate } from '../../lib/dateUtils'

export default function SparePartsHome() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ totalParts: 0, lowStock: 0, todayIn: 0, todayOut: 0 })
  const [lowParts, setLowParts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (plant?.org_id) loadStats() }, [plant]) // eslint-disable-line

  async function loadStats() {
    setLoading(true)
    try {
      const today = getLocalDate()
      const { data: partsData } = await supabase.from('spare_parts').select('id, name, unit').eq('org_id', plant.org_id).eq('is_active', true)
      const partIds = (partsData || []).map(p => p.id)

      const [purchasesRes, usageRes, todayInRes, todayOutRes, configRes] = await Promise.all([
        supabase.from('spare_parts_purchases').select('part_id, quantity').eq('plant_id', plant.id).in('part_id', partIds),
        supabase.from('spare_parts_usage').select('part_id, quantity').eq('plant_id', plant.id).in('part_id', partIds),
        supabase.from('spare_parts_purchases').select('quantity').eq('plant_id', plant.id).eq('purchase_date', today),
        supabase.from('spare_parts_usage').select('quantity').eq('plant_id', plant.id).eq('usage_date', today),
        supabase.from('spare_parts_plant_config').select('part_id, min_stock_level').eq('plant_id', plant.id).in('part_id', partIds),
      ])

      const purchaseMap = {}
      for (const r of (purchasesRes.data || [])) purchaseMap[r.part_id] = (purchaseMap[r.part_id] || 0) + Number(r.quantity)
      const usageMap = {}
      for (const r of (usageRes.data || [])) usageMap[r.part_id] = (usageMap[r.part_id] || 0) + Number(r.quantity)
      const configMap = {}
      for (const r of (configRes.data || [])) configMap[r.part_id] = Number(r.min_stock_level)

      const enriched = (partsData || []).map(p => ({
        ...p,
        current_stock: (purchaseMap[p.id] || 0) - (usageMap[p.id] || 0),
        plant_min: configMap[p.id] ?? null,
      }))
      // Only flag low stock for parts that have a min configured at this plant
      const low = enriched.filter(p => p.plant_min != null && p.current_stock <= p.plant_min)

      setLowParts(low.slice(0, 5))
      setStats({
        totalParts: enriched.length,
        lowStock: low.length,
        todayIn: (todayInRes.data || []).reduce((s, r) => s + Number(r.quantity), 0),
        todayOut: (todayOutRes.data || []).reduce((s, r) => s + Number(r.quantity), 0),
      })
    } catch { /* silent */ } finally { setLoading(false) }
  }

  const tiles = [
    { icon: <Package size={22} style={{ color: '#2d6a4f' }} />, label: 'Parts Catalogue', sub: 'View & manage all parts', bg: '#e8f0ec', path: '/spare-parts/parts' },
    { icon: <ArrowDownCircle size={22} style={{ color: '#2563EB' }} />, label: 'Purchase (Stock In)', sub: 'Record parts purchased', bg: '#EEF2FF', path: '/spare-parts/stock-in' },
    { icon: <ArrowUpCircle size={22} style={{ color: '#d97706' }} />, label: 'Record Usage', sub: 'Record parts used', bg: '#FEF3C7', path: '/spare-parts/issue' },
    { icon: <History size={22} style={{ color: '#2563EB' }} />, label: 'Purchase History', sub: 'All parts purchased', bg: '#EEF2FF', path: '/spare-parts/purchase-history' },
    { icon: <ClipboardList size={22} style={{ color: '#d97706' }} />, label: 'Usage History', sub: 'All parts used', bg: '#FEF3C7', path: '/spare-parts/usage-history' },
    { icon: <RefreshCw size={22} style={{ color: '#b91c1c' }} />, label: 'Reorder Requests', sub: 'Track parts to reorder', bg: '#fee2e2', path: '/spare-parts/reorder' },
    { icon: <Users size={22} style={{ color: '#7c3aed' }} />, label: 'Suppliers', sub: 'Parts vendors directory', bg: '#f3e8ff', path: '/spare-parts/suppliers' },
  ]

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Spare Parts" subtitle={`${plant?.name || 'Plant'} · Inventory & maintenance tracking`} onBack={() => navigate('/settings')} />

      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stats row */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2c2c2c' }}>{stats.totalParts}</div>
              <div style={{ fontSize: 11, color: '#8a8d7a' }}>Total Parts</div>
            </div>
            <div style={{ background: stats.lowStock > 0 ? '#fee2e2' : '#fff', borderRadius: 14, border: `1.5px solid ${stats.lowStock > 0 ? '#fca5a5' : '#e5ddd0'}`, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: stats.lowStock > 0 ? '#b91c1c' : '#2c2c2c', display: 'flex', alignItems: 'center', gap: 4 }}>
                {stats.lowStock > 0 && <AlertTriangle size={16} />}{stats.lowStock}
              </div>
              <div style={{ fontSize: 11, color: stats.lowStock > 0 ? '#b91c1c' : '#8a8d7a' }}>Low Stock</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2d6a4f' }}>+{stats.todayIn}</div>
              <div style={{ fontSize: 11, color: '#8a8d7a' }}>Purchased Today</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{stats.todayOut}</div>
              <div style={{ fontSize: 11, color: '#8a8d7a' }}>Used Today</div>
            </div>
          </div>
        )}

        {/* Low stock alert */}
        {lowParts.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #fca5a5', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#fee2e2', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} style={{ color: '#b91c1c' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>LOW STOCK ALERT</span>
            </div>
            {lowParts.map((p, idx) => (
              <button key={p.id} onClick={() => navigate(`/spare-parts/parts/${p.id}`)}
                style={{ width: '100%', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 13, color: '#2c2c2c', fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>{p.current_stock} {p.unit}</span>
              </button>
            ))}
            {stats.lowStock > 5 && (
              <button onClick={() => navigate('/spare-parts/parts')} style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', borderTop: '1px solid #f0ebe0', fontSize: 12, color: '#b91c1c', fontWeight: 600, cursor: 'pointer' }}>
                +{stats.lowStock - 5} more →
              </button>
            )}
          </div>
        )}

        {/* Navigation tiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tiles.map(tile => (
            <button key={tile.path} onClick={() => navigate(tile.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '14px 16px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', cursor: 'pointer' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: tile.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {tile.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{tile.label}</div>
                <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>{tile.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
