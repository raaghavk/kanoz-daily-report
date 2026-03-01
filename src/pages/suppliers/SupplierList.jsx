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
      <div className="px-4 mt-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8A9B92' }} />
          <input
            type="text"
            placeholder="Search by name or mobile..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: '#F8FAF9', border: '1.5px solid #E2E8E4', color: '#1A1A2E' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={32} className="text-kanoz-green animate-spin mb-2" />
            <p className="text-sm text-kanoz-text-secondary">Loading suppliers...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-8 text-center">
            <AlertCircle size={32} className="mx-auto text-kanoz-text-tertiary mb-2" />
            <p className="text-sm text-kanoz-text-secondary mb-1">
              {searchQuery ? 'No suppliers found' : 'No suppliers added yet'}
            </p>
            <p className="text-xs text-kanoz-text-tertiary mb-4">
              {searchQuery ? 'Try a different search' : 'Add your first supplier to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-kanoz-green text-white text-xs font-bold rounded-lg"
              >
                Add Supplier
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSuppliers.map(supplier => (
              <div
                key={supplier.id}
                className="bg-kanoz-card rounded-xl border border-kanoz-border p-4 hover:shadow-md transition-shadow"
              >
                {/* Card Header */}
                <button
                  onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  className="w-full text-left mb-3"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-bold text-sm text-kanoz-text">{supplier.name}</h3>
                    <ChevronRight size={16} className="text-kanoz-text-tertiary" />
                  </div>
                  <p className="text-xs text-kanoz-text-secondary">{supplier.mobile}</p>
                </button>

                {/* Materials & Rate */}
                <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-kanoz-border">
                  <div>
                    <span className="text-[10px] font-semibold text-kanoz-text-tertiary uppercase">Material</span>
                    <p className="text-xs text-kanoz-text mt-0.5">{supplier.material_type || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-kanoz-text-tertiary uppercase">Rate</span>
                    <p className="text-xs text-kanoz-green font-semibold mt-0.5">
                      {supplier.rate_offered ? `₹${supplier.rate_offered}` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCall(supplier.mobile)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-kanoz-green/10 hover:bg-kanoz-green/20 rounded-lg transition-colors"
                  >
                    <Phone size={14} className="text-kanoz-green" />
                    <span className="text-xs font-semibold text-kanoz-green">Call</span>
                  </button>
                  <button
                    onClick={() => handleSMS(supplier.mobile)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-kanoz-blue/10 hover:bg-kanoz-blue/20 rounded-lg transition-colors"
                  >
                    <MessageSquare size={14} className="text-kanoz-blue" />
                    <span className="text-xs font-semibold text-kanoz-blue">SMS</span>
                  </button>
                  <button
                    onClick={() => handleMap(supplier)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-kanoz-accent/10 hover:bg-kanoz-accent/20 rounded-lg transition-colors"
                  >
                    <MapPin size={14} className="text-kanoz-accent" />
                    <span className="text-xs font-semibold text-kanoz-accent">Map</span>
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
        className="fixed bottom-24 right-4 w-14 h-14 bg-kanoz-green rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* Add Supplier Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Supplier">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Supplier Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., ABC Biomass"
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Mobile Number *</label>
            <input
              type="tel"
              value={formData.mobile}
              onChange={e => setFormData({ ...formData, mobile: e.target.value })}
              placeholder="e.g., 9876543210"
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="Supplier address"
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Material Type *</label>
            <input
              type="text"
              value={formData.material_type}
              onChange={e => setFormData({ ...formData, material_type: e.target.value })}
              placeholder="e.g., Wood Chips, Sawdust"
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Rate (per unit)</label>
            <input
              type="number"
              value={formData.rate_offered}
              onChange={e => setFormData({ ...formData, rate_offered: e.target.value })}
              placeholder="0"
              step="0.01"
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">GCV Value</label>
            <input
              type="number"
              value={formData.gcv_value}
              onChange={e => setFormData({ ...formData, gcv_value: e.target.value })}
              placeholder="0"
              step="0.01"
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Any additional notes"
              rows="3"
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-2.5 bg-gray-100 text-kanoz-text rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSupplier}
              className="flex-1 py-2.5 bg-kanoz-green text-white rounded-lg text-sm font-semibold hover:bg-kanoz-green/90 transition-colors"
            >
              Add Supplier
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
