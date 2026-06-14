import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { getLocalDate } from '../../lib/dateUtils'
import { EVENT_TYPES, WORK_TYPES, cacheForEvent } from '../../lib/assets'
import FilePicker from './FilePicker'
import { Loader2, CheckCircle } from 'lucide-react'

const STORES = ['Main Store', 'Electrical Store', 'Mill Spares Rack']
const MENU = [
  { t: 'installed', d: 'Put onto a machine' },
  { t: 'removed', d: 'Taken off a machine' },
  { t: 'sent_vendor', d: 'Sent out to a repair shop' },
  { t: 'returned', d: 'Back from repair — record work & cost' },
  { t: 'repaired', d: 'Fixed on-site (no outside shop)' },
  { t: 'moved_store', d: 'Moved into a store' },
  { t: 'scrapped', d: 'Scrapped / written off' },
]

export default function LogEvent() {
  const { id } = useParams()
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [machines, setMachines] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [type, setType] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { if (plant?.id) load() }, [plant, id]) // eslint-disable-line
  async function load() {
    const [aRes, mRes, sRes] = await Promise.all([
      supabase.from('assets').select('*').eq('id', id).maybeSingle(),
      supabase.from('machines').select('id, name').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
      supabase.from('spare_parts_suppliers').select('id, name').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
    ])
    setAsset(aRes.data); setMachines(mRes.data || []); setSuppliers(sRes.data || [])
  }

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: 12, fontWeight: 700, marginBottom: 6 }

  function pick(t) {
    setType(t)
    setForm({ machine: asset?.current_machine_id || (machines[0] && machines[0].id) || '', store: STORES[0], supplier: suppliers[0]?.id || '', work: WORK_TYPES[0] })
  }

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      const machine = machines.find(m => m.id === form.machine)
      const supplier = suppliers.find(s => s.id === form.supplier)
      const work = form.work === 'Other' ? (form.work_other || 'Other') : form.work
      const ev = {
        asset_id: id, org_id: plant.org_id, plant_id: plant.id,
        event_type: type, event_date: getLocalDate(),
        recorded_by: employee?.id || null,
        note: form.note?.trim() || null,
        photo_url: form.photo || null,
      }
      let cacheLoc = asset?.current_location
      if (type === 'installed') { ev.machine_id = form.machine || null; ev.to_location = machine?.name || null; cacheLoc = machine?.name }
      if (type === 'removed') { ev.from_location = asset?.current_location || machine?.name || null; cacheLoc = ev.from_location }
      if (type === 'sent_vendor') { ev.supplier_id = form.supplier || null; ev.to_location = supplier?.name || null; ev.expected_return = form.expected_return || null; cacheLoc = supplier?.name }
      if (type === 'returned') { ev.supplier_id = form.supplier || null; ev.to_location = form.store; ev.work_type = work; ev.cost = form.cost ? Number(form.cost) : null; cacheLoc = form.store }
      if (type === 'repaired') { ev.work_type = work; ev.cost = form.cost ? Number(form.cost) : null }
      if (type === 'moved_store') { ev.to_location = form.store; cacheLoc = form.store }
      if (type === 'scrapped') { ev.to_location = 'Scrap Yard'; ev.recovered_value = form.recovered ? Number(form.recovered) : null; cacheLoc = 'Scrap Yard' }

      const { error } = await supabase.from('asset_events').insert([ev])
      if (error) throw error
      const cache = cacheForEvent(type, { location: cacheLoc, machineId: form.machine })
      if (Object.keys(cache).length) await supabase.from('assets').update(cache).eq('id', id)
      setDone(true)
    } catch { showToast('Failed to save event', 'error') } finally { setSaving(false) }
  }

  if (!asset) return <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fefae0' }}><Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>

  if (done) return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Saved" onBack={() => navigate('/assets/' + id)} />
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <CheckCircle size={56} style={{ color: '#15803d', margin: '0 auto 10px' }} />
        <div style={{ fontSize: 18, fontWeight: 800 }}>Event logged</div>
        <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 6 }}>{asset.code} · {EVENT_TYPES[type].label}<br />The asset's history is now updated for everyone.</div>
        <button onClick={() => navigate('/assets/' + id)} style={{ marginTop: 24, padding: 14, borderRadius: 12, background: '#2d6a4f', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer', width: '100%' }}>View updated history</button>
      </div>
    </div>
  )

  if (!type) return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="What happened?" subtitle={`${asset.code} · ${asset.name}`} onBack={() => navigate('/assets/' + id)} />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MENU.map(o => (
          <button key={o.t} onClick={() => pick(o.t)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: 16, borderRadius: 14, border: '2px solid #e5ddd0', background: '#fff', cursor: 'pointer' }}>
            <span style={{ fontSize: 22 }}>{EVENT_TYPES[o.t].emoji}</span>
            <div><div style={{ fontSize: 15, fontWeight: 700 }}>{EVENT_TYPES[o.t].label}</div><div style={{ fontSize: 11, color: '#8a8d7a', fontWeight: 600 }}>{o.d}</div></div>
          </button>
        ))}
      </div>
    </div>
  )

  const needMachine = type === 'installed'
  const needRemoved = type === 'removed'
  const needStore = type === 'moved_store' || type === 'returned'
  const needSupplier = type === 'sent_vendor' || type === 'returned'
  const needExp = type === 'sent_vendor'
  const needWork = type === 'returned' || type === 'repaired'
  const needCost = type === 'returned' || type === 'repaired'
  const isScrap = type === 'scrapped'

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title={EVENT_TYPES[type].label} subtitle={`${asset.code} · ${asset.name}`} onBack={() => setType(null)} />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {needMachine && <div><div style={lbl}>Onto which machine?</div><select style={inp} value={form.machine} onChange={e => setForm({ ...form, machine: e.target.value })}>{machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>}
        {needRemoved && <div><div style={lbl}>Removed from which machine? <span style={{ color: '#8a8d7a', fontWeight: 600 }}>· auto-selected</span></div><select style={inp} value={form.machine} onChange={e => setForm({ ...form, machine: e.target.value })}>{machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>}
        {needSupplier && <div><div style={lbl}>Repair shop</div><select style={inp} value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}>{suppliers.length === 0 && <option value="">No suppliers yet</option>}{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
        {needExp && <div><div style={lbl}>Expected return date</div><input type="date" style={inp} value={form.expected_return || ''} onChange={e => setForm({ ...form, expected_return: e.target.value })} /></div>}
        {needStore && <div><div style={lbl}>Into which store?</div><select style={inp} value={form.store} onChange={e => setForm({ ...form, store: e.target.value })}>{STORES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>}
        {needWork && <div><div style={lbl}>Work done</div><select style={inp} value={form.work} onChange={e => setForm({ ...form, work: e.target.value })}>{WORK_TYPES.map(w => <option key={w} value={w}>{w}</option>)}</select>{form.work === 'Other' && <input style={{ ...inp, marginTop: 8 }} placeholder="Describe the work done" value={form.work_other || ''} onChange={e => setForm({ ...form, work_other: e.target.value })} />}</div>}
        {needCost && <div><div style={lbl}>Cost (₹)</div><input style={inp} inputMode="numeric" placeholder="e.g. 8500" value={form.cost || ''} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>}
        {isScrap && <div><div style={lbl}>Recovered scrap value (₹) <span style={{ color: '#15803d', fontWeight: 600 }}>· sold as scrap</span></div><input style={inp} inputMode="numeric" placeholder="e.g. 2200" value={form.recovered || ''} onChange={e => setForm({ ...form, recovered: e.target.value })} /></div>}
        <div><div style={lbl}>Photo / invoice (photo or PDF, optional)</div><FilePicker value={form.photo} onChange={v => setForm({ ...form, photo: v })} folder="asset-events" label="Add photo or PDF" /></div>
        <div><div style={lbl}>Note (optional)</div><input style={inp} placeholder="Anything worth recording…" value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
        <button onClick={save} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, background: '#2d6a4f', color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving…' : '✓ Save event'}</button>
      </div>
    </div>
  )
}
