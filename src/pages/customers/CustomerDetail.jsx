import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { MapPin, Phone, Edit2, Navigation, Loader2, AlertCircle, Calendar } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { plant } = useAuth()
  const [customer, setCustomer] = useState(null)
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    mobile: '',
    address: ''
  })

  useEffect(() => {
    if (id && plant?.org_id) {
      fetchCustomerData()
    }
  }, [id, plant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchCustomerData() {
    try {
      setLoading(true)
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('org_id', plant.org_id)
        .single()

      if (customerError) throw customerError
      setCustomer(customerData)
      setEditData({
        name: customerData.name,
        mobile: customerData.mobile,
        address: customerData.address || ''
      })

      const { data: dispatchesData, error: dispatchesError } = await supabase
        .from('vehicle_dispatches')
        .select('*')
        .eq('customer_id', id)
        .order('dispatch_date', { ascending: false })
        .limit(10)

      if (dispatchesError) throw dispatchesError
      setDispatches(dispatchesData || [])
    } catch (err) {
      console.error('Error fetching customer data:', err)
      showToast('Failed to load customer details', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateCustomer() {
    if (!editData.name || !editData.mobile) {
      showToast('Please fill in required fields', 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: editData.name,
          mobile: editData.mobile,
          address: editData.address
        })
        .eq('id', id)

      if (error) throw error

      setCustomer({
        ...customer,
        name: editData.name,
        mobile: editData.mobile,
        address: editData.address
      })

      setShowEditModal(false)
      showToast('Customer updated successfully', 'success')
    } catch (err) {
      console.error('Error updating customer:', err)
      showToast('Failed to update customer', 'error')
    }
  }

  function handleCall(mobile) {
    window.location.href = `tel:${mobile}`
  }

  function handleSMS(mobile) {
    window.location.href = `sms:${mobile}`
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <Loader2 size={32} style={{ color: '#2d6a4f', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, color: '#595c4a' }}>Loading customer...</p>
      </div>
    )
  }

  if (!customer) {
    return (
      <div style={{ padding: '0 16px', paddingTop: 48, paddingBottom: 48 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 32, textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: '#b5b8a8', marginBottom: 8, margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, color: '#595c4a' }}>Customer not found</p>
          <button
            onClick={() => navigate('/customers')}
            style={{ marginTop: 16, padding: '8px 16px', background: '#2d6a4f', color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 8 }}
          >
            Back to Customers
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <PageHeader
        title={customer.name}
        subtitle="Customer Details"
        backTo="/customers"
        rightAction={
          <button
            onClick={() => setShowEditModal(true)}
            style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <Edit2 size={16} color="white" />
          </button>
        }
      />

      <div style={{ padding: '0 20px', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Customer Info Card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 12 }}>Customer Information</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase', marginBottom: 4 }}>Name</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#2c2c2c' }}>{customer.name}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Phone size={16} style={{ color: '#2d6a4f', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Mobile</p>
                <a
                  href={`tel:${customer.mobile}`}
                  style={{ fontSize: 13, color: '#2d6a4f', fontWeight: 600, textDecoration: 'none' }}
                >
                  {customer.mobile}
                </a>
              </div>
            </div>

            {customer.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <MapPin size={16} style={{ color: '#d4a373', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Address</p>
                  <p style={{ fontSize: 13, color: '#2c2c2c', marginTop: 2 }}>{customer.address}</p>
                </div>
              </div>
            )}

            {customer.created_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid #e5ddd0' }}>
                <Calendar size={16} style={{ color: '#b5b8a8', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Registered</p>
                  <p style={{ fontSize: 13, color: '#595c4a' }}>
                    {new Date(customer.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 12 }}>Quick Actions</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleCall(customer.mobile)}
              style={{ flex: 1, padding: '10px 12px', background: '#e8f0ec', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Phone size={16} style={{ color: '#2d6a4f' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2d6a4f' }}>Call</span>
            </button>
            <button
              onClick={() => handleSMS(customer.mobile)}
              style={{ flex: 1, padding: '10px 12px', background: '#EEF2FF', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2563EB' }}>SMS</span>
            </button>
          </div>
        </div>

        {/* Recent Dispatches Section */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 12 }}>Recent Dispatches</h2>

          {dispatches.length === 0 ? (
            <p style={{ fontSize: 13, color: '#595c4a', textAlign: 'center', padding: '16px 0' }}>No dispatches to this customer yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dispatches.map(dispatch => (
                <div key={dispatch.id} style={{ background: '#fefae0', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 12, color: '#b5b8a8' }}>
                        {new Date(dispatch.dispatch_date).toLocaleDateString('en-IN')}
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2c', marginTop: 2 }}>
                        {dispatch.vehicle_number || 'N/A'}
                      </p>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#2d6a4f' }}>
                      {dispatch.dispatch_quantity || '-'} MT
                    </p>
                  </div>

                  {dispatch.remarks && (
                    <div style={{ fontSize: 11, color: '#595c4a', marginTop: 6, paddingTop: 6, borderTop: '1px solid #e5ddd0' }}>
                      {dispatch.remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Customer Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Customer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Customer Name *</label>
            <input
              type="text"
              value={editData.name}
              onChange={e => setEditData({ ...editData, name: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Mobile Number *</label>
            <input
              type="tel"
              value={editData.mobile}
              onChange={e => setEditData({ ...editData, mobile: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Address</label>
            <input
              type="text"
              value={editData.address}
              onChange={e => setEditData({ ...editData, address: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
            <button
              onClick={() => setShowEditModal(false)}
              style={{ flex: 1, padding: '10px 0', background: '#f3f4f6', color: '#2c2c2c', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateCustomer}
              style={{ flex: 1, padding: '10px 0', background: '#2d6a4f', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
