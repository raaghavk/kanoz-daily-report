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
    <div style={{ paddingBottom: 80 }}>
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

      {/* Content */}
      <div style={{ padding: '0 20px', marginTop: 16 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredSuppliers.map(supplier => (
              <div
                key={supplier.id}
                style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}
              >
                {/* Card Header */}
                <button
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  style={{ width: '100%', textAlign: 'left', marginBottom: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{supplier.name}</h3>
                    <ChevronRight size={16} style={{ color: '#b5b8a8' }} />
                  </div>
                  <p style={{ fontSize: 12, color: '#595c4a' }}>{supplier.mobile}</p>
                </button>

                {/* Materials & Rate */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e5ddd0' }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Material</span>
                    <p style={{ fontSize: 12, color: '#2c2c2c', marginTop: 2 }}>{supplier.material_type || 'N/A'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Rate</span>
                    <p style={{ fontSize: 12, color: '#2d6a4f', fontWeight: 600, marginTop: 2 }}>
                      {supplier.rate_offered ? `₹${supplier.rate_offered}` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleCall(supplier.mobile)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', background: '#e8f0ec', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                  >
                    <Phone size={14} style={{ color: '#2d6a4f' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2d6a4f' }}>Call</span>
                  </button>
                  <button
                    onClick={() => handleSMS(supplier.mobile)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', background: '#EEF2FF', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                  >
                    <MessageSquare size={14} style={{ color: '#2563EB' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>SMS</span>
                  </button>
                  <button
                    onClick={() => handleMap(supplier)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', background: '#fefae0', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                  >
                    <MapPin size={14} style={{ color: '#d4a373' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#d4a373' }}>Map</span>
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
        style={{ position: 'fixed', display: 'flex', alignItems: 'center', justifyContent: 'center', bottom: 96, right: 16, width: 56, height: 56, background: '#2d6a4f', borderRadius: '50%', boxShadow: '0 4px 14px rgba(45,106,79,0.3)', border: 'none', cursor: 'pointer' }}
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
              value={formData.material_type}
              onChange={e => setFormData({ ...formData, material_type: e.target.value })}
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
              style={{ flex: 1, padding: '10px 0', background: '#2d6a4f', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Add Supplier
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
