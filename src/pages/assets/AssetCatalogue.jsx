import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { STATUS } from '../../lib/assets'
import { Search, Loader2, AlertCircle } from 'lucide-react'

const FILTERS = ['all', 'running', 'in_store', 'in_repair', 'scrapped']

export default function AssetCatalogue() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(params.get('status') || 'all')

  useEffect(() => { if (plant?.id) load() }, [plant]) // eslint-disable-line
  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('assets').select('*').eq('plant_id', plant.id).eq('is_active', true).order('code')
      setAssets(data || [])
    } catch { /* */ } finally { setLoading(false) }
  }

  const ql = q.toLowerCase()
  const filtered = assets
    .filter(a => status === 'all' ? a.status !== 'scrapped' : a.status === status)
    .filter(a => !ql || `${a.code} ${a.name} ${a.make || ''} ${a.current_location || ''}`.toLowerCase().includes(ql))

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader title="Asset Catalogue" subtitle="Tap an asset for its full history" />
        <div style={{ padding: '12px 20px 0', background: '#fefae0' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a8d7a' }} />
            <input placeholder="Search code, name or machine..." value={q} onChange={e => setQ(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, outline: 'none', background: '#fffdf5', border: '1.5px solid #e5ddd0', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, paddingBottom: 8 }}>
            {FILTERS.map(s => {
              const on = s === status
              return <button key={s} onClick={() => setStatus(s)} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${on ? '#2d6a4f' : '#e5ddd0'}`, background: on ? '#2d6a4f' : '#fff', color: on ? '#fff' : '#6b6f5c', cursor: 'pointer' }}>{s === 'all' ? 'All' : STATUS[s].label}</button>
            })}
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 32, textAlign: 'center' }}>
            <AlertCircle size={30} style={{ color: '#b5b8a8', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: '#595c4a' }}>No assets match.</p>
          </div>
        ) : filtered.map(a => {
          const st = STATUS[a.status] || STATUS.in_store
          return (
            <button key={a.id} onClick={() => navigate('/assets/' + a.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '13px 14px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#2d6a4f' }}>{a.code}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: '#8a8d7a' }}>{a.make || '—'} · 📍 {a.current_location || '—'}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
