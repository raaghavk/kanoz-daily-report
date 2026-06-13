import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { Loader2 } from 'lucide-react'

export default function AssetsHome() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (plant?.id) load() }, [plant]) // eslint-disable-line
  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('assets')
        .select('id, code, name, status, current_location')
        .eq('plant_id', plant.id).eq('is_active', true).order('code')
      setAssets(data || [])
    } catch { /* silent */ } finally { setLoading(false) }
  }

  const active = assets.filter(a => a.status !== 'scrapped')
  const running = active.filter(a => a.status === 'running').length
  const repair = active.filter(a => a.status === 'in_repair').length
  const store = active.filter(a => a.status === 'in_store').length
  const atRepair = active.filter(a => a.status === 'in_repair')

  function findByCode() {
    const c = window.prompt('Enter or scan asset code (e.g. MTR-0427)')
    if (c && c.trim()) navigate('/a/' + c.trim().toUpperCase())
  }

  const stat = (n, label, to, color, border, bg) => (
    <button onClick={() => navigate(to)} style={{ textAlign: 'left', cursor: 'pointer', background: bg || '#fff', borderRadius: 14, border: `1.5px solid ${border || '#e5ddd0'}`, padding: '12px 14px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || '#2c2c2c' }}>{n}</div>
      <div style={{ fontSize: 11, color: '#8a8d7a' }}>{label} ›</div>
    </button>
  )
  const tile = (emoji, t, s, onClick, bg) => (
    <button onClick={onClick} style={{ background: '#fff', border: '1.5px solid #e5ddd0', borderRadius: 16, padding: '16px 14px', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#2c2c2c' }}>{t}</div>
      <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>{s}</div>
    </button>
  )

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Assets" subtitle={`${plant?.name || 'Plant'} · Equipment lifecycle tracking`} onBack={() => navigate('/settings')} />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {stat(active.length, 'Active Assets', '/assets/catalogue')}
              {stat(running, 'Running', '/assets/catalogue?status=running', '#15803d', '#bbf7d0', '#f0fdf4')}
              {stat(repair, 'At Repair', '/assets/catalogue?status=in_repair', '#b45309', '#fde68a', '#fffbeb')}
              {stat(store, 'In Store', '/assets/catalogue?status=in_store', '#475569')}
            </div>

            {atRepair.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #fde68a', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: '#fef3c7', fontSize: 12, fontWeight: 800, color: '#b45309' }}>⏳ OUT FOR REPAIR</div>
                {atRepair.map((a, i) => (
                  <button key={a.id} onClick={() => navigate('/assets/' + a.id)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #f2eee2' : 'none', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#2d6a4f' }}>{a.code}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: '#8a8d7a' }}>📍 {a.current_location || '—'}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 20, background: '#fef3c7', color: '#b45309' }}>At Repair</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {tile('📷', 'Scan / Find', 'Open an asset by its code', findByCode, '#EEF2FF')}
              {tile('📦', 'Asset Catalogue', 'Browse, filter & search', () => navigate('/assets/catalogue'), '#e8f0ec')}
              {tile('🏷️', 'Add New Asset', 'Register & print QR tag', () => navigate('/assets/new'), '#FEF3C7')}
              {tile('🏭', 'Suppliers', 'Suppliers & repair shops', () => navigate('/spare-parts/suppliers'), '#f3e8ff')}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
