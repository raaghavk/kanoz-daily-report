import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import { Loader2, Plus, RefreshCw, CheckCircle, Clock, Package } from 'lucide-react'

const STATUS_COLORS = {
  pending:  { bg: '#FEF3C7', text: '#d97706', border: '#fde68a', label: 'Pending' },
  ordered:  { bg: '#EEF2FF', text: '#2563EB', border: '#c7d2fe', label: 'Ordered' },
  received: { bg: '#e8f0ec', text: '#2d6a4f', border: '#a7c4b5', label: 'Received' },
}

export default function ReorderRequestsPage() {
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(null) // request object
  const [submitting, setSubmitting] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')

  const [formData, setFormData] = useState({ part_id: '', notes: '' })
  const [updateData, setUpdateData] = useState({ status: '', ordered_by: '', expected_delivery_date: '', supplier_name: '', notes: '' })

  useEffect(() => { if (plant?.id) load() }, [plant]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const [reqRes, partsRes] = await Promise.all([
        supabase.from('spare_parts_reorder_requests')
          .select('*, spare_parts(name, unit, category, brand)')
          .eq('plant_id', plant.id)
          .order('created_at', { ascending: false }),
        supabase.from('spare_parts').select('id, name, unit, brand, category').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
      ])
      setRequests(reqRes.data || [])
      setParts(partsRes.data || [])
    } catch { showToast('Failed to load', 'error') } finally { setLoading(false) }
  }

  async function handleAdd() {
    if (!formData.part_id) { showToast('Select a part', 'error'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('spare_parts_reorder_requests').insert([{
        org_id: plant.org_id,
        plant_id: plant.id,
        part_id: formData.part_id,
        requested_by: employee?.name || null,
        notes: formData.notes.trim() || null,
        status: 'pending',
      }])
      if (error) throw error
      showToast('Reorder request raised', 'success')
      setFormData({ part_id: '', notes: '' })
      setShowAddModal(false)
      load()
    } catch { showToast('Failed to save', 'error') } finally { setSubmitting(false) }
  }

  async function handleUpdate() {
    if (!updateData.status) { showToast('Select a status', 'error'); return }
    setSubmitting(true)
    try {
      const updates = { status: updateData.status }
      if (updateData.status === 'ordered') {
        if (!updateData.ordered_by.trim()) { showToast('Enter who placed the order', 'error'); setSubmitting(false); return }
        updates.ordered_by = updateData.ordered_by.trim()
        updates.ordered_at = new Date().toISOString()
        if (updateData.expected_delivery_date) updates.expected_delivery_date = updateData.expected_delivery_date
        if (updateData.supplier_name.trim()) updates.supplier_name = updateData.supplier_name.trim()
      }
      if (updateData.notes.trim()) updates.notes = updateData.notes.trim()
      const { error } = await supabase.from('spare_parts_reorder_requests').update(updates).eq('id', showUpdateModal.id)
      if (error) throw error
      showToast('Updated', 'success')
      setShowUpdateModal(null)
      load()
    } catch { showToast('Failed to update', 'error') } finally { setSubmitting(false) }
  }

  const fmtDate = d => d ? new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const filtered = filterStatus === 'all' ? requests : requests.filter(r => r.status === filterStatus)
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Reorder Requests" subtitle={`${plant?.name} · Parts to reorder`} onBack={() => navigate('/spare-parts')} />

      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {['all', 'pending', 'ordered', 'received'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${filterStatus === s ? '#2d6a4f' : '#e5ddd0'}`, background: filterStatus === s ? '#2d6a4f' : '#fff', color: filterStatus === s ? 'white' : '#595c4a', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {s === 'all' ? 'All' : STATUS_COLORS[s].label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8a8d7a' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No reorder requests</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Tap + to raise one when stock is low</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            {filtered.map((r, idx) => {
              const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending
              return (
                <button key={r.id} onClick={() => { setShowUpdateModal(r); setUpdateData({ status: r.status, ordered_by: r.ordered_by || '', expected_delivery_date: r.expected_delivery_date || '', supplier_name: r.supplier_name || '', notes: '' }) }}
                  style={{ width: '100%', textAlign: 'left', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: sc.bg, border: `1.5px solid ${sc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {r.status === 'received' ? <CheckCircle size={18} color={sc.text} /> : r.status === 'ordered' ? <RefreshCw size={18} color={sc.text} /> : <Clock size={18} color={sc.text} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{r.spare_parts?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>
                      {r.spare_parts?.brand ? `${r.spare_parts.brand} · ` : ''}{r.requested_by ? `Requested by ${r.requested_by}` : 'No requester'}
                    </div>
                    {r.status === 'ordered' && r.ordered_by && (
                      <div style={{ fontSize: 11, color: '#2563EB', marginTop: 2 }}>
                        Ordered by {r.ordered_by}{r.expected_delivery_date ? ` · Due ${fmtDate(r.expected_delivery_date)}` : ''}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>{sc.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowAddModal(true)} style={{ position: 'fixed', bottom: 88, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#b91c1c', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(185,28,28,0.35)', zIndex: 50 }}>
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Raise Reorder Request">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Part <span style={{ color: '#d32f2f' }}>*</span></label>
            <select value={formData.part_id} onChange={e => setFormData({ ...formData, part_id: e.target.value })} style={{ ...inputStyle, color: formData.part_id ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select part</option>
              {parts.map(p => <option key={p.id} value={p.id}>{p.name}{p.brand ? ` (${p.brand})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Urgency, quantity needed, etc." rows={3} style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div style={{ background: '#EEF2FF', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#2563EB' }}>
            📌 Requested by: <strong>{employee?.name || 'You'}</strong>
          </div>
          <button onClick={handleAdd} disabled={submitting} style={{ width: '100%', padding: '13px 0', background: '#b91c1c', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Saving...' : 'Raise Request'}
          </button>
        </div>
      </Modal>

      {/* Update Status Modal */}
      {showUpdateModal && (
        <Modal isOpen={!!showUpdateModal} onClose={() => setShowUpdateModal(null)} title="Update Reorder Status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>
              {showUpdateModal.spare_parts?.name}
            </div>
            <div>
              <label style={labelStyle}>Status <span style={{ color: '#d32f2f' }}>*</span></label>
              <select value={updateData.status} onChange={e => setUpdateData({ ...updateData, status: e.target.value })} style={inputStyle}>
                <option value="pending">Pending</option>
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
              </select>
            </div>
            {updateData.status === 'ordered' && (
              <>
                <div>
                  <label style={labelStyle}>Ordered By <span style={{ color: '#d32f2f' }}>*</span></label>
                  <input type="text" value={updateData.ordered_by} onChange={e => setUpdateData({ ...updateData, ordered_by: e.target.value })} placeholder="Your name or who placed the order" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Supplier Name</label>
                  <input type="text" value={updateData.supplier_name} onChange={e => setUpdateData({ ...updateData, supplier_name: e.target.value })} placeholder="e.g., SKF Distributors" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Expected Delivery Date</label>
                  <input type="date" value={updateData.expected_delivery_date} onChange={e => setUpdateData({ ...updateData, expected_delivery_date: e.target.value })} style={inputStyle} />
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={updateData.notes} onChange={e => setUpdateData({ ...updateData, notes: e.target.value })} placeholder="Any update notes" rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <button onClick={handleUpdate} disabled={submitting} style={{ width: '100%', padding: '13px 0', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Saving...' : 'Update'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
