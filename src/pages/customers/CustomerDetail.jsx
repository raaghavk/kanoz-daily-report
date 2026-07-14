import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { MapPin, Edit2, Navigation, Loader2, AlertCircle, Calendar, Phone, Mail, User, Building2, FileText } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { plant } = useAuth()
  const [customer, setCustomer] = useState(null)
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({ name: '', mobile: '', address: '', contact_person: '', contact_phone: '', gst_number: '', account_owner: '', email: '', notes: '' })

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
      setEditData({ name: customerData.name, mobile: customerData.mobile || '', address: customerData.address || '', contact_person: customerData.contact_person || '', contact_phone: customerData.contact_phone || '', gst_number: customerData.gst_number || '', account_owner: customerData.account_owner || '', email: customerData.email || '', notes: customerData.notes || '' })

      const { data: dispatchesData, error: dispatchesError } = await supabase
        .from('vehicle_dispatches')
        .select('*, dispatch_pellets(*)')
        .eq('customer_id', id)
        .eq('is_deleted', false)
        .order('date', { ascending: false })
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
    if (!editData.name) {
      showToast('Name is required', 'error')
      return
    }

    try {
      const payload = {
        name: editData.name.trim(),
        mobile: editData.mobile.trim() || null,
        address: editData.address.trim() || null,
        contact_person: editData.contact_person.trim() || null,
        contact_phone: editData.contact_phone.trim() || null,
        gst_number: editData.gst_number.trim() || null,
        account_owner: editData.account_owner.trim() || null,
        email: editData.email.trim() || null,
        notes: editData.notes.trim() || null,
      }
      const { error } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', id)

      if (error) throw error

      setCustomer({ ...customer, ...payload })
      setShowEditModal(false)
      showToast('Customer updated successfully', 'success')
    } catch (err) {
      console.error('Error updating customer:', err)
      showToast('Failed to update customer', 'error')
    }
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
            style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer' }}
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

            {customer.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <MapPin size={16} style={{ color: '#d4a373', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Address</p>
                  <p style={{ fontSize: 13, color: '#2c2c2c', marginTop: 2 }}>{customer.address}</p>
                </div>
                <button
                  onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(customer.address)}`, '_blank')}
                  style={{ width: 32, height: 32, borderRadius: 8, background: '#FEF3C7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  <Navigation size={14} style={{ color: '#B45309' }} />
                </button>
              </div>
            )}

            {customer.mobile && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Phone size={16} style={{ color: '#2d6a4f', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Mobile</p>
                  <a href={`tel:${customer.mobile}`} style={{ fontSize: 13, color: '#2d6a4f', marginTop: 2, display: 'inline-block', textDecoration: 'none', fontWeight: 600 }}>{customer.mobile}</a>
                </div>
              </div>
            )}

            {customer.contact_person && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <User size={16} style={{ color: '#d4a373', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Contact Person</p>
                  <p style={{ fontSize: 13, color: '#2c2c2c', marginTop: 2 }}>{customer.contact_person}</p>
                </div>
              </div>
            )}

            {customer.contact_phone && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Phone size={16} style={{ color: '#d4a373', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Contact Phone</p>
                  <a href={`tel:${customer.contact_phone}`} style={{ fontSize: 13, color: '#2d6a4f', marginTop: 2, display: 'inline-block', textDecoration: 'none', fontWeight: 600 }}>{customer.contact_phone}</a>
                </div>
              </div>
            )}

            {customer.email && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Mail size={16} style={{ color: '#d4a373', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Email</p>
                  <a href={`mailto:${customer.email}`} style={{ fontSize: 13, color: '#2d6a4f', marginTop: 2, display: 'inline-block', textDecoration: 'none', fontWeight: 600 }}>{customer.email}</a>
                </div>
              </div>
            )}

            {customer.gst_number && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Building2 size={16} style={{ color: '#d4a373', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>GST Number</p>
                  <p style={{ fontSize: 13, color: '#2c2c2c', marginTop: 2 }}>{customer.gst_number}</p>
                </div>
              </div>
            )}

            {customer.account_owner && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <User size={16} style={{ color: '#2d6a4f', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Handled by (our team)</p>
                  <p style={{ fontSize: 13, color: '#2c2c2c', marginTop: 2 }}>{customer.account_owner}</p>
                </div>
              </div>
            )}

            {customer.notes && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <FileText size={16} style={{ color: '#d4a373', marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Notes</p>
                  <p style={{ fontSize: 13, color: '#2c2c2c', marginTop: 2, whiteSpace: 'pre-wrap' }}>{customer.notes}</p>
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

        {/* Recent Dispatches Section */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 12 }}>Recent Dispatches</h2>

          {dispatches.length === 0 ? (
            <p style={{ fontSize: 13, color: '#595c4a', textAlign: 'center', padding: '16px 0' }}>No dispatches to this customer yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dispatches.map(dispatch => {
                const totalMt = dispatch.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0) || 0
                return (
                  <div key={dispatch.id} style={{ background: '#fefae0', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 12, color: '#b5b8a8' }}>
                          {dispatch.date ? new Date(dispatch.date + 'T00:00:00').toLocaleDateString('en-IN') : '—'}
                        </p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2c', marginTop: 2 }}>
                          {dispatch.truck_number || 'N/A'}
                        </p>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#2d6a4f' }}>
                        {totalMt.toFixed(1)} MT
                      </p>
                    </div>
                    {dispatch.remarks && (
                      <div style={{ fontSize: 11, color: '#595c4a', marginTop: 6, paddingTop: 6, borderTop: '1px solid #e5ddd0' }}>
                        {dispatch.remarks}
                      </div>
                    )}
                  </div>
                )
              })}
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
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Address</label>
            <input
              type="text"
              value={editData.address}
              onChange={e => setEditData({ ...editData, address: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Mobile</label>
            <input
              type="tel"
              value={editData.mobile}
              onChange={e => setEditData({ ...editData, mobile: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Contact Person</label>
            <input
              type="text"
              value={editData.contact_person}
              onChange={e => setEditData({ ...editData, contact_person: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Contact Phone</label>
            <input
              type="tel"
              value={editData.contact_phone}
              onChange={e => setEditData({ ...editData, contact_phone: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={editData.email}
              onChange={e => setEditData({ ...editData, email: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>GST Number</label>
            <input
              type="text"
              value={editData.gst_number}
              onChange={e => setEditData({ ...editData, gst_number: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Handled by (our team)</label>
            <input
              type="text"
              value={editData.account_owner}
              onChange={e => setEditData({ ...editData, account_owner: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Notes</label>
            <textarea
              value={editData.notes}
              onChange={e => setEditData({ ...editData, notes: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
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
