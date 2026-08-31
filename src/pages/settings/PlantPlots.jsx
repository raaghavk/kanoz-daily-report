import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { MapPin, Plus, Loader2, Pencil, Check, X } from 'lucide-react'

const inp = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }

const emptyForm = { name: '', address: '', distance_km: '', location_lat: '', location_lng: '' }

/** Manage storage plots for one plant — used inside Plant Settings. */
export default function PlantPlots({ plantId }) {
  const [plots, setPlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)

  async function load() {
    if (!plantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('storage_plots')
        .select('*')
        .eq('plant_id', plantId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('name')
      if (error) throw error
      setPlots(data || [])
    } catch (err) {
      showToast(err.message || 'Failed to load plots', 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [plantId]) // eslint-disable-line

  function distanceKm(p) {
    if (p.distance_km != null && p.distance_km !== '') return Number(p.distance_km)
    if (p.distance_m != null) return Number(p.distance_m) / 1000
    return null
  }

  async function addPlot() {
    if (!form.name.trim()) { showToast('Plot name is required', 'error'); return }
    setSaving(true)
    try {
      const km = form.distance_km === '' ? null : Number(form.distance_km)
      const { error } = await supabase.from('storage_plots').insert({
        plant_id: plantId,
        name: form.name.trim(),
        kind: 'storage',
        is_primary: false,
        address: form.address.trim() || null,
        notes: null,
        distance_km: km,
        distance_m: km == null ? null : km * 1000,
        location_lat: form.location_lat === '' ? null : Number(form.location_lat),
        location_lng: form.location_lng === '' ? null : Number(form.location_lng),
        is_active: true,
      })
      if (error) throw error
      showToast('Plot added', 'success')
      setForm(emptyForm)
      load()
    } catch (err) {
      showToast(err.message || 'Failed to add plot', 'error')
    } finally { setSaving(false) }
  }

  function startEdit(p) {
    setEditingId(p.id)
    const km = distanceKm(p)
    setEditForm({
      name: p.name || '',
      address: p.address || '',
      distance_km: km == null ? '' : String(km),
      location_lat: p.location_lat == null ? '' : String(p.location_lat),
      location_lng: p.location_lng == null ? '' : String(p.location_lng),
    })
  }

  async function saveEdit() {
    if (!editForm.name.trim()) { showToast('Plot name is required', 'error'); return }
    setSaving(true)
    try {
      const km = editForm.distance_km === '' ? null : Number(editForm.distance_km)
      const { error } = await supabase.from('storage_plots').update({
        name: editForm.name.trim(),
        address: editForm.address.trim() || null,
        distance_km: km,
        distance_m: km == null ? null : km * 1000,
        location_lat: editForm.location_lat === '' ? null : Number(editForm.location_lat),
        location_lng: editForm.location_lng === '' ? null : Number(editForm.location_lng),
      }).eq('id', editingId)
      if (error) throw error
      showToast('Plot updated', 'success')
      setEditingId(null)
      load()
    } catch (err) {
      showToast(err.message || 'Failed to update', 'error')
    } finally { setSaving(false) }
  }

  async function archivePlot(id, isPrimary) {
    if (isPrimary) { showToast('The main factory plot cannot be removed', 'error'); return }
    if (!window.confirm('Remove this plot? Stock history stays; the plot is just archived.')) return
    try {
      const { error } = await supabase.from('storage_plots').update({ is_active: false }).eq('id', id)
      if (error) throw error
      showToast('Plot removed', 'success')
      load()
    } catch (err) { showToast(err.message || 'Failed', 'error') }
  }

  function FormFields({ value, onChange }) {
    return (
      <>
        <div>
          <label style={lbl}>Name *</label>
          <input value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} placeholder="e.g. North yard" style={inp} />
        </div>
        <div>
          <label style={lbl}>Distance from factory (km)</label>
          <input type="number" step="0.01" value={value.distance_km} onChange={e => onChange({ ...value, distance_km: e.target.value })} placeholder="0.5" style={inp} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={lbl}>Latitude</label>
            <input type="number" step="any" value={value.location_lat} onChange={e => onChange({ ...value, location_lat: e.target.value })} placeholder="25.4358" style={inp} />
          </div>
          <div>
            <label style={lbl}>Longitude</label>
            <input type="number" step="any" value={value.location_lng} onChange={e => onChange({ ...value, location_lng: e.target.value })} placeholder="81.8463" style={inp} />
          </div>
        </div>
        <div>
          <label style={lbl}>Address / landmark</label>
          <input value={value.address} onChange={e => onChange({ ...value, address: e.target.value })} placeholder="Optional" style={inp} />
        </div>
      </>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0ebe0' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>Land plots</div>
        <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 4, lineHeight: 1.45 }}>
          Extra land used by this factory for raw-material storage — not a separate plant. Purchases can unload at a plot; Stock & Recipes transfers move stock to the factory.
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Loader2 size={22} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div>
          {plots.map(p => {
            const km = distanceKm(p)
            if (editingId === p.id) {
              return (
                <div key={p.id} style={{ padding: 14, borderTop: '1px solid #f0ebe0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <FormFields value={editForm} onChange={setEditForm} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: '10px 0', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                      <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Save
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ padding: '10px 14px', background: '#fefae0', border: '1px solid #e5ddd0', borderRadius: 10, cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            }
            return (
              <div key={p.id} style={{ padding: '12px 16px', borderTop: '1px solid #f0ebe0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={13} style={{ color: '#2d6a4f' }} /> {p.name}
                    {p.is_primary && <span style={{ fontSize: 10, background: '#e8f0ec', color: '#2d6a4f', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>Main</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 3 }}>
                    {km != null ? `${km} km from factory` : 'Distance not set'}
                    {p.location_lat != null && p.location_lng != null ? ` · ${Number(p.location_lat).toFixed(4)}, ${Number(p.location_lng).toFixed(4)}` : ''}
                  </div>
                  {p.address && <div style={{ fontSize: 12, color: '#595c4a', marginTop: 2 }}>{p.address}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', padding: 4 }}><Pencil size={14} /></button>
                  {!p.is_primary && (
                    <button onClick={() => archivePlot(p.id, p.is_primary)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', fontSize: 11, padding: 4 }}>Remove</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: 14, borderTop: '1px solid #f0ebe0', display: 'flex', flexDirection: 'column', gap: 8, background: '#faf8f2' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2c' }}>Add storage plot</div>
        <FormFields value={form} onChange={setForm} />
        <button onClick={addPlot} disabled={saving} style={{ padding: '11px 0', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{saving ? 'Adding…' : 'Add plot'}
        </button>
      </div>
    </div>
  )
}
