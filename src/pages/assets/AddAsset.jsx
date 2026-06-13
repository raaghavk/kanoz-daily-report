import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { getLocalDate } from '../../lib/dateUtils'
import { getBrands, saveCustomBrand } from '../../lib/brands'
import { ASSET_TYPES, CODE_PREFIX } from '../../lib/assets'
import QRCode from 'qrcode'
import { Loader2 } from 'lucide-react'

export default function AddAsset() {
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState([])
  const [brands] = useState(() => getBrands())
  const [f, setF] = useState({ type: 'Motor', name: '', make: '', make_other: '', rating: '', serial: '', date: getLocalDate(), cost: '', supplier: '', supplier_new: '', warranty: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null) // { id, code, qr }

  useEffect(() => { if (plant?.org_id) supabase.from('spare_parts_suppliers').select('id, name').eq('org_id', plant.org_id).eq('is_active', true).order('name').then(({ data }) => setSuppliers(data || [])) }, [plant]) // eslint-disable-line

  const inp = { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: 12, fontWeight: 700, marginBottom: 6 }
  const sec = { fontSize: 12, fontWeight: 800, color: '#8a8d7a', letterSpacing: 0.4, marginTop: 4 }

  async function save() {
    if (saving) return
    const type = f.type === 'Other' ? (f.type_other || 'Other') : f.type
    const make = f.make === 'Other' ? f.make_other.trim() : f.make
    if (!f.name.trim()) { showToast('Name is required', 'error'); return }
    setSaving(true)
    try {
      // supplier: create new if needed
      let supplierId = f.supplier || null
      if (f.supplier === '__new' && f.supplier_new.trim()) {
        const { data: ns } = await supabase.from('spare_parts_suppliers').insert([{ org_id: plant.org_id, name: f.supplier_new.trim(), is_active: true }]).select()
        supplierId = ns?.[0]?.id || null
      } else if (f.supplier === '__new') { supplierId = null }

      // generate next code for this type
      const prefix = CODE_PREFIX[f.type] || 'AST'
      const { data: existing } = await supabase.from('assets').select('code').eq('org_id', plant.org_id).like('code', prefix + '-%')
      let max = 0
      for (const r of existing || []) { const n = parseInt((r.code.split('-')[1] || '0'), 10); if (!isNaN(n) && n > max) max = n }
      const code = `${prefix}-${String(max + 1).padStart(4, '0')}`

      const { data: aRows, error: aErr } = await supabase.from('assets').insert([{
        org_id: plant.org_id, plant_id: plant.id, code, asset_type: type, name: f.name.trim(),
        make: make || null, rating: f.rating.trim() || null, serial_no: f.serial.trim() || null,
        new_price: f.cost ? Number(f.cost) : null, warranty_until: f.warranty || null,
        status: 'in_store', current_location: 'Main Store', is_active: true, notes: f.notes.trim() || null,
        created_by: employee?.id || null,
      }]).select()
      if (aErr) throw aErr
      const asset = aRows[0]

      const { error: eErr } = await supabase.from('asset_events').insert([{
        asset_id: asset.id, org_id: plant.org_id, plant_id: plant.id, event_type: 'purchased',
        event_date: f.date || getLocalDate(), cost: f.cost ? Number(f.cost) : null,
        supplier_id: supplierId, to_location: 'Main Store', note: 'New asset registered',
        recorded_by: employee?.id || null,
      }])
      if (eErr) throw eErr

      if (f.make === 'Other' && make) saveCustomBrand(make)
      const url = window.location.origin + '/a/' + code
      const qr = await QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#1b4332', light: '#ffffff' } })
      setResult({ id: asset.id, code, qr, url, type })
      showToast('Asset saved', 'success')
    } catch (e) { showToast('Failed to save asset', 'error') } finally { setSaving(false) }
  }

  function printTag() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>${result.code}</title></head><body style="font-family:sans-serif;text-align:center;padding:24px"><img src="${result.qr}" style="width:240px;height:240px"/><div style="font-size:22px;font-weight:800;margin-top:8px;color:#1b4332">${result.code}</div><div style="font-size:12px;color:#666">${result.url}</div><script>window.onload=function(){window.print()}<\/script></body></html>`)
    w.document.close()
  }

  if (result) return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Asset saved" subtitle={result.code} onBack={() => navigate('/assets')} />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 16, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#15803d' }}>✅ Asset saved · purchase logged</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#2d6a4f', margin: '6px 0 12px' }}>{result.code}</div>
          <img src={result.qr} alt="QR" style={{ width: 200, height: 200, background: '#fff', padding: 10, borderRadius: 12 }} />
          <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 8 }}>{result.url}</div>
          <button onClick={printTag} style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: '#2d6a4f', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer', width: '100%' }}>🖨️ Print QR tag</button>
        </div>
        <div style={{ background: '#fff', border: '1.5px solid #e5ddd0', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>What happens next?</div>
          <div style={{ fontSize: 12, color: '#8a8d7a', marginBottom: 10 }}>It's in Main Store now. Log the next event when it moves.</div>
          <button onClick={() => navigate('/assets/' + result.id + '/log')} style={{ width: '100%', padding: 14, borderRadius: 12, background: '#2d6a4f', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer', marginBottom: 8 }}>🔧 Install on a machine now</button>
          <button onClick={() => navigate('/assets')} style={{ width: '100%', padding: 14, borderRadius: 12, background: '#fff', color: '#2c2c2c', fontWeight: 700, border: '2px solid #e5ddd0', cursor: 'pointer' }}>🏬 Keep in store — done</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Add New Asset" subtitle="Register, then print its QR tag" onBack={() => navigate('/assets')} />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={sec}>IDENTITY</div>
        <div><div style={lbl}>Asset type *</div><select style={inp} value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>{f.type === 'Other' && <input style={{ ...inp, marginTop: 8 }} placeholder="Custom asset type" value={f.type_other || ''} onChange={e => setF({ ...f, type_other: e.target.value })} />}</div>
        <div><div style={lbl}>Name *</div><input style={inp} placeholder="e.g. 40 HP Electric Motor" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div><div style={lbl}>Make / Manufacturer</div><select style={inp} value={f.make} onChange={e => setF({ ...f, make: e.target.value, make_other: '' })}><option value="">Select brand</option>{brands.map(b => <option key={b} value={b}>{b}</option>)}<option value="Other">Other</option></select>{f.make === 'Other' && <input style={{ ...inp, marginTop: 8 }} placeholder="Custom brand" value={f.make_other} onChange={e => setF({ ...f, make_other: e.target.value })} />}</div>
        <div><div style={lbl}>Rating / spec</div><input style={inp} placeholder="e.g. 40 HP, 1440 rpm / ratio 1:20" value={f.rating} onChange={e => setF({ ...f, rating: e.target.value })} /></div>
        <div><div style={lbl}>Serial no. (nameplate)</div><input style={inp} placeholder="optional" value={f.serial} onChange={e => setF({ ...f, serial: e.target.value })} /></div>

        <div style={sec}>PURCHASE · saved as the first event</div>
        <div><div style={lbl}>Purchase date *</div><input type="date" style={inp} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
        <div><div style={lbl}>Purchase cost (₹)</div><input style={inp} inputMode="numeric" placeholder="e.g. 78000" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} /></div>
        <div><div style={lbl}>Bought from (supplier)</div><select style={inp} value={f.supplier} onChange={e => setF({ ...f, supplier: e.target.value })}><option value="">Select supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="__new">+ Add new supplier</option></select>{f.supplier === '__new' && <input style={{ ...inp, marginTop: 8 }} placeholder="New supplier name (added to shared list)" value={f.supplier_new} onChange={e => setF({ ...f, supplier_new: e.target.value })} />}</div>
        <div><div style={lbl}>Warranty until</div><input type="date" style={inp} value={f.warranty} onChange={e => setF({ ...f, warranty: e.target.value })} /></div>
        <div><div style={lbl}>Notes</div><input style={inp} placeholder="optional" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>

        <button onClick={save} disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, background: '#2d6a4f', color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{saving ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : '💾 Save asset & generate QR tag'}</button>
      </div>
    </div>
  )
}
