import { useState } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { showToast } from './Toast'

const VEHICLE_TYPES = ['Tractor', 'Truck', 'Hywa', 'Pickup', 'Trolley', 'Other']

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, color: '#2c2c2c', outline: 'none', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }

/**
 * Shared "Add Transporter" form — same fields everywhere (Settings, Purchase, Dispatch).
 * Creates the transporter and (optionally) their first vehicle in transporter_vehicles.
 */
export default function AddTransporterModal({ isOpen, onClose, orgId, onAdded }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', vehicle_number: '', vehicle_type: 'Tractor', approx_capacity_kg: '', driver_name: '', driver_phone: '' })
  const [submitting, setSubmitting] = useState(false)

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSubmit() {
    if (!orgId) { showToast('Organization context missing. Please reload.', 'error'); return }
    if (!form.name.trim()) { showToast('Transporter name is required', 'error'); return }
    if (!form.phone.trim()) { showToast('Phone number is required', 'error'); return }
    if (submitting) return
    setSubmitting(true)
    try {
      const phone = '+91' + form.phone.replace(/^\+91/, '').trim()
      const payload = {
        org_id: orgId,
        name: form.name.trim(),
        phone,
        address: form.address.trim() || null,
        is_active: true,
        category: form.vehicle_number.trim() ? form.vehicle_type : null,
        vehicle_number: form.vehicle_number.trim() || null,
      }
      const { data, error } = await supabase.from('transporters').insert([payload]).select()
      if (error) throw error
      const transporter = data[0]

      if (form.vehicle_number.trim()) {
        const vehicle = {
          transporter_id: transporter.id,
          vehicle_number: form.vehicle_number.trim().toUpperCase().replace(/[\s-]/g, ''),
          vehicle_type: form.vehicle_type,
          approx_capacity_kg: form.approx_capacity_kg ? parseFloat(form.approx_capacity_kg) : null,
          driver_name: form.driver_name.trim() || null,
          driver_phone: form.driver_phone.trim() ? '+91' + form.driver_phone.replace(/^\+91/, '').trim() : null,
          is_active: true,
        }
        const { error: vErr } = await supabase.from('transporter_vehicles').insert([vehicle])
        if (vErr) console.error('Vehicle insert failed:', vErr)
      }

      setForm({ name: '', phone: '', address: '', vehicle_number: '', vehicle_type: 'Tractor', approx_capacity_kg: '', driver_name: '', driver_phone: '' })
      showToast('Transporter added', 'success')
      if (onAdded) onAdded(transporter)
      onClose()
    } catch (err) {
      console.error('Error adding transporter:', err)
      showToast('Failed to add transporter', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Transporter">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Transporter Name <span style={{ color: '#d32f2f' }}>*</span></label>
          <input type="text" placeholder="e.g., Umesh Yadav" value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Phone Number <span style={{ color: '#d32f2f' }}>*</span></label>
          <input type="tel" placeholder="e.g., 9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Address</label>
          <input type="text" placeholder="Village / area (optional)" value={form.address} onChange={e => set('address', e.target.value)} style={inputStyle} />
        </div>

        <div style={{ borderTop: '1.5px solid #e5ddd0', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', marginBottom: 10 }}>First Vehicle (optional)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1.2 }}>
              <label style={labelStyle}>Vehicle Number</label>
              <input type="text" placeholder="UP70MT6151" value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Vehicle Type</label>
              <select value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)} style={inputStyle}>
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Approx Capacity (kg)</label>
            <input type="number" placeholder="e.g., 4000" value={form.approx_capacity_kg} onChange={e => set('approx_capacity_kg', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Driver Name</label>
              <input type="text" placeholder="Optional" value={form.driver_name} onChange={e => set('driver_name', e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Driver Phone</label>
              <input type="tel" placeholder="Optional" value={form.driver_phone} onChange={e => set('driver_phone', e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f3f4f6', color: '#2c2c2c', borderRadius: 10, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, padding: '11px 0', background: submitting ? '#b5b8a8' : '#2d6a4f', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Adding…' : 'Add Transporter'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
