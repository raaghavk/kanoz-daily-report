import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { fmtINR, COST_ROLES } from '../../lib/assets'
import { Loader2 } from 'lucide-react'

export default function AssetSuppliers() {
  const { plant, employee } = useAuth()
    const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const showCost = COST_ROLES.includes(employee?.role)

  useEffect(() => { if (plant?.org_id) load() }, [plant]) // eslint-disable-line
  async function load() {
    setLoading(true)
    try {
      const [supRes, evRes] = await Promise.all([
        supabase.from('spare_parts_suppliers').select('id, name, is_repair_shop').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
        supabase.from('asset_events').select('supplier_id, cost, event_type').eq('org_id', plant.org_id).in('event_type', ['returned', 'repaired']),
      ])
      const stats = {}
      for (const e of (evRes.data || [])) {
        if (!e.supplier_id || !e.cost) continue
        stats[e.supplier_id] = stats[e.supplier_id] || { jobs: 0, paid: 0 }
        stats[e.supplier_id].jobs++; stats[e.supplier_id].paid += Number(e.cost) || 0
      }
      setRows((supRes.data || []).map(s => ({ ...s, ...(stats[s.id] || { jobs: 0, paid: 0 }) })))
    } catch { /* */ } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Suppliers & Repair Shops" subtitle="Shared with Spare Parts" />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: '#8a8d7a' }}>The same list as Spare Parts → Suppliers. Repair history is counted from asset repairs.</div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Loader2 size={26} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>
        ) : rows.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 28, textAlign: 'center', fontSize: 13, color: '#595c4a' }}>No suppliers yet. Add one from Spare Parts → Suppliers or when logging a purchase.</div>
        ) : rows.map(s => {
          const repair = s.is_repair_shop || s.jobs > 0
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#8a8d7a' }}>{s.jobs ? `${s.jobs} repair${s.jobs > 1 ? 's' : ''}${showCost ? ' · ' + fmtINR(s.paid) + ' paid' : ''}` : 'No asset repairs logged'}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 20, background: repair ? '#f3e8ff' : '#EEF2FF', color: repair ? '#7c3aed' : '#2563eb' }}>{repair ? 'Repair Shop' : 'Supplier'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
