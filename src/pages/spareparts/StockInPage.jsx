import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { Loader2 } from 'lucide-react'

export default function StockInPage() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [parts, setParts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    part_id: '',
    supplier_id: '',
    quantity: '',
    rate_per_unit: '',
    purchase_date: new Date().toISOString().split('T')[0],
    bill_number: '',
    bill_image_url: '',
    warranty_months: '',
    warranty_expiry_date: '',
    purchased_by: '',
    notes: '',
  })

  useEffect(() => { if (plant?.org_id) loadData() }, [plant]) // eslint-disable-line

  // Auto-compute warranty expiry when months change
  useEffect(() => {
    if (formData.warranty_months && formData.purchase_date) {
      const d = new Date(formData.purchase_date)
      d.setMonth(d.getMonth() + parseInt(formData.warranty_months))
      setFormData(prev => ({ ...prev, warranty_expiry_date: d.toISOString().split('T')[0] }))
    }
  }, [formData.warranty_months, formData.purchase_date])

  async function loadData() {
    setLoadingData(true)
    try {
      const [partsRes, suppliersRes] = await Promise.all([
        supabase.from('spare_parts').select('id, name, unit, category').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
        supabase.from('spare_parts_suppliers').select('id, name, category').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
      ])
      setParts(partsRes.data || [])
      setSuppliers(suppliersRes.data || [])
    } catch { showToast('Failed to load data', 'error') } finally { setLoadingData(false) }
  }

  async function handleSubmit() {
    if (submitting) return
    if (!formData.part_id) { showToast('Please select a part', 'error'); return }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) { showToast('Enter a valid quantity', 'error'); return }
    try {
      setSubmitting(true)
      const { error } = await supabase.from('spare_parts_purchases').insert([{
        org_id: plant.org_id,
        part_id: formData.part_id,
        supplier_id: formData.supplier_id || null,
        quantity: parseFloat(formData.quantity),
        rate_per_unit: formData.rate_per_unit ? parseFloat(formData.rate_per_unit) : null,
        purchase_date: formData.purchase_date,
        bill_number: formData.bill_number.trim() || null,
        bill_image_url: formData.bill_image_url.trim() || null,
        warranty_months: formData.warranty_months ? parseInt(formData.warranty_months) : null,
        warranty_expiry_date: formData.warranty_expiry_date || null,
        purchased_by: formData.purchased_by.trim() || null,
        notes: formData.notes.trim() || null,
      }])
      if (error) throw error
      showToast('Stock added successfully', 'success')
      navigate(-1)
    } catch { showToast('Failed to save', 'error') } finally { setSubmitting(false) }
  }

  const selectedPart = parts.find(p => p.id === formData.part_id)

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
      <PageHeader title="Stock In" subtitle="Record parts received" onBack={() => navigate(-1)} />

      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Part & Supplier */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Part Details</div>
          <div>
            <label style={labelStyle}>Part <span style={{ color: '#d32f2f' }}>*</span></label>
            <select value={formData.part_id} onChange={e => setFormData({ ...formData, part_id: e.target.value })} style={{ ...inputStyle, color: formData.part_id ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select part</option>
              {parts.map(p => <option key={p.id} value={p.id}>{p.name}{p.category ? ` (${p.category})` : ''}</option>)}
            </select>
          </div>
          {selectedPart && (
            <div style={{ background: '#e8f0ec', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#2d6a4f', fontWeight: 600 }}>
              Unit: {selectedPart.unit}
            </div>
          )}
          <div>
            <label style={labelStyle}>Supplier</label>
            <select value={formData.supplier_id} onChange={e => setFormData({ ...formData, supplier_id: e.target.value })} style={{ ...inputStyle, color: formData.supplier_id ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select supplier (optional)</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Quantity & Rate */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Purchase Info</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Quantity <span style={{ color: '#d32f2f' }}>*</span></label>
              <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="0" min="0" step="0.01" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Rate per Unit (₹)</label>
              <input type="number" value={formData.rate_per_unit} onChange={e => setFormData({ ...formData, rate_per_unit: e.target.value })} placeholder="0.00" min="0" step="0.01" style={inputStyle} />
            </div>
          </div>
          {formData.quantity && formData.rate_per_unit && (
            <div style={{ background: '#e8f0ec', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#595c4a' }}>Total Amount</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2d6a4f' }}>₹{(parseFloat(formData.quantity) * parseFloat(formData.rate_per_unit)).toFixed(2)}</span>
            </div>
          )}
          <div>
            <label style={labelStyle}>Purchase Date</label>
            <input type="date" value={formData.purchase_date} onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Bill Number</label>
            <input type="text" value={formData.bill_number} onChange={e => setFormData({ ...formData, bill_number: e.target.value })} placeholder="Invoice / bill number" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Purchased By</label>
            <input type="text" value={formData.purchased_by} onChange={e => setFormData({ ...formData, purchased_by: e.target.value })} placeholder="Name of person who purchased" style={inputStyle} />
          </div>
        </div>

        {/* Warranty */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Warranty (Optional)</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Warranty (Months)</label>
              <input type="number" value={formData.warranty_months} onChange={e => setFormData({ ...formData, warranty_months: e.target.value })} placeholder="e.g., 12" min="0" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Expiry Date</label>
              <input type="date" value={formData.warranty_expiry_date} onChange={e => setFormData({ ...formData, warranty_expiry_date: e.target.value })} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={cardStyle}>
          <label style={labelStyle}>Notes</label>
          <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes about this purchase" rows={3} style={{ ...inputStyle, resize: 'none' }} />
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 15, fontWeight: 700, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Saving...' : 'Save Stock In'}
        </button>
      </div>
    </div>
  )
}
