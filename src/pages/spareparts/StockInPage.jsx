import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import { Loader2, Plus, FileText, X, Upload, Edit2, CheckCircle } from 'lucide-react'

// ── Bill PDF / Image uploader ─────────────────────────────────────────────────
function BillUpload({ value, onChange, required }) {
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowed.includes(file.type)) { showToast('Only PDF or image files allowed', 'error'); fileRef.current.value = ''; return }
    if (file.size > 15 * 1024 * 1024) { showToast('File must be under 15MB', 'error'); fileRef.current.value = ''; return }
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
    } catch { showToast('Upload failed', 'error'); fileRef.current.value = '' }
    finally { setUploading(false) }
  }

  function clear() { onChange(null); if (fileRef.current) fileRef.current.value = '' }
  const isPdf = value && value.toLowerCase().includes('.pdf')

  return (
    <div>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleFile} />
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#e8f0ec' }}>
          <FileText size={20} style={{ color: '#2d6a4f', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={value} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#2d6a4f', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

// ── Add New Part modal ────────────────────────────────────────────────────────
function AddPartModal({ isOpen, onClose, onPartAdded, orgId }) {
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ name: '', part_number: '', brand: '', brand_other: '', category: '', category_other: '', unit: 'pcs', notes: '' })
  const CATEGORIES = ['Bearing', 'Belt', 'Coupling', 'Electrical', 'Fasteners', 'Filter', 'Gearbox', 'Hydraulic', 'Motor', 'Pneumatic', 'Sensor', 'Other']
  const UNITS = ['kg', 'litres', 'metres', 'pair', 'pcs', 'set']
  const BRANDS = ['ABB', 'Bosch', 'Crompton', 'FAG', 'Fenner', 'Havells', 'L&T', 'Rexnord', 'Schneider', 'Siemens', 'SKF', 'Texrope', 'Other']
  const inp = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }
  const req = <span style={{ color: '#d32f2f' }}>*</span>

  async function handleAdd() {
    if (submitting) return
    if (!formData.name.trim()) { showToast('Part name is required', 'error'); return }
    if (!formData.part_number.trim()) { showToast('Part number is required', 'error'); return }
    if (!formData.brand) { showToast('Brand / Manufacturer is required', 'error'); return }
    if (formData.brand === 'Other' && !formData.brand_other.trim()) { showToast('Please specify the brand', 'error'); return }
    if (!formData.category) { showToast('Category is required', 'error'); return }
    if (formData.category === 'Other' && !formData.category_other.trim()) { showToast('Please specify the category', 'error'); return }
    if (!formData.unit) { showToast('Unit is required', 'error'); return }
    const finalBrand = formData.brand === 'Other' ? formData.brand_other.trim() : formData.brand
    const finalCategory = formData.category === 'Other' ? formData.category_other.trim() : formData.category
    try {
      setSubmitting(true)
      const { data, error } = await supabase.from('spare_parts').insert([{
        org_id: orgId, name: formData.name.trim(), part_number: formData.part_number.trim(),
        brand: finalBrand, category: finalCategory, unit: formData.unit,
        notes: formData.notes.trim() || null, is_active: true,
      }]).select()
      if (error) throw error
      showToast('Part added — set min stock level when you complete this stock in', 'success')
      setFormData({ name: '', part_number: '', brand: '', brand_other: '', category: '', category_other: '', unit: 'pcs', notes: '' })
      onPartAdded(data[0]); onClose()
    } catch { showToast('Failed to add part', 'error') } finally { setSubmitting(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Part">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label style={lbl}>Part Name {req}</label>
          <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Bearing 6205" style={inp} /></div>
        <div><label style={lbl}>Part Number / Code {req}</label>
          <input type="text" value={formData.part_number} onChange={e => setFormData({ ...formData, part_number: e.target.value })} placeholder="e.g., SKF-6205" style={inp} /></div>
        <div><label style={lbl}>Brand / Manufacturer {req}</label>
          <select value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value, brand_other: '' })} style={{ ...inp, color: formData.brand ? '#2c2c2c' : '#8a8d7a' }}>
            <option value="">Select brand</option>{BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select></div>
        {formData.brand === 'Other' && (
          <div><label style={lbl}>Specify Brand {req}</label>
            <input type="text" value={formData.brand_other} onChange={e => setFormData({ ...formData, brand_other: e.target.value })} placeholder="e.g., Kirloskar, Greaves..." style={inp} /></div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Category {req}</label>
            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value, category_other: '' })} style={{ ...inp, color: formData.category ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div style={{ flex: 1 }}><label style={lbl}>Unit {req}</label>
            <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} style={inp}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select></div>
        </div>
        {formData.category === 'Other' && (
          <div><label style={lbl}>Specify Category {req}</label>
            <input type="text" value={formData.category_other} onChange={e => setFormData({ ...formData, category_other: e.target.value })} placeholder="e.g., Seals, Pump..." style={inp} /></div>
        )}
        <div style={{ background: '#f0f7f3', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: '#2d6a4f' }}>
          💡 Min stock level will be set in the next step when you complete the stock in
        </div>
        <div><label style={lbl}>Notes <span style={{ color: '#b5b8a8', fontWeight: 400 }}>(optional)</span></label>
          <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes" rows={2} style={{ ...inp, resize: 'none' }} /></div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: '#f3f4f6', color: '#2c2c2c', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleAdd} disabled={submitting} style={{ flex: 1, padding: '10px 0', background: '#2d6a4f', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Adding...' : 'Add Part'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Review / Summary screen ───────────────────────────────────────────────────
function ReviewScreen({ formData, parts, suppliers, plants, onEdit, onConfirm, submitting }) {
  const part = parts.find(p => p.id === formData.part_id)
  const supplier = suppliers.find(s => s.id === formData.supplier_id)
  const receivingPlant = plants.find(p => p.id === formData.plant_id)
  const subtotal = parseFloat(formData.quantity) * parseFloat(formData.rate_per_unit)
  const gstAmt = subtotal * (parseFloat(formData.gst_percent) || 0) / 100
  const grandTotal = subtotal + gstAmt

  function fmt(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const row = (label, value, highlight) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f0ebe0' }}>
      <span style={{ fontSize: 12, color: '#8a8d7a', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: highlight ? '#2d6a4f' : '#2c2c2c', fontWeight: highlight ? 700 : 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Review" subtitle="Check before saving" onBack={onEdit} />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header confirm banner */}
        <div style={{ background: '#e8f0ec', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={20} style={{ color: '#2d6a4f', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2d6a4f' }}>Everything looks good?</div>
            <div style={{ fontSize: 11, color: '#595c4a', marginTop: 2 }}>Review the details below, then confirm to save.</div>
          </div>
        </div>

        {/* Plant, Part & Supplier */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '4px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5, padding: '10px 0 4px' }}>Part & Supplier</div>
          {row('Receiving Plant', receivingPlant?.name || '—')}
          {row('Part', part?.name || '—')}
          {part?.brand && row('Brand', part.brand)}
          {row('Category', part?.category || '—')}
          {row('Supplier', supplier?.name || '—')}
        </div>

        {/* Purchase */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '4px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5, padding: '10px 0 4px' }}>Purchase Info</div>
          {row('Quantity', `${formData.quantity} ${part?.unit || ''}`)}
          {row('Rate per unit', `₹${parseFloat(formData.rate_per_unit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)}
          {row('Subtotal', `₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)}
          {parseFloat(formData.gst_percent) > 0 && row(`GST @ ${formData.gst_percent}%`, `₹${gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)}
          {row('Grand Total', `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, true)}
          {row('Purchase Date', fmt(formData.purchase_date))}
          {row('Purchased By', formData.purchased_by)}
          {row('Bill', formData.bill_image_url ? '✓ Uploaded' : '—')}
        </div>

        {/* Min stock */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '4px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5, padding: '10px 0 4px' }}>Min Stock Level</div>
          {row('At ' + (receivingPlant?.name || 'Plant'), formData.min_stock_level !== '' ? `${formData.min_stock_level} ${part?.unit || ''}` : '—')}
        </div>

        {/* Warranty */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '4px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5, padding: '10px 0 4px' }}>Warranty</div>
          {row('Duration', formData.warranty_months ? `${formData.warranty_months} months` : '—')}
          {row('Expiry Date', fmt(formData.warranty_expiry_date))}
        </div>

        {formData.notes && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '4px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5, padding: '10px 0 4px' }}>Notes</div>
            <div style={{ fontSize: 13, color: '#595c4a', padding: '4px 0 12px' }}>{formData.notes}</div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onEdit} style={{ flex: 1, padding: '13px 0', background: '#f3f4f6', color: '#2c2c2c', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Edit2 size={15} /> Edit
          </button>
          <button onClick={onConfirm} disabled={submitting} style={{ flex: 2, padding: '13px 0', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {submitting ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><CheckCircle size={16} /> Confirm & Save</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main StockInPage ──────────────────────────────────────────────────────────
export default function StockInPage() {
  const { plant, employee } = useAuth()
  const isAdmin = employee?.role === 'admin'
  const navigate = useNavigate()
  const [parts, setParts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [plants, setPlants] = useState([])
  const [existingConfigs, setExistingConfigs] = useState({}) // part_id → min_stock_level if already configured
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showAddPart, setShowAddPart] = useState(false)
  const [showReview, setShowReview] = useState(false)

  const GST_OPTIONS = ['0', '5', '12', '18', '28']

  const [formData, setFormData] = useState({
    plant_id: '',
    part_id: '',
    supplier_id: '',
    quantity: '',
    rate_per_unit: '',
    gst_percent: '18',
    purchase_date: new Date().toISOString().split('T')[0],
    bill_image_url: '',
    warranty_months: '',
    warranty_expiry_date: '',
    purchased_by: '',
    min_stock_level: '',
    notes: '',
  })

  useEffect(() => { if (plant?.org_id) loadData() }, [plant]) // eslint-disable-line

  // Auto-compute warranty expiry when months or date changes
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
      const [partsRes, suppliersRes, plantsRes] = await Promise.all([
        supabase.from('spare_parts').select('id, name, unit, category, brand').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
        supabase.from('spare_parts_suppliers').select('id, name').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
        supabase.from('plants').select('id, name').eq('org_id', plant.org_id).eq('is_active', true).order('name'),
      ])
      setParts(partsRes.data || [])
      setSuppliers(suppliersRes.data || [])
      setPlants(plantsRes.data || [])
      setFormData(prev => ({ ...prev, plant_id: plant.id || '' }))
    } catch { showToast('Failed to load data', 'error') } finally { setLoadingData(false) }
  }

  // When part or plant changes, check if a min stock config already exists
  useEffect(() => {
    async function checkConfig() {
      if (!formData.part_id || !formData.plant_id) return
      const key = `${formData.plant_id}__${formData.part_id}`
      if (existingConfigs[key] !== undefined) {
        setFormData(prev => ({ ...prev, min_stock_level: String(existingConfigs[key]) }))
        return
      }
      const { data } = await supabase.from('spare_parts_plant_config')
        .select('min_stock_level').eq('plant_id', formData.plant_id).eq('part_id', formData.part_id).maybeSingle()
      const val = data?.min_stock_level ?? ''
      setExistingConfigs(prev => ({ ...prev, [key]: val === '' ? null : Number(val) }))
      setFormData(prev => ({ ...prev, min_stock_level: val === '' ? '' : String(val) }))
    }
    checkConfig()
  }, [formData.part_id, formData.plant_id]) // eslint-disable-line

  function handleReview() {
    if (!formData.plant_id) { showToast('Please select a plant / location', 'error'); return }
    if (!formData.part_id) { showToast('Please select a part', 'error'); return }
    if (!formData.supplier_id) { showToast('Please select a supplier', 'error'); return }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) { showToast('Enter a valid quantity', 'error'); return }
    if (!formData.rate_per_unit || parseFloat(formData.rate_per_unit) <= 0) { showToast('Enter rate per unit', 'error'); return }
    if (!formData.purchase_date) { showToast('Purchase date is required', 'error'); return }
    if (!formData.bill_image_url) { showToast('Please upload the bill', 'error'); return }
    if (!formData.purchased_by.trim()) { showToast('Enter who purchased this', 'error'); return }
    if (!formData.warranty_months) { showToast('Warranty period is required', 'error'); return }
    if (!formData.warranty_expiry_date) { showToast('Warranty expiry date is required', 'error'); return }
    if (formData.min_stock_level === '' || formData.min_stock_level === null) { showToast('Minimum stock level is required', 'error'); return }
    setShowReview(true)
  }

  async function handleConfirm() {
    if (submitting) return
    try {
      setSubmitting(true)
      // Save purchase
      const { error } = await supabase.from('spare_parts_purchases').insert([{
        org_id: plant.org_id,
        plant_id: formData.plant_id || null,
        part_id: formData.part_id,
        supplier_id: formData.supplier_id,
        quantity: parseFloat(formData.quantity),
        rate_per_unit: parseFloat(formData.rate_per_unit),
        gst_percent: parseFloat(formData.gst_percent) || 0,
        purchase_date: formData.purchase_date,
        bill_image_url: formData.bill_image_url,
        warranty_months: parseInt(formData.warranty_months),
        warranty_expiry_date: formData.warranty_expiry_date,
        purchased_by: formData.purchased_by.trim(),
        notes: formData.notes.trim() || null,
      }])
      if (error) throw error
      // Upsert plant-level min stock config
      if (formData.plant_id && formData.part_id && formData.min_stock_level !== '') {
        await supabase.from('spare_parts_plant_config').upsert({
          org_id: plant.org_id,
          plant_id: formData.plant_id,
          part_id: formData.part_id,
          min_stock_level: parseFloat(formData.min_stock_level) || 0,
        }, { onConflict: 'plant_id,part_id' })
      }
      showToast('Stock added successfully', 'success')
      navigate(-1)
    } catch { showToast('Failed to save', 'error') } finally { setSubmitting(false) }
  }

  const selectedPart = parts.find(p => p.id === formData.part_id)
  const subtotal = (parseFloat(formData.quantity) || 0) * (parseFloat(formData.rate_per_unit) || 0)
  const gstAmt = subtotal * (parseFloat(formData.gst_percent) || 0) / 100
  const grandTotal = subtotal + gstAmt

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }
  const cardStyle = { background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }
  const req = <span style={{ color: '#d32f2f' }}>*</span>

  if (loadingData) return (
    <div style={{ minHeight: '100%', background: '#fefae0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  // Show review screen instead of form
  if (showReview) return (
    <ReviewScreen
      formData={formData}
      parts={parts}
      suppliers={suppliers}
      plants={plants}
      onEdit={() => setShowReview(false)}
      onConfirm={handleConfirm}
      submitting={submitting}
    />
  )

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Stock In" subtitle="Record parts received" onBack={() => navigate(-1)} />

      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Plant selector — locked for non-admins */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Receiving Plant {req}</div>
          {isAdmin ? (
            <div>
              <label style={labelStyle}>Which plant is receiving this stock? {req}</label>
              <select value={formData.plant_id} onChange={e => setFormData({ ...formData, plant_id: e.target.value, part_id: '', min_stock_level: '' })}
                style={{ ...inputStyle, color: formData.plant_id ? '#2c2c2c' : '#8a8d7a' }}>
                <option value="">Select plant</option>
                {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ background: '#e8f0ec', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 700, color: '#2d6a4f' }}>
              {plants.find(p => p.id === formData.plant_id)?.name || '—'}
            </div>
          )}
        </div>

        {/* Part & Supplier */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Part Details</div>

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

          {selectedPart && (
            <div style={{ background: '#e8f0ec', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#2d6a4f', fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <span>Unit: <span style={{ fontWeight: 800 }}>{selectedPart.unit}</span></span>
              {selectedPart.brand && <span>Brand: <span style={{ fontWeight: 800 }}>{selectedPart.brand}</span></span>}
              {selectedPart.category && <span>Category: <span style={{ fontWeight: 800 }}>{selectedPart.category}</span></span>}
            </div>
          )}

          <div>
            <label style={labelStyle}>Supplier {req}</label>
            <select value={formData.supplier_id} onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
              style={{ ...inputStyle, color: formData.supplier_id ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {suppliers.length === 0 && (
              <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
                No suppliers yet —{' '}
                <button onClick={() => navigate('/spare-parts/suppliers')} style={{ background: 'none', border: 'none', color: '#d97706', fontWeight: 700, cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline' }}>
                  add one first
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quantity, Rate & GST */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Purchase Info</div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>
                Qty {req}
                {selectedPart && <span style={{ fontWeight: 800, color: '#2d6a4f', marginLeft: 4, textTransform: 'lowercase' }}>({selectedPart.unit})</span>}
              </label>
              <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} placeholder="0" min="0" step="0.01" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Rate / {selectedPart ? selectedPart.unit : 'unit'} (₹) {req}</label>
              <input type="number" value={formData.rate_per_unit} onChange={e => setFormData({ ...formData, rate_per_unit: e.target.value })} placeholder="0.00" min="0" step="0.01" style={inputStyle} />
            </div>
          </div>

          {/* GST % */}
          <div>
            <label style={labelStyle}>GST % {req}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {GST_OPTIONS.map(g => (
                <button key={g} onClick={() => setFormData({ ...formData, gst_percent: g })}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${formData.gst_percent === g ? '#2d6a4f' : '#e5ddd0'}`, background: formData.gst_percent === g ? '#2d6a4f' : '#fff', color: formData.gst_percent === g ? 'white' : '#595c4a', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {g}%
                </button>
              ))}
            </div>
          </div>

          {/* Live totals */}
          {subtotal > 0 && (
            <div style={{ background: '#f8faf8', borderRadius: 10, border: '1px solid #e5ddd0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderBottom: '1px solid #f0ebe0' }}>
                <span style={{ fontSize: 12, color: '#8a8d7a' }}>Subtotal</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#2c2c2c' }}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {gstAmt > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderBottom: '1px solid #f0ebe0' }}>
                  <span style={{ fontSize: 12, color: '#8a8d7a' }}>GST ({formData.gst_percent}%)</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#2c2c2c' }}>₹{gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: '#e8f0ec' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2d6a4f' }}>Grand Total</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#2d6a4f' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
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

        {/* Min stock level for this plant */}
        {formData.part_id && formData.plant_id && (
          <div style={cardStyle}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Min Stock Level at {plants.find(p => p.id === formData.plant_id)?.name || 'Plant'} {req}
            </div>
            <div>
              <label style={labelStyle}>
                Alert when stock falls below {req}
                {selectedPart && <span style={{ fontWeight: 800, color: '#2d6a4f', marginLeft: 4, textTransform: 'lowercase' }}>({selectedPart.unit})</span>}
              </label>
              <input type="number" value={formData.min_stock_level} onChange={e => setFormData({ ...formData, min_stock_level: e.target.value })}
                placeholder="e.g., 2" min="0" step="1" style={inputStyle} />
              <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 4 }}>
                {existingConfigs[`${formData.plant_id}__${formData.part_id}`] != null
                  ? `Currently set to ${existingConfigs[`${formData.plant_id}__${formData.part_id}`]} — you can update it here`
                  : 'First time stocking this part here — set your minimum threshold'}
              </div>
            </div>
          </div>
        )}

        {/* Warranty — now mandatory */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', letterSpacing: 0.5 }}>Warranty {req}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Duration (Months) {req}</label>
              <input type="number" value={formData.warranty_months} onChange={e => setFormData({ ...formData, warranty_months: e.target.value })} placeholder="e.g., 12" min="0" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Expiry Date {req}</label>
              <input type="date" value={formData.warranty_expiry_date} onChange={e => setFormData({ ...formData, warranty_expiry_date: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#8a8d7a' }}>Expiry date auto-fills when you enter months. You can adjust manually.</div>
        </div>

        {/* Notes — only optional field */}
        <div style={cardStyle}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Notes <span style={{ color: '#b5b8a8', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
          <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes" rows={3} style={{ ...inputStyle, resize: 'none', marginTop: 6 }} />
        </div>

        <button onClick={handleReview} style={{ width: '100%', padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          Review & Save →
        </button>
      </div>

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
