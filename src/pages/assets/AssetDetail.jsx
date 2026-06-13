import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { STATUS, EVENT_TYPES, summarise, fmtINR, COST_ROLES } from '../../lib/assets'
import { Loader2, Plus } from 'lucide-react'

export default function AssetDetail() {
  const { id } = useParams()
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const showCost = COST_ROLES.includes(employee?.role)

  useEffect(() => { if (plant?.id) load() }, [plant, id]) // eslint-disable-line
  async function load() {
    setLoading(true)
    try {
      const [aRes, eRes] = await Promise.all([
        supabase.from('assets').select('*').eq('id', id).maybeSingle(),
        supabase.from('asset_events').select('*').eq('asset_id', id).order('event_date', { ascending: true }).order('created_at', { ascending: true }),
      ])
      setAsset(aRes.data); setEvents(eRes.data || [])
    } catch { /* */ } finally { setLoading(false) }
  }

  if (loading) return <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fefae0' }}><Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>
  if (!asset) return <div style={{ minHeight: '100%', background: '#fefae0' }}><PageHeader title="Not found" onBack={() => navigate('/assets')} /><p style={{ padding: 24, color: '#595c4a' }}>Asset not found.</p></div>

  const st = STATUS[asset.status] || STATUS.in_store
  const sum = summarise(events)
  const ratio = asset.new_price ? sum.spend / Number(asset.new_price) : 0
  const card = { background: '#fff', border: '1.5px solid #e5ddd0', borderRadius: 16, padding: 16 }
  const kv = (k, v, vc) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f2eee2', fontSize: 13 }}><span style={{ color: '#8a8d7a' }}>{k}</span><span style={{ fontWeight: 700, color: vc || '#2c2c2c', textAlign: 'right' }}>{v}</span></div>

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title={asset.code} subtitle={asset.name} onBack={() => navigate('/assets/catalogue')} />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><div style={{ fontSize: 11, fontWeight: 800, color: '#2d6a4f' }}>{asset.code}</div><div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{asset.name}</div></div>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {kv('Currently at', '📍 ' + (asset.current_location || '—'))}
            {kv('Make / Serial', `${asset.make || '—'} · ${asset.serial_no || '—'}`)}
            {asset.rating ? kv('Rating', asset.rating) : null}
            {kv('Purchased', sum.purchaseDate || '—')}
            {kv('Times repaired', sum.repairs + '×')}
            {showCost ? kv('Lifetime spend', fmtINR(sum.lifetime), '#b45309') : kv('Cost details', '🔒 Admin only', '#b45309')}
            {showCost && asset.new_price ? kv('Repairs vs new price', `${Math.round(ratio * 100)}% of ${fmtINR(asset.new_price)}`) : null}
          </div>
        </div>

        {showCost && asset.status !== 'scrapped' && ratio >= 0.5 && (
          <div style={{ ...card, borderColor: '#fca5a5', background: '#fff5f5' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c' }}>⚠️ Consider replacing</div>
            <div style={{ fontSize: 12, color: '#7a4a4a', marginTop: 4 }}>Repairs have reached {Math.round(ratio * 100)}% of a new unit. A fresh {(asset.asset_type || 'unit').toLowerCase()} is likely cheaper over the next cycle.</div>
          </div>
        )}

        {asset.status !== 'scrapped' && (
          <button onClick={() => navigate('/assets/' + id + '/log')} style={{ width: '100%', padding: 14, borderRadius: 12, background: '#2d6a4f', color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Plus size={18} /> Log an event</button>
        )}

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Full history <span style={{ color: '#8a8d7a', fontWeight: 600 }}>· {events.length} events</span></div>
          <div style={{ position: 'relative', paddingLeft: 26 }}>
            <div style={{ position: 'absolute', left: 9, top: 4, bottom: 4, width: 2, background: '#e5ddd0' }} />
            {[...events].reverse().map(e => {
              const c = EVENT_TYPES[e.event_type] || { label: e.event_type, emoji: '•', color: '#888' }
              const det = [e.work_type, e.note].filter(Boolean).join(' · ')
              const loc = e.to_location || e.from_location
              return (
                <div key={e.id} style={{ position: 'relative', paddingBottom: 16 }}>
                  <div style={{ position: 'absolute', left: -24, top: 1, width: 20, height: 20, borderRadius: '50%', background: c.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{c.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 1 }}>{e.event_date}{loc ? ' · 📍 ' + loc : ''}{e.expected_return ? ' · ⏱ due ' + e.expected_return : ''}</div>
                  {(det || (showCost && (e.cost || e.recovered_value))) && (
                    <div style={{ fontSize: 12, color: '#4a4d3c', marginTop: 4, background: '#faf8ef', border: '1px solid #eee7d5', borderRadius: 8, padding: '6px 8px' }}>
                      {det}{showCost && e.cost ? <span style={{ fontWeight: 800, color: '#b45309' }}> {fmtINR(e.cost)}</span> : null}{showCost && e.recovered_value ? <span style={{ fontWeight: 800, color: '#15803d' }}> ♻️ {fmtINR(e.recovered_value)}</span> : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
