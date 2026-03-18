import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { Search, Plus, Phone, MessageSquare, MapPin, ChevronRight, Loader2, AlertCircle, Navigation } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function SupplierList() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState([])
  const [filteredSuppliers, setFilteredSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('supplier_form_draft')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore parse errors */ }
    return {
      name: '',
      mobile: '',
      address: '',
      raw_material_type: '',
      rate_offered: '',
      gcv_value: '',
      remarks: ''
    }
  })

  // Persist form data to sessionStorage so it survives app switches
  useEffect(() => {
    const hasData = Object.values(formData).some(v => v !== '')
    if (hasData) {
      sessionStorage.setItem('supplier_form_draft', JSON.stringify(formData))
    }
  }, [formData])

  // Re-open modal if there was a saved draft (user was mid-entry before app switch)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('supplier_form_draft')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Object.values(parsed).some(v => v !== '')) {
          setShowAddModal(true)
        }
      }
    } catch { /* ignore parse errors */ }
  }, [])

  useEffect(() => {
    if (plant?.id) {
      fetchSuppliers()
    }
  }, [plant]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const filtered = suppliers.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.mobile.includes(query)
      )
      setFilteredSuppliers(filtered)
    } else {
      setFilteredSuppliers(suppliers)
    }
  }, [searchQuery, suppliers])

  async function fetchSuppliers() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('plant_id', plant.id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      setSuppliers(data || [])
    } catch (err) {
      console.error('Error fetching suppliers:', err)
      showToast('Failed to load suppliers', 'error')
    } finally {
      setLoading(false)
    }
  }

  const [submitting, setSubmitting] = useState(false)

  async function handleAddSupplier() {
    if (submitting) return
    if (!formData.name.trim() || !formData.mobile.trim() || !formData.raw_material_type.trim()) {
      showToast('Please fill in required fields', 'error')
      return
    }

    try {
      setSubmitting(true)
      const { data, error } = await supabase
        .from('suppliers')
        .insert([{
          name: formData.name,
          mobile: formData.mobile,
          address: formData.address,
          raw_material_type: formData.raw_material_type,
          rate_offered: parseFloat(formData.rate_offered) || null,
          gcv_value: parseFloat(formData.gcv_value) || null,
          remarks: formData.remarks,
          plant_id: plant.id,
          org_id: plant.org_id,
          is_active: true
        }])
        .select()

      if (error) throw error

      setSuppliers([...suppliers, data[0]])
      setFormData({
        name: '',
        mobile: '',
        address: '',
        raw_material_type: '',
        rate_offered: '',
        gcv_value: '',
        remarks: ''
      })
      sessionStorage.removeItem('supplier_form_draft')
      setShowAddModal(false)
      showToast('Supplier added successfully', 'success')
    } catch (err) {
      console.error('Error adding supplier:', err)
      showToast('Failed to add supplier', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCall(mobile) {
    window.location.href = `tel:${mobile}`
  }

  function handleSMS(mobile) {
    window.location.href = `sms:${mobile}`
  }

  function handleMap(supplier) {
    if (supplier.address) {
      const encoded = encodeURIComponent(supplier.address)
      window.open(`https://www.google.com/maps/search/${encoded}`, '_blank')
    } else {
      showToast('No address available', 'info')
    }
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      {/* Header + Search (sticky) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader title="Supplier Database" subtitle="Manage your suppliers" backTo="/purchase" />

        {/* Search Bar */}
        <div style={{ padding: '0 20px', marginTop: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a8d7a' }} />
            <input
              type="text"
              placeholder="Search by name or mobile..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, outline: 'none', background: '#fffdf5', border: '1.5px solid #e5ddd0', color: '#2c2c2c' }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', marginTop: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <Loader2 size={32} style={{ color: '#2d6a4f', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#595c4a' }}>Loading suppliers...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 32, textAlign: 'center' }}>
            <AlertCircle size={32} style={{ color: '#b5b8a8', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: '#595c4a', marginBottom: 4 }}>
              {searchQuery ? 'No suppliers found' : 'No suppliers added yet'}
            </p>
            <p style={{ fontSize: 12, color: '#b5b8a8', marginBottom: 16 }}>
              {searchQuery ? 'Try a different search' : 'Add your first supplier to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{ padding: '8px 16px', background: '#2d6a4f', color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 8 }}
              >
                Add Supplier
              </button>
            )}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            {filteredSuppliers.map((supplier, idx) => (
              <div
                key={supplier.id}
                style={{ borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}
              >
                {/* Name + details — clickable to detail */}
                <button
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {supplier.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>
                    {supplier.raw_material_type || 'N/A'}
                    {supplier.rate_offered ? ` · ₹${supplier.rate_offered}` : ''}
                  </div>
                </button>
                {/* Quick action icons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCall(supplier.mobile) }}
                    style={{ width: 34, height: 34, borderRadius: 8, background: '#e8f0ec', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Phone size={14} style={{ color: '#2d6a4f' }} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSMS(supplier.mobile) }}
                    style={{ width: 34, height: 34, borderRadius: 8, background: '#EEF2FF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <MessageSquare size={14} style={{ color: '#2563EB' }} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMap(supplier) }}
                    style={{ width: 34, height: 34, borderRadius: 8, background: '#FEF3C7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Navigation size={14} style={{ color: '#B45309' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{ position: 'fixed', display: 'flex', alignItems: 'center', justifyContent: 'center', bottom: 96, right: 16, width: 56, height: 56, background: '#2d6a4f', borderRadius: '50%', boxShadow: '0 4px 14px rgba(45,106,79,0.3)', border: 'none', cursor: 'pointer', zIndex: 50 }}
      >
        <Plus size={24} color="white" />
      </button>

      {/* Add Supplier Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Supplier">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Supplier Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., ABC Biomass"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Mobile Number *</label>
            <input
              type="tel"
              value={formData.mobile}
              onChange={e => setFormData({ ...formData, mobile: e.target.value })}
              placeholder="e.g., 9876543210"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="Supplier address"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Material Type *</label>
            <input
              type="text"
              value={formData.raw_material_type}
              onChange={e => setFormData({ ...formData, raw_material_type: e.target.value })}
              placeholder="e.g., Wood Chips, Sawdust"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Rate (per unit)</label>
            <input
              type="number"
              value={formData.rate_offered}
              onChange={e => setFormData({ ...formData, rate_offered: e.target.value })}
              placeholder="0"
              step="0.01"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>GCV Value</label>
            <input
              type="number"
              value={formData.gcv_value}
              onChange={e => setFormData({ ...formData, gcv_value: e.target.value })}
              placeholder="0"
              step="0.01"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Any additional notes"
              rows="3"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button
              onClick={() => setShowAddModal(false)}
              style={{ flex: 1, padding: '10px 0', background: '#f3f4f6', color: '#2c2c2c', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddSupplier}
              disabled={submitting}
              style={{ flex: 1, padding: '10px 0', background: '#2d6a4f', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Adding...' : 'Add Supplier'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
