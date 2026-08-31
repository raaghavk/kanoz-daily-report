import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { MapPin, Plus, Loader2, ArrowRightLeft } from 'lucide-react'

export default function PlotsPage() {
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const [plots, setPlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', kind: 'storage', address: '', notes: '', distance_m: '' })

  async function load() {
    if (!plant?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('storage_plots')
        .select('*')
        .eq('plant_id', plant.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('name')
      if (error) throw error
      setPlots(data || [])
    } catch (err) {
      showToast(err.message || 'Failed to load plots', 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [plant?.id]) // eslint-disable-line

  async function addPlot() {
    if (!form.name.trim()) { showToast('Plot name is required', 'error'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('storage_plots').insert({
        plant_id: plant.id,
        name: form.name.trim(),
        kind: form.kind,
        is_primary: false,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        distance_m: form.distance_m === '' ? null : Number(form.distance_m),
        is_active: true,
      })
      if (error) throw error
      showToast('Plot added', 'success')
      setForm({ name: '', kind: 'storage', address: '', notes: '', distance_m: '' })
      load()
    } catch (err) {
      showToast(err.message || 'Failed to add plot', 'error')
    } finally { setSaving(false) }
  }

  async function archivePlot(id, isPrimary) {
    if (isPrimary) { showToast('The main factory plot cannot be removed', 'error'); return }
    try {
      const { error } = await supabase.from('storage_plots').update({ is_active: false }).eq('id', id)
      if (error) throw error
      showToast('Plot archived', 'success')
      load()
    } catch (err) { showToast(err.message || 'Failed', 'error') }
  }

  const inp = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Land plots" subtitle={`${plant?.name || 'Plant'} · storage yards attached to this factory`} backTo="/settings" />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#e8f0ec', borderRadius: 14, padding: 14, fontSize: 12, color: '#2d6a4f', lineHeight: 1.5 }}>
          A plot is land used by this factory — not a separate plant. Use it for a yard 500 m away that holds raw material until you transfer it to the main factory land.
        </div>

        <button onClick={() => navigate('/stock/transfer')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <ArrowRightLeft size={16} /> Transfer stock between plots
        </button>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          plots.map(p => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={14} style={{ color: '#2d6a4f' }} /> {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 4 }}>
                    {p.is_primary ? 'Main factory land' : (p.kind === 'factory' ? 'Factory' : 'Storage yard')}
                    {p.distance_m != null ? ` · ${p.distance_m} m from plant` : ''}
                  </div>
                  {p.address && <div style={{ fontSize: 12, color: '#595c4a', marginTop: 4 }}>{p.address}</div>}
                  {p.notes && <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 4 }}>{p.notes}</div>}
                </div>
                {!p.is_primary && (
                  <button onClick={() => archivePlot(p.id, p.is_primary)} style={{ fontSize: 11, color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                )}
              </div>
            </div>
          ))
        )}

        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>Add a storage plot</div>
          <div>
            <label style={lbl}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., North yard (500 m)" style={inp} />
          </div>
          <div>
            <label style={lbl}>Distance from factory (metres)</label>
            <input type="number" value={form.distance_m} onChange={e => setForm(f => ({ ...f, distance_m: e.target.value }))} placeholder="500" style={inp} />
          </div>
          <div>
            <label style={lbl}>Address / landmark</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Optional" style={inp} />
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What is stored here" style={inp} />
          </div>
          <button onClick={addPlot} disabled={saving || !employee} style={{ padding: '11px 0', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{saving ? 'Adding…' : 'Add plot'}
          </button>
        </div>
      </div>
    </div>
  )
}
