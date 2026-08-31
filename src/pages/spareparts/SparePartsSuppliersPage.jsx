import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import { Search, Plus, Phone, MessageSquare, Loader2, AlertCircle, LocateFixed } from 'lucide-react'

// Categories sorted A-Z, with Other last
const CATEGORIES = ['Bearings & Belts', 'Electrical', 'General Hardware', 'Hydraulic', 'Mechanical', 'Pneumatic', 'Other']

export default function SparePartsSuppliersPage() {
  const { plant } = useAuth()
    const [suppliers, setSuppliers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [formData, setFormData] = useState({
    name: '', contact_person: '', phone: '', alternate_phone: '',
    address: '', gst_number: '', category: '', category_other: '', notes: ''
  })

  useEffect(() => { if (plant?.org_id) fetchSuppliers() }, [plant]) // eslint-disable-line

  useEffect(() => {
    const q = searchQuery.toLowerCase()
    setFiltered(q ? suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.phone || '').includes(q) || (s.category || '').toLowerCase().includes(q)) : suppliers)
  }, [searchQuery, suppliers])

  async function fetchSuppliers() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('spare_parts_suppliers').select('*').eq('org_id', plant.org_id).eq('is_active', true).order('name')
      if (error) throw error
      setSuppliers(data || [])
    } catch { showToast('Failed to load suppliers', 'error') } finally { setLoading(false) }
  }

  async function captureLocation() {
    if (!navigator.geolocation) { showToast('Location not supported', 'error'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const data = await res.json()
          setFormData(prev => ({ ...prev, address: data.display_name || `${latitude}, ${longitude}` }))
          showToast('Location captured', 'success')
        } catch {
          setFormData(prev => ({ ...prev, address: `${latitude}, ${longitude}` }))
        } finally { setLocating(false) }
      },
      () => { setLocating(false); showToast('Could not get location', 'error') },
      { timeout: 10000 }
    )
  }

  async function handleAdd() {
    if (submitting) return
    if (!formData.name.trim()) { showToast('Supplier name is required', 'error'); return }
    if (!formData.category) { showToast('Category is required', 'error'); return }
    if (formData.category === 'Other' && !formData.category_other.trim()) { showToast('Please specify the category', 'error'); return }
    if (!formData.contact_person.trim()) { showToast('Contact person is required', 'error'); return }
    if (!formData.phone.trim()) { showToast('Phone number is required', 'error'); return }
    if (!formData.gst_number.trim()) { showToast('GST number is required', 'error'); return }
    if (!formData.address.trim()) { showToast('Address is required', 'error'); return }
    try {
      setSubmitting(true)
      const phoneVal = '+91' + formData.phone.replace(/^\+91/, '').trim()
      const finalCategory = formData.category === 'Other' ? formData.category_other.trim() : formData.category
      const { data, error } = await supabase.from('spare_parts_suppliers').insert([{
        org_id: plant.org_id,
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim(),
        phone: phoneVal,
        alternate_phone: formData.alternate_phone.trim() || null,
        address: formData.address.trim(),
        gst_number: formData.gst_number.trim(),
        category: finalCategory,
        notes: formData.notes.trim() || null,
        is_active: true,
      }]).select()
      if (error) throw error
      setSuppliers(prev => [...prev, data[0]])
      setFormData({ name: '', contact_person: '', phone: '', alternate_phone: '', address: '', gst_number: '', category: '', category_other: '', notes: '' })
      setShowAddModal(false)
      showToast('Supplier added', 'success')
    } catch { showToast('Failed to add supplier', 'error') } finally { setSubmitting(false) }
  }

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }
  const req = <span style={{ color: '#d32f2f' }}>*</span>

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader title="Parts Suppliers" subtitle="Spare parts & equipment vendors" />
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a8d7a' }} />
            <input type="text" placeholder="Search by name, phone, category..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, outline: 'none', background: '#fffdf5', border: '1.5px solid #e5ddd0', color: '#2c2c2c', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', paddingBottom: 100 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <Loader2 size={32} style={{ color: '#2d6a4f', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#595c4a' }}>Loading suppliers...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 32, textAlign: 'center' }}>
            <AlertCircle size={32} style={{ color: '#b5b8a8', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: '#595c4a', marginBottom: 4 }}>{searchQuery ? 'No suppliers found' : 'No suppliers added yet'}</p>
            <p style={{ fontSize: 12, color: '#b5b8a8' }}>{searchQuery ? 'Try a different search' : 'Add your first parts supplier'}</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            {filtered.map((s, idx) => (
              <div key={s.id} style={{ borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>
                    {s.category || 'General'}{s.contact_person ? ` · ${s.contact_person}` : ''}
                  </div>
                </div>
                {s.phone && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { window.location.href = `tel:${s.phone}` }} style={{ width: 34, height: 34, borderRadius: 8, background: '#e8f0ec', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Phone size={14} style={{ color: '#2d6a4f' }} />
                    </button>
                    <button onClick={() => { window.location.href = `sms:${s.phone}` }} style={{ width: 34, height: 34, borderRadius: 8, background: '#EEF2FF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={14} style={{ color: '#2563EB' }} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowAddModal(true)} style={{ position: 'fixed', bottom: 88, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#2d6a4f', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(45,106,79,0.35)', zIndex: 50 }} title="Add Supplier">
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Parts Supplier">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Supplier Name {req}</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Rajesh Electricals" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Category {req}</label>
            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value, category_other: '' })} style={{ ...inputStyle, color: formData.category ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {formData.category === 'Other' && (
            <div>
              <label style={labelStyle}>Specify Category {req}</label>
              <input type="text" value={formData.category_other} onChange={e => setFormData({ ...formData, category_other: e.target.value })} placeholder="e.g., Lubrication, Seals, Pumps..." style={inputStyle} autoFocus />
            </div>
          )}
          <div>
            <label style={labelStyle}>Contact Person {req}</label>
            <input type="text" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} placeholder="Name of contact" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Phone {req}</label>
            <div style={{ display: 'flex' }}>
              <span style={{ padding: '10px 8px 10px 12px', background: '#e8f0ec', borderRadius: '12px 0 0 12px', border: '1.5px solid #e5ddd0', borderRight: 'none', fontSize: 14, color: '#2d6a4f', fontWeight: 600 }}>+91</span>
              <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="10-digit number" style={{ ...inputStyle, borderRadius: '0 12px 12px 0' }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Alternate Phone <span style={{ color: '#b5b8a8', fontWeight: 400 }}>(optional)</span></label>
            <input type="tel" value={formData.alternate_phone} onChange={e => setFormData({ ...formData, alternate_phone: e.target.value })} placeholder="Optional" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>GST Number {req}</label>
            <input type="text" value={formData.gst_number} onChange={e => setFormData({ ...formData, gst_number: e.target.value })} placeholder="e.g., 27AAPFU0939F1ZV" style={inputStyle} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a' }}>Address {req}</label>
              <button type="button" onClick={captureLocation} disabled={locating} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#e8f0ec', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#2d6a4f', cursor: locating ? 'not-allowed' : 'pointer', opacity: locating ? 0.6 : 1 }}>
                <LocateFixed size={12} />{locating ? 'Getting...' : 'Capture Location'}
              </button>
            </div>
            <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Address or tap Capture Location" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Notes <span style={{ color: '#b5b8a8', fontWeight: 400 }}>(optional)</span></label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes" rows={2} style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px 0', background: '#f3f4f6', color: '#2c2c2c', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAdd} disabled={submitting} style={{ flex: 1, padding: '10px 0', background: '#2d6a4f', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Adding...' : 'Add Supplier'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
