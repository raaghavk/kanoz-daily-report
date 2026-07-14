import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { Search, Plus, Navigation, Loader2, AlertCircle } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function CustomerList() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [filteredCustomers, setFilteredCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', mobile: '', address: '', contact_person: '', contact_phone: '', gst_number: '', account_owner: '', email: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (plant?.org_id) fetchCustomers()
  }, [plant]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      setFilteredCustomers(customers.filter(c => c.name.toLowerCase().includes(q)))
    } else {
      setFilteredCustomers(customers)
    }
  }, [searchQuery, customers])

  async function fetchCustomers() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('customers').select('*').eq('org_id', plant.org_id).eq('is_active', true).order('name')
      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      console.error('Error fetching customers:', err)
      showToast('Failed to load customers', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddCustomer() {
    if (!formData.name.trim()) {
      showToast('Name is required', 'error')
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase.from('customers').insert([{ org_id: plant.org_id, name: formData.name.trim(), mobile: formData.mobile.trim() || null, address: formData.address.trim() || null, contact_person: formData.contact_person.trim() || null, contact_phone: formData.contact_phone.trim() || null, gst_number: formData.gst_number.trim() || null, account_owner: formData.account_owner.trim() || null, email: formData.email.trim() || null, notes: formData.notes.trim() || null, is_active: true }]).select()
      if (error) throw error
      setCustomers([...customers, data[0]])
      setFormData({ name: '', mobile: '', address: '', contact_person: '', contact_phone: '', gst_number: '', account_owner: '', email: '', notes: '' })
      setShowAddModal(false)
      showToast('Customer added', 'success')
    } catch (err) {
      console.error('Error adding customer:', err)
      showToast('Failed to add customer', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleMap(customer) {
    if (customer.address) {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(customer.address)}`, '_blank')
    } else {
      showToast('No address available', 'info')
    }
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader title="Customers" subtitle="Dispatch destinations" backTo="/settings" />
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a8d7a' }} />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, outline: 'none', background: '#fffdf5', border: '1.5px solid #e5ddd0', color: '#2c2c2c', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', paddingBottom: 100 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <Loader2 size={32} style={{ color: '#2d6a4f', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#595c4a' }}>Loading customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 32, textAlign: 'center' }}>
            <AlertCircle size={32} style={{ color: '#b5b8a8', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: '#595c4a', marginBottom: 4 }}>
              {searchQuery ? 'No customers found' : 'No customers added yet'}
            </p>
            <p style={{ fontSize: 12, color: '#b5b8a8', marginBottom: 16 }}>
              {searchQuery ? 'Try a different search' : 'Add your first customer to get started'}
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            {filteredCustomers.map((customer, idx) => (
              <div key={customer.id} style={{ borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                <button
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {customer.name}
                  </div>
                  {customer.contact_person && (
                    <div style={{ fontSize: 10, color: '#595c4a', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {customer.contact_person}
                    </div>
                  )}
                  {customer.address && (
                    <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {customer.address}
                    </div>
                  )}
                </button>
                {customer.address && (
                  <button onClick={(e) => { e.stopPropagation(); handleMap(customer) }} style={{ width: 34, height: 34, borderRadius: 8, background: '#FEF3C7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Navigation size={14} style={{ color: '#B45309' }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB — fixed bottom right */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed',
          bottom: 88,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#2d6a4f',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(45,106,79,0.35)',
          zIndex: 50,
        }}
        title="Add Customer"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Customer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Name <span style={{ color: '#d32f2f' }}>*</span></label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Customer name" style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Mobile</label>
            <input type="tel" value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })} placeholder="Mobile number (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Address</label>
            <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Address (optional)" rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Contact Person</label>
            <input type="text" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} placeholder="Their point of contact (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Contact Phone</label>
            <input type="tel" value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} placeholder="Contact person's number (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Email (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>GST Number</label>
            <input type="text" value={formData.gst_number} onChange={e => setFormData({ ...formData, gst_number: e.target.value })} placeholder="GST number (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Handled by (our team)</label>
            <input type="text" value={formData.account_owner} onChange={e => setFormData({ ...formData, account_owner: e.target.value })} placeholder="Account owner on our side (optional)" style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Notes (optional)" rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px 0', background: '#f3f4f6', color: '#2c2c2c', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAddCustomer} disabled={submitting} style={{ flex: 1, padding: '10px 0', background: '#2d6a4f', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Adding...' : 'Add Customer'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
