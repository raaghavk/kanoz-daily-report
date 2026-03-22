import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { Loader2, AlertTriangle } from 'lucide-react'

export default function IssuePartPage() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [parts, setParts] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    part_id: '',
    quantity: '',
    usage_date: new Date().toISOString().split('T')[0],
    machine_name: '',
    purpose: '',
    issued_to: '',
    notes: '',
  })

  const PURPOSES = ['Breakdown Repair', 'Preventive Maintenance', 'Scheduled Replacement', 'New Installation', 'Other']

  useEffect(() => { if (plant?.org_id) loadParts() }, [plant]) // eslint-disable-line

  async function loadParts() {
    setLoadingData(true)
    try {
      const { data: partsData } = await supabase.from('spare_parts').select('id, name, unit, category').eq('org_id', plant.org_id).eq('is_active', true).order('name')
      const partIds = (partsData || []).map(p => p.id)
      const [purchasesRes, usageRes] = await Promise.all([
        supabase.from('spare_parts_purchases').select('part_id, quantity').in('part_id', partIds),
        supabase.from('spare_parts_usage').select('part_id, quantity').in('part_id', partIds),
      ])
      const purchaseMap = {}
      for (const row of (purchasesRes.data || [])) purchaseMap[row.part_id] = (purchaseMap[row.part_id] || 0) + Number(row.quantity)
      const usageMap = {}
      for (const row of (usageRes.data || [])) usageMap[row.part_id] = (usageMap[row.part_id] || 0) + Number(row.quantity)
      setParts((partsData || []).map(p => ({ ...p, current_stock: (purchaseMap[p.id] || 0) - (usageMap[p.id] || 0) })))
    } catch { showToast('Failed to load parts', 'error') } finally { setLoadingData(false) }
  }

  async function handleSubmit() {
    if (submitting) return
    if (!formData.part_id) { showToast('Please select a part', 'error'); return }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) { showToast('Enter a valid quantity', 'error'); return }
    const selectedPart = parts.find(p => p.id === formData.part_id)
    if (selectedPart && parseFloat(formData.quantity) > selectedPart.current_stock) {
      showToast(`Only ${selectedPart.current_stock} ${selectedPart.unit} available in stock`, 'error'); return
    }
    try {
      setSubmitting(true)
      const { error } = await supabase.from('spare_parts_usage').insert([{
        org_id: plant.org_id,
        part_id: formData.part_id,
        quantity: parseFloat(formData.quantity),
        usage_date: formData.usage_date,
        machine_name: formData.machine_name.trim() || null,
        purpose: formData.purpose || null,
        issued_to: formData.issued_to.trim() || null,
        notes: formData.notes.trim() || null,
      }])
      if (error) throw error
      showToast('Usage recorded', 'success')
      navigate(-1)
    } catch { showToast('Failed to save', 'error') } finally { setSubmitting(false) }
  }

  const selectedPart = parts.find(p => p.id === formData.part_id)
  const isOverStock = selectedPart && formData.quantity && parseFloat(formData.quantity) > selectedPart.current_stock

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }
  const cardStyle = { background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }

  if (loadingData) return (
    <div style={{ minHeight: '100%', background: '#fefae0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Issue Part" subtitle="Record parts used / issued" onBack={() => navigate(-1)} />

      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Part Selection */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Which Part?</div>
          <div>
            <label style={labelStyle}>Part <span style={{ color: '#d32f2f' }}>*</span></label>
            <select value={formData.part_id} onChange={e => setFormData({ ...formData, part_id: e.target.value })} style={{ ...inputStyle, color: formData.part_id ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select part</option>
              {parts.map(p => <option key={p.id} value={p.id}>{p.name} — {p.current_stock} {p.unit} in stock</option>)}
            </select>
          </div>
          {selectedPart && (
            <div style={{ background: selectedPart.current_stock <= 0 ? '#fee2e2' : '#e8f0ec', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {selectedPart.current_stock <= 0 && <AlertTriangle size={14} style={{ color: '#b91c1c' }} />}
              <span style={{ fontSize: 13, fontWeight: 600, color: selectedPart.current_stock <= 0 ? '#b91c1c' : '#2d6a4f' }}>
                Current Stock: {selectedPart.current_stock} {selectedPart.unit}
              </span>
            </div>
          )}
          <div>
            <label style={labelStyle}>Quantity Used <span style={{ color: '#d32f2f' }}>*</span></label>
            <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="0" min="0" step="0.01"
              style={{ ...inputStyle, border: isOverStock ? '1.5px solid #b91c1c' : '1.5px solid #e5ddd0' }} />
            {isOverStock && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>⚠ Quantity exceeds available stock</div>}
          </div>
        </div>

        {/* Where & Why */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Where & Why?</div>
          <div>
            <label style={labelStyle}>Machine / Equipment</label>
            <input type="text" value={formData.machine_name} onChange={e => setFormData({ ...formData, machine_name: e.target.value })} placeholder="e.g., Crusher, Conveyor Belt, Machine 1" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Purpose</label>
            <select value={formData.purpose} onChange={e => setFormData({ ...formData, purpose: e.target.value })} style={{ ...inputStyle, color: formData.purpose ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select purpose</option>
              {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={formData.usage_date} onChange={e => setFormData({ ...formData, usage_date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Issued To</label>
            <input type="text" value={formData.issued_to} onChange={e => setFormData({ ...formData, issued_to: e.target.value })} placeholder="Technician / team name" style={inputStyle} />
          </div>
        </div>

        {/* Notes */}
        <div style={cardStyle}>
          <label style={labelStyle}>Notes</label>
          <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes" rows={3} style={{ ...inputStyle, resize: 'none' }} />
        </div>

        <button onClick={handleSubmit} disabled={submitting || isOverStock} style={{ width: '100%', padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 15, fontWeight: 700, border: 'none', cursor: (submitting || isOverStock) ? 'not-allowed' : 'pointer', opacity: (submitting || isOverStock) ? 0.6 : 1 }}>
          {submitting ? 'Saving...' : 'Record Usage'}
        </button>
      </div>
    </div>
  )
}
