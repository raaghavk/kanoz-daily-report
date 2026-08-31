import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import { Search, Plus, Package, AlertTriangle, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { getBrands, saveCustomBrand } from '../../lib/brands'

export default function SparePartsListPage() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [parts, setParts] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ name: '', part_number: '', brand: '', brand_other: '', category: '', category_other: '', unit: 'pcs', notes: '' })

  const CATEGORIES = ['Bearing', 'Belt', 'Coupling', 'Electrical', 'Fasteners', 'Filter', 'Gearbox', 'Hydraulic', 'Motor', 'Pneumatic', 'Sensor', 'Other']
  const UNITS = ['kg', 'litres', 'metres', 'pair', 'pcs', 'set']
  const [brands, setBrands] = useState(() => getBrands())

  useEffect(() => { if (plant?.org_id) fetchParts() }, [plant]) // eslint-disable-line

  useEffect(() => {
    let list = parts
    if (filterLow) list = list.filter(p => p.plant_min != null && p.current_stock <= p.plant_min)
    const q = searchQuery.toLowerCase()
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || (p.part_number || '').toLowerCase().includes(q))
    setFiltered(list)
  }, [searchQuery, parts, filterLow])

  async function fetchParts() {
    try {
      setLoading(true)
      const { data: partsData, error } = await supabase.from('spare_parts').select('*').eq('org_id', plant.org_id).eq('is_active', true).order('name')
      if (error) throw error

      const partIds = (partsData || []).map(p => p.id)
      const [purchasesRes, usageRes, configRes] = await Promise.all([
        supabase.from('spare_parts_purchases').select('part_id, quantity').eq('plant_id', plant.id).in('part_id', partIds),
        supabase.from('spare_parts_usage').select('part_id, quantity').eq('plant_id', plant.id).in('part_id', partIds),
        supabase.from('spare_parts_plant_config').select('part_id, min_stock_level').eq('plant_id', plant.id).in('part_id', partIds),
      ])

      const purchaseMap = {}
      for (const row of (purchasesRes.data || [])) purchaseMap[row.part_id] = (purchaseMap[row.part_id] || 0) + Number(row.quantity)
      const usageMap = {}
      for (const row of (usageRes.data || [])) usageMap[row.part_id] = (usageMap[row.part_id] || 0) + Number(row.quantity)
      const configMap = {}
      for (const row of (configRes.data || [])) configMap[row.part_id] = Number(row.min_stock_level)

      const enriched = (partsData || []).map(p => ({
        ...p,
        current_stock: (purchaseMap[p.id] || 0) - (usageMap[p.id] || 0),
        plant_min: configMap[p.id] ?? null,
      }))
      setParts(enriched)
    } catch { showToast('Failed to load parts', 'error') } finally { setLoading(false) }
  }

  async function handleAdd() {
    if (submitting) return
    if (!formData.name.trim()) { showToast('Part name is required', 'error'); return }
    if (!formData.brand) { showToast('Brand / Manufacturer is required', 'error'); return }
    if (formData.brand === 'Other' && !formData.brand_other.trim()) { showToast('Please specify the brand', 'error'); return }
    if (!formData.category) { showToast('Category is required', 'error'); return }
    if (formData.category === 'Other' && !formData.category_other.trim()) { showToast('Please specify the category', 'error'); return }
    if (!formData.unit) { showToast('Unit is required', 'error'); return }
    const finalCategory = formData.category === 'Other' ? formData.category_other.trim() : formData.category
    const finalBrand = formData.brand === 'Other' ? formData.brand_other.trim() : formData.brand
    try {
      setSubmitting(true)
      const { data, error } = await supabase.from('spare_parts').insert([{
        org_id: plant.org_id,
        name: formData.name.trim(),
        part_number: formData.part_number.trim() || null,
        brand: finalBrand,
        category: finalCategory,
        unit: formData.unit,
        notes: formData.notes.trim() || null,
        is_active: true,
      }]).select()
      if (error) throw error
      if (formData.brand === 'Other') {
        saveCustomBrand(finalBrand)
        setBrands(getBrands())
      }
      setParts(prev => [...prev, { ...data[0], current_stock: 0, plant_min: null }])
      setFormData({ name: '', part_number: '', brand: '', brand_other: '', category: '', category_other: '', unit: 'pcs', notes: '' })
      setShowAddModal(false)
      showToast('Part added', 'success')
    } catch { showToast('Failed to add part', 'error') } finally { setSubmitting(false) }
  }

  const lowCount = parts.filter(p => p.plant_min != null && p.current_stock <= p.plant_min).length

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader title="Spare Parts" subtitle="Parts catalogue & stock levels" />
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a8d7a' }} />
            <input type="text" placeholder="Search by name, category, part number..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, outline: 'none', background: '#fffdf5', border: '1.5px solid #e5ddd0', color: '#2c2c2c', boxSizing: 'border-box' }} />
          </div>
          {/* Low stock filter chip */}
          {lowCount > 0 && (
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setFilterLow(f => !f)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${filterLow ? '#b91c1c' : '#fca5a5'}`, background: filterLow ? '#fee2e2' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#b91c1c' }}>
                <AlertTriangle size={12} />
                {lowCount} Low Stock{filterLow ? ' (showing)' : ''}
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 20px', paddingBottom: 100 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0' }}>
            <Loader2 size={32} style={{ color: '#2d6a4f', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#595c4a' }}>Loading parts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 32, textAlign: 'center' }}>
            <AlertCircle size={32} style={{ color: '#b5b8a8', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: '#595c4a', marginBottom: 4 }}>{searchQuery || filterLow ? 'No parts found' : 'No parts added yet'}</p>
            <p style={{ fontSize: 12, color: '#b5b8a8' }}>{!searchQuery && !filterLow ? 'Add your first spare part to get started' : 'Try adjusting your search or filters'}</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            {filtered.map((part, idx) => {
              const isLow = part.plant_min != null && part.current_stock <= part.plant_min
              return (
                <button key={part.id} onClick={() => navigate(`/spare-parts/parts/${part.id}`)}
                  style={{ width: '100%', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: isLow ? '#fee2e2' : '#e8f0ec', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isLow ? <AlertTriangle size={16} style={{ color: '#b91c1c' }} /> : <Package size={16} style={{ color: '#2d6a4f' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{part.name}</div>
                    <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>
                      {part.brand ? `${part.brand} · ` : ''}{part.category || 'General'}{part.part_number ? ` · ${part.part_number}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isLow ? '#b91c1c' : '#2d6a4f' }}>
                      {part.current_stock} <span style={{ fontSize: 10, fontWeight: 400 }}>{part.unit}</span>
                    </div>
                    {isLow && <div style={{ fontSize: 9, color: '#b91c1c', fontWeight: 600 }}>LOW STOCK</div>}
                  </div>
                  <ChevronRight size={14} style={{ color: '#b5b8a8', flexShrink: 0 }} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowAddModal(true)} style={{ position: 'fixed', bottom: 88, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#2d6a4f', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(45,106,79,0.35)', zIndex: 50 }} title="Add Part">
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Part">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Part Name <span style={{ color: '#d32f2f' }}>*</span></label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Bearing 6205, V-Belt B52" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Part Number / Code <span style={{ fontWeight: 500, color: '#8a8d7a' }}>(optional)</span></label>
            <input type="text" value={formData.part_number} onChange={e => setFormData({ ...formData, part_number: e.target.value })} placeholder="e.g., SKF-6205, B52" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Brand / Manufacturer <span style={{ color: '#d32f2f' }}>*</span></label>
            <select value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value, brand_other: '' })} style={{ ...inputStyle, color: formData.brand ? '#2c2c2c' : '#8a8d7a' }}>
              <option value="">Select brand</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {formData.brand === 'Other' && (
            <div>
              <label style={labelStyle}>Specify Brand <span style={{ color: '#d32f2f' }}>*</span></label>
              <input type="text" value={formData.brand_other} onChange={e => setFormData({ ...formData, brand_other: e.target.value })} placeholder="e.g., Kirloskar, Greaves..." style={inputStyle} autoFocus />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category <span style={{ color: '#d32f2f' }}>*</span></label>
              <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value, category_other: '' })} style={{ ...inputStyle, color: formData.category ? '#2c2c2c' : '#8a8d7a' }}>
                <option value="">Select</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Unit <span style={{ color: '#d32f2f' }}>*</span></label>
              <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} style={inputStyle}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {formData.category === 'Other' && (
            <div>
              <label style={labelStyle}>Specify Category <span style={{ color: '#d32f2f' }}>*</span></label>
              <input type="text" value={formData.category_other} onChange={e => setFormData({ ...formData, category_other: e.target.value })} placeholder="e.g., Seals, Lubrication, Pump..." style={inputStyle} autoFocus />
            </div>
          )}
          <div style={{ background: '#f0f7f3', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: '#2d6a4f' }}>
            💡 Min stock level is set per plant when you first stock in this part
          </div>
          <div>
            <label style={labelStyle}>Notes <span style={{ color: '#b5b8a8', fontWeight: 400 }}>(optional)</span></label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional notes" rows={2} style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px 0', background: '#f3f4f6', color: '#2c2c2c', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAdd} disabled={submitting} style={{ flex: 1, padding: '10px 0', background: '#2d6a4f', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Adding...' : 'Add Part'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
