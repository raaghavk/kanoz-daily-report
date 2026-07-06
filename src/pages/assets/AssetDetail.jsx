import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { can } from '../../lib/permissions'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import { STATUS, EVENT_TYPES, WORK_TYPES, summarise, fmtINR, COST_ROLES, deriveCacheFromLatest } from '../../lib/assets'
import QRCode from 'qrcode'
import { Loader2, Plus, QrCode, Pencil } from 'lucide-react'

export default function AssetDetail() {
  const { id } = useParams()
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [qr, setQr] = useState(null)          // { data, url } for the reprint modal
  const [editEv, setEditEv] = useState(null)  // event being edited
  const [ef, setEf] = useState({})
  const [busy, setBusy] = useState(false)
  const showCost = COST_ROLES.includes(employee?.role)
  const canEdit = can(employee?.role, 'create_spare_parts')

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

  async function openQr() {
    const url = window.location.origin + '/a/' + asset.code
    const data = await QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#1b4332', light: '#ffffff' } })
    setQr({ data, url })
  }
  function printQr() {
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<html><head><title>${asset.code}</title></head><body style="font-family:sans-serif;text-align:center;padding:24px"><img src="${qr.data}" style="width:240px;height:240px"/><div style="font-size:22px;font-weight:800;margin-top:8px;color:#1b4332">${asset.code}</div><div style="font-size:12px;color:#666">${qr.url}</div><script>window.onload=function(){window.print()}<\/script></body></html>`)
    w.document.close()
  }

  function openEdit(e) {
    setEditEv(e)
    setEf({ event_date: e.event_date || '', cost: e.cost ?? '', work_type: e.work_type || '', note: e.note || '', recovered_value: e.recovered_value ?? '', expected_return: e.expected_return || '' })
  }
  async function saveEdit() {
    if (busy) return; setBusy(true)
    try {
      const patch = {
        event_date: ef.event_date || editEv.event_date,
        note: ef.note?.trim() || null,
      }
      if (['returned', 'repaired', 'purchased'].includes(editEv.event_type)) patch.cost = ef.cost === '' ? null : Number(ef.cost)
      if (['returned', 'repaired'].includes(editEv.event_type)) patch.work_type = ef.work_type || null
      if (editEv.event_type === 'scrapped') patch.recovered_value = ef.recovered_value === '' ? null : Number(ef.recovered_value)
      if (editEv.event_type === 'sent_vendor') patch.expected_return = ef.expected_return || null
      const { error } = await supabase.from('asset_events').update(patch).eq('id', editEv.id)
      if (error) throw error
      setEditEv(null); showToast('Event updated', 'success'); await load()
    } catch { showToast('Update failed', 'error') } finally { setBusy(false) }
  }
  async function requestDeletion() {
    const reason = window.prompt('Reason for deletion request:')
    if (!reason?.trim()) return
    const { error } = await supabase.from('delete_requests').insert([{
      entity_type: 'asset',
      entity_id: asset.id,
      requested_by: employee.id,
      reason: reason.trim(),
      status: 'pending',
      org_id: plant.org_id,
    }])
    if (error) { showToast('Failed to submit request', 'error'); return }
    showToast('Deletion request submitted', 'success')
  }

  async function deleteEv() {
    if (busy) return
    if (!window.confirm('Undo (delete) this event? This cannot be undone.')) return
    setBusy(true)
    try {
      const { error } = await supabase.from('asset_events').delete().eq('id', editEv.id)
      if (error) throw error
      const remaining = events.filter(x => x.id !== editEv.id)
      const cache = deriveCacheFromLatest(remaining)
      await supabase.from('assets').update(cache).eq('id', id)
      setEditEv(null); showToast('Event removed', 'success'); await load()
    } catch { showToast('Delete failed', 'error') } finally { setBusy(false) }
  }

  if (loading) return <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fefae0' }}><Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} /></div>
  if (!asset) return <div style={{ minHeight: '100%', background: '#fefae0' }}><PageHeader title="Not found" onBack={() => navigate('/assets')} /><p style={{ padding: 24, color: '#595c4a' }}>Asset not found.</p></div>

  const st = STATUS[asset.status] || STATUS.in_store
  const sum = summarise(events)
  const ratio = asset.new_price ? sum.spend / Number(asset.new_price) : 0
  const card = { background: '#fff', border: '1.5px solid #e5ddd0', borderRadius: 16, padding: 16 }
  const inp = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: 12, fontWeight: 700, marginBottom: 6 }
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
            {asset.warranty_doc_url ? <div style={{ paddingTop: 7, fontSize: 13 }}><a href={asset.warranty_doc_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2d6a4f', fontWeight: 700 }}>📎 Warranty / invoice</a></div> : null}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {asset.status !== 'scrapped' && (
            <button onClick={() => navigate('/assets/' + id + '/log')} style={{ flex: 1, padding: 14, borderRadius: 12, background: '#2d6a4f', color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Plus size={18} /> Log event</button>
          )}
          <button onClick={openQr} style={{ flex: asset.status === 'scrapped' ? 1 : 'none', padding: '14px 16px', borderRadius: 12, background: '#fff', color: '#2d6a4f', fontSize: 14, fontWeight: 800, border: '2px solid #e5ddd0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><QrCode size={18} /> QR tag</button>
        </div>
        {!can(employee?.role, 'manage_users') && (
          <button onClick={requestDeletion} style={{ width: '100%', padding: 12, borderRadius: 12, background: 'none', color: '#b91c1c', fontSize: 13, fontWeight: 600, border: '1.5px solid #fca5a5', cursor: 'pointer' }}>Request Deletion</button>
        )}

        {showCost && asset.status !== 'scrapped' && ratio >= 0.5 && (
          <div style={{ ...card, borderColor: '#fca5a5', background: '#fff5f5' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#b91c1c' }}>⚠️ Consider replacing</div>
            <div style={{ fontSize: 12, color: '#7a4a4a', marginTop: 4 }}>Repairs have reached {Math.round(ratio * 100)}% of a new unit. A fresh {(asset.asset_type || 'unit').toLowerCase()} is likely cheaper over the next cycle.</div>
          </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{c.label}</div>
                    {canEdit && <button onClick={() => openEdit(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a9d8a', padding: 2 }}><Pencil size={14} /></button>}
                  </div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 1 }}>{e.event_date}{loc ? ' · 📍 ' + loc : ''}{e.expected_return ? ' · ⏱ due ' + e.expected_return : ''}</div>
                  {(det || (showCost && (e.cost || e.recovered_value)) || e.photo_url) && (
                    <div style={{ fontSize: 12, color: '#4a4d3c', marginTop: 4, background: '#faf8ef', border: '1px solid #eee7d5', borderRadius: 8, padding: '6px 8px' }}>
                      {det}{showCost && e.cost ? <span style={{ fontWeight: 800, color: '#b45309' }}> {fmtINR(e.cost)}</span> : null}{showCost && e.recovered_value ? <span style={{ fontWeight: 800, color: '#15803d' }}> ♻️ {fmtINR(e.recovered_value)}</span> : null}{e.photo_url ? <a href={e.photo_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, color: '#2d6a4f', fontWeight: 700 }}>📎 doc</a> : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* QR reprint modal */}
      <Modal isOpen={!!qr} onClose={() => setQr(null)} title="QR tag">
        {qr && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#2d6a4f', marginBottom: 10 }}>{asset.code}</div>
            <img src={qr.data} alt="QR" style={{ width: 200, height: 200, background: '#fff', padding: 10, borderRadius: 12 }} />
            <div style={{ fontSize: 11, color: '#8a8d7a', margin: '8px 0 4px' }}>{qr.url}</div>
            <div style={{ fontSize: 11, color: '#8a8d7a', marginBottom: 12 }}>Same permanent code — print again any time a tag wears off.</div>
            <button onClick={printQr} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#2d6a4f', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}>🖨️ Print this tag</button>
          </div>
        )}
      </Modal>

      {/* Edit / undo event modal */}
      <Modal isOpen={!!editEv} onClose={() => setEditEv(null)} title={editEv ? 'Edit · ' + (EVENT_TYPES[editEv.event_type]?.label || 'Event') : ''}>
        {editEv && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><div style={lbl}>Date</div><input type="date" style={inp} value={ef.event_date} onChange={e => setEf({ ...ef, event_date: e.target.value })} /></div>
            {['returned', 'repaired'].includes(editEv.event_type) && <div><div style={lbl}>Work done</div><select style={inp} value={ef.work_type} onChange={e => setEf({ ...ef, work_type: e.target.value })}><option value="">—</option>{WORK_TYPES.map(w => <option key={w} value={w}>{w}</option>)}</select></div>}
            {['returned', 'repaired', 'purchased'].includes(editEv.event_type) && <div><div style={lbl}>Cost (₹)</div><input style={inp} inputMode="numeric" value={ef.cost} onChange={e => setEf({ ...ef, cost: e.target.value })} /></div>}
            {editEv.event_type === 'scrapped' && <div><div style={lbl}>Recovered scrap value (₹)</div><input style={inp} inputMode="numeric" value={ef.recovered_value} onChange={e => setEf({ ...ef, recovered_value: e.target.value })} /></div>}
            {editEv.event_type === 'sent_vendor' && <div><div style={lbl}>Expected return date</div><input type="date" style={inp} value={ef.expected_return} onChange={e => setEf({ ...ef, expected_return: e.target.value })} /></div>}
            <div><div style={lbl}>Note</div><input style={inp} value={ef.note} onChange={e => setEf({ ...ef, note: e.target.value })} /></div>
            <button onClick={saveEdit} disabled={busy} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#2d6a4f', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button onClick={deleteEv} disabled={busy} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#fff', color: '#b91c1c', fontWeight: 800, border: '2px solid #fca5a5', cursor: 'pointer' }}>↩︎ Undo (delete) this event</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
