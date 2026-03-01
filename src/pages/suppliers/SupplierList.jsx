import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { Search, Plus, Phone, MessageSquare, MapPin, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function SupplierList() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState([])
  const [filteredSuppliers, setFilteredSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    address: '',
    material_type: '',
    rate_offered: '',
    gcv_value: '',
    remarks: ''
  })

  useEffect(() => {
    if (plant?.id) {
      fetchSuppliers()
    }
  }, [plant])

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
        .eq('org_id', plant.org_id)
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

  async function handleAddSupplier() {
    if (!formData.name || !formData.mobile || !formData.material_type) {
      showToast('Please fill in required fields', 'error')
      return
    }

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([{
          name: formData.name,
          mobile: formData.mobile,
          address: formData.address,
          material_type: formData.material_type,
          rate_offered: parseFloat(formData.rate_offered) || null,
          gcv_value: parseFloat(formData.gcv_value) || null,
          remarks: formData.remarks,
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
        material_type: '',
        rate_offered: '',
        gcv_value: '',
        remarks: ''
      })
      setShowAddModal(false)
      showToast('Supplier added successfully', 'success')
    } catch (err) {
      console.error('Error adding supplier:', err)
      showToast('Failed to add supplier', 'error')
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
    <div className="pb-20">
      <PageHeader title="Supplier Database" subtitle="Manage your suppliers" backTo="/purchase" />

      {/* Search Bar */}
      <div style={{ padding: '0 20px', marginTop: 12 }}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8A9B92' }} />
          <input
            type="text"
            placeholder="Search by name or mobile..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, outline: 'none', background: '#F8FAF9', border: '1.5px solid #E2E8E4', color: '#1A1A2E' }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px', marginTop: 16 }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center" style={{ padding: '48px 0' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: '#1B7A45', marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: '#5A6B62' }}>Loading suppliers...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 32, textAlign: 'center' }}>
            <AlertCircle size={32} className="mx-auto" style={{ color: '#C5CFC8', marginBottom: 8 }} />
            <p style={{ fontSize: 14, color: '#5A6B62', marginBottom: 4 }}>
              {searchQuery ? 'No suppliers found' : 'No suppliers added yet'}
            </p>
            <p style={{ fontSize: 12, color: '#C5CFC8', marginBottom: 16 }}>
              {searchQuery ? 'Try a different search' : 'Add your first supplier to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{ padding: '8px 16px', background: '#1B7A45', color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 8 }}
              >
                Add Supplier
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredSuppliers.map(supplier => (
              <div
                key={supplier.id}
                style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}
              >
                {/* Card Header */}
                <button
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  className="w-full text-left"
                  style={{ marginBottom: 12 }}
                >
                  <div className="flex items-start justify-between" style={{ marginBottom: 4 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{supplier.name}</h3>
                    <ChevronRight size={16} style={{ color: '#C5CFC8' }} />
                  </div>
                  <p style={{ fontSize: 12, color: '#5A6B62' }}>{supplier.mobile}</p>
                </button>

                {/* Materials & Rate */}
                <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #E2E8E4' }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8', textTransform: 'uppercase' }}>Material</span>
                    <p style={{ fontSize: 12, color: '#1A1A2E', marginTop: 2 }}>{supplier.material_type || 'N/A'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8', textTransform: 'uppercase' }}>Rate</span>
                    <p style={{ fontSize: 12, color: '#1B7A45', fontWeight: 600, marginTop: 2 }}>
                      {supplier.rate_offered ? `₹${supplier.rate_offered}` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCall(supplier.mobile)}
                    className="flex-1 flex items-center justify-center gap-1.5"
                    style={{ padding: '8px 0', background: '#E8F5EE', borderRadius: 8 }}
                  >
                    <Phone size={14} style={{ color: '#1B7A45' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1B7A45' }}>Call</span>
                  </button>
                  <button
                    onClick={() => handleSMS(supplier.mobile)}
                    className="flex-1 flex items-center justify-center gap-1.5"
                    style={{ padding: '8px 0', background: '#EEF2FF', borderRadius: 8 }}
                  >
                    <MessageSquare size={14} style={{ color: '#2563EB' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>SMS</span>
                  </button>
                  <button
                    onClick={() => handleMap(supplier)}
                    className="flex-1 flex items-center justify-center gap-1.5"
                    style={{ padding: '8px 0', background: '#FFF8E6', borderRadius: 8 }}
                  >
                    <MapPin size={14} style={{ color: '#D4960A' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#D4960A' }}>Map</span>
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
        className="fixed flex items-center justify-center"
        style={{ bottom: 96, right: 16, width: 56, height: 56, background: '#1B7A45', borderRadius: '50%', boxShadow: '0 4px 14px rgba(27,122,69,0.3)' }}
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* Add Supplier Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Supplier">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Supplier Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., ABC Biomass"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Mobile Number *</label>
            <input
              type="tel"
              value={formData.mobile}
              onChange={e => setFormData({ ...formData, mobile: e.target.value })}
              placeholder="e.g., 9876543210"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="Supplier address"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Material Type *</label>
            <input
              type="text"
              value={formData.material_type}
              onChange={e => setFormData({ ...formData, material_type: e.target.value })}
              placeholder="e.g., Wood Chips, Sawdust"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Rate (per unit)</label>
            <input
              type="number"
              value={formData.rate_offered}
              onChange={e => setFormData({ ...formData, rate_offered: e.target.value })}
              placeholder="0"
              step="0.01"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>GCV Value</label>
            <input
              type="number"
              value={formData.gcv_value}
              onChange={e => setFormData({ ...formData, gcv_value: e.target.value })}
              placeholder="0"
              step="0.01"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Any additional notes"
              rows="3"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none', resize: 'none' }}
            />
          </div>

          <div className="flex gap-2" style={{ paddingTop: 8 }}>
            <button
              onClick={() => setShowAddModal(false)}
              style={{ flex: 1, padding: '10px 0', background: '#f3f4f6', color: '#1A1A2E', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddSupplier}
              style={{ flex: 1, padding: '10px 0', background: '#1B7A45', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
            >
              Add Supplier
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
