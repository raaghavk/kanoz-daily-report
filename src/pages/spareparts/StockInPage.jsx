import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import { Loader2, Plus, FileText, X, Upload } from 'lucide-react'

// ── Inline Bill PDF / Image uploader (accepts PDF + images) ──────────────────
function BillUpload({ value, onChange, required }) {
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowed.includes(file.type)) {
      showToast('Only PDF or image files allowed', 'error')
      fileRef.current.value = ''
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast('File must be under 15MB', 'error')
      fileRef.current.value = ''
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const filePath = `spare-parts-bills/${fileName}`
      const { error } = await supabase.storage.from('photos').upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath)
      onChange(urlData.publicUrl)
      showToast('Bill uploaded', 'success')
    } catch {
      showToast('Upload failed', 'error')
      fileRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  function clear() {
    onChange(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const isPdf = value && (value.includes('.pdf') || value.toLowerCase().includes('pdf'))

  return (
    <div>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleFile} />
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#e8f0ec' }}>
          <FileText size={20} style={{ color: '#2d6a4f', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={value} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#2d6a4f', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {isPdf ? 'View Bill PDF' : 'View Bill Image'}
            </a>
            <div style={{ fontSize: 10, color: '#595c4a' }}>Tap to open · tap × to replace</div>
          </div>
          <button onClick={clear} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={14} style={{ color: '#2c2c2c' }} />
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{ width: '100%', padding: '14px 12px', borderRadius: 12, border: `2px dashed ${required ? '#fca5a5' : '#b8d4c4'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#2d6a4f', cursor: uploading ? 'not-allowed' : 'pointer', background: 'rgba(45,106,79,0.03)', fontWeight: 600, fontSize: 13 }}>
          {uploading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Uploading...</> : <><Upload size={18} /> Upload Bill PDF / Photo</>}
        </button>
      )}
    </div>
  )
}

// ── Add New Part inline modal (mirrors SparePartsListPage FAB form) ────────────
function AddPartModal({ isOpen, onClose, onPartAdded, orgId }) {
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ name: '', part_number: '', category: '', unit: 'pcs', min_stock_level: '', notes: '' })
  const CATEGORIES = ['Bearing', 'Belt', 'Motor', 'Electrical', 'Hydraulic', 'Pneumatic', 'Fasteners', 'Gearbox', 'Coupling', 'Filter', 'Sensor', 'Other']
  const UNITS = ['pcs', 'metres', 'kg', 'litres', 'set', 'pair']
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }

  async function handleAdd() {
    if (submitting) return
    if (!formData.name.trim()) { showToast('Part name is required', 'error'); return }
    try {
      setSubmitting(true)
      const { data, error } = await supabase.from('spare_parts').insert([{
        org_id: orgId, name: formData.name.trim(),
        part_number: formData.part_number.trim() || null,
        category: formData.category || null, unit: formData.unit || 'pcs',
        min_stock_level: parseFloat(formData.min_stock_level) || 0,
        notes: formData.notes.trim() || null, is_active: true,
      }]).select()
      if (error) throw error
      showToast('Part added', 'success')
      setFormData({ name: '', part_number: '', category: '', unit: 'pcs', min_stock_level: '', notes: '' })
      onPartAdded(data[0])
      onClose()
    } catch { showToast('Failed to add part', 'error') } finally { setSubmitting(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Part">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Part Name <span style={{ color: '#d32f2f' }}>*</span></label>
          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Bearing 6205, V-Belt B52" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Part Number / Code</label>
          <input type="text" value={formData.part_number} onChange={e => setFormData({ ...formData, part_number: e.target.value })} placeholder="Optional" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Category</label>
            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} style={{ ...inputStyle, color: formData.category ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Unit</label>
            <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} style={inputStyle}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Minimum Stock Level</label>
          <input type="number" value={formData.min_stock_level} onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })} placeholder="Alert when stock falls below this" style={inputStyle} min="0" />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: '#f3f4f6', color: '#2c2c2c', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleAdd} disabled={submitting} style={{ flex: 1, padding: '10px 0', background: '#2d6a4f', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Adding...' : 'Add Part'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main StockInPage ──────────────────────────────────────────────────────────
export default function StockInPage() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [parts, setParts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showAddPart, setShowAddPart] = useState(false)
  const [formData, setFormData] = useState({
    part_id: '',
    supplier_id: '',
    quantity: '',
    rate_per_unit: '',
    purchase_date: new Date().toISOString().split('T')[0],
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
  }, [formData.warranty_months, formData.purchase_date]) // eslint-disable-line

  async function loadData() {
    setLoadingData(true)
    try {
      const [partsRes, suppliersRes] = await Promise.all([
        supabase.from('spare_parts').select('id, name, unit, category').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
        supabase.from('spare_parts_suppliers').select('id, name').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
      ])
      setParts(partsRes.data || [])
      setSuppliers(suppliersRes.data || [])
    } catch { showToast('Failed to load data', 'error') } finally { setLoadingData(false) }
  }

  async function handleSubmit() {
    if (submitting) return
    // Validation — everything mandatory except notes
    if (!formData.part_id) { showToast('Please select a part', 'error'); return }
    if (!formData.supplier_id) { showToast('Please select a supplier', 'error'); return }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) { showToast('Enter a valid quantity', 'error'); return }
    if (!formData.rate_per_unit || parseFloat(formData.rate_per_unit) <= 0) { showToast('Enter rate per unit', 'error'); return }
    if (!formData.purchase_date) { showToast('Purchase date is required', 'error'); return }
    if (!formData.bill_image_url) { showToast('Please upload the bill', 'error'); return }
    if (!formData.purchased_by.trim()) { showToast('Enter who purchased this', 'error'); return }
    try {
      setSubmitting(true)
      const { error } = await supabase.from('spare_parts_purchases').insert([{
        org_id: plant.org_id,
        part_id: formData.part_id,
        supplier_id: formData.supplier_id,
        quantity: parseFloat(formData.quantity),
        rate_per_unit: parseFloat(formData.rate_per_unit),
        purchase_date: formData.purchase_date,
        bill_image_url: formData.bill_image_url,
        warranty_months: formData.warranty_months ? parseInt(formData.warranty_months) : null,
        warranty_expiry_date: formData.warranty_expiry_date || null,
        purchased_by: formData.purchased_by.trim(),
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
  const req = <span style={{ color: '#d32f2f' }}>*</span>

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

          {/* Part selector + Add new */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.3 }}>Part {req}</label>
              <button onClick={() => setShowAddPart(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#e8f0ec', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#2d6a4f', cursor: 'pointer' }}>
                <Plus size={12} /> Add New Part
              </button>
            </div>
            <select value={formData.part_id} onChange={e => setFormData({ ...formData, part_id: e.target.value })}
              style={{ ...inputStyle, color: formData.part_id ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select part</option>
              {parts.map(p => <option key={p.id} value={p.id}>{p.name}{p.category ? ` (${p.category})` : ''}</option>)}
            </select>
          </div>

          {/* Unit badge */}
          {selectedPart && (
            <div style={{ background: '#e8f0ec', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#2d6a4f', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Unit: <span style={{ fontWeight: 800 }}>{selectedPart.unit}</span>
            </div>
          )}

          {/* Supplier — mandatory */}
          <div>
            <label style={labelStyle}>Supplier {req}</label>
            <select value={formData.supplier_id} onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
              style={{ ...inputStyle, color: formData.supplier_id ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {suppliers.length === 0 && (
              <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
                No suppliers yet — <button onClick={() => navigate('/spare-parts/suppliers')} style={{ background: 'none', border: 'none', color: '#d97706', fontWeight: 700, cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline' }}>add one first</button>
              </div>
            )}
          </div>
        </div>

        {/* Quantity & Rate */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Purchase Info</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>
                Quantity {req}
                {selectedPart && <span style={{ fontWeight: 800, color: '#2d6a4f', marginLeft: 4, textTransform: 'lowercase' }}>({selectedPart.unit})</span>}
              </label>
              <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="0" min="0" step="0.01" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Rate / {selectedPart ? selectedPart.unit : 'unit'} (₹) {req}</label>
              <input type="number" value={formData.rate_per_unit} onChange={e => setFormData({ ...formData, rate_per_unit: e.target.value })} placeholder="0.00" min="0" step="0.01" style={inputStyle} />
            </div>
          </div>
          {formData.quantity && formData.rate_per_unit && parseFloat(formData.quantity) > 0 && parseFloat(formData.rate_per_unit) > 0 && (
            <div style={{ background: '#e8f0ec', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#595c4a' }}>Total Amount</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2d6a4f' }}>₹{(parseFloat(formData.quantity) * parseFloat(formData.rate_per_unit)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div>
            <label style={labelStyle}>Purchase Date {req}</label>
            <input type="date" value={formData.purchase_date} onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Bill PDF / Photo {req}</label>
            <BillUpload value={formData.bill_image_url} onChange={v => setFormData(prev => ({ ...prev, bill_image_url: v || '' }))} required={!formData.bill_image_url} />
          </div>
          <div>
            <label style={labelStyle}>Purchased By {req}</label>
            <input type="text" value={formData.purchased_by} onChange={e => setFormData({ ...formData, purchased_by: e.target.value })} placeholder="Name of person who purchased" style={inputStyle} />
          </div>
        </div>

        {/* Warranty — optional */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Warranty <span style={{ color: '#b5b8a8', fontWeight: 500 }}>(Optional)</span></div>
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

        {/* Notes — optional */}
        <div style={cardStyle}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Notes <span style={{ color: '#b5b8a8', fontWeight: 500, textTransform: 'none' }}>(optional)</span></label>
          <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes" rows={3} style={{ ...inputStyle, resize: 'none', marginTop: 6 }} />
        </div>

        <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 15, fontWeight: 700, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Saving...' : 'Save Stock In'}
        </button>
      </div>

      {/* Add New Part modal */}
      <AddPartModal
        isOpen={showAddPart}
        onClose={() => setShowAddPart(false)}
        orgId={plant?.org_id}
        onPartAdded={(newPart) => {
          setParts(prev => [...prev, newPart].sort((a, b) => a.name.localeCompare(b.name)))
          setFormData(prev => ({ ...prev, part_id: newPart.id }))
        }}
      />
    </div>
  )
}
