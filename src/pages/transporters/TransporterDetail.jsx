import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { MapPin, Phone, Edit2, Loader2, AlertCircle, Calendar } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function TransporterDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { plant } = useAuth()
  const [transporter, setTransporter] = useState(null)
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    address: ''
  })

  useEffect(() => {
    if (id && plant?.org_id) {
      fetchTransporterData()
    }
  }, [id, plant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchTransporterData() {
    try {
      setLoading(true)
      const { data: transporterData, error: transporterError } = await supabase
        .from('transporters')
        .select('*')
        .eq('id', id)
        .eq('org_id', plant.org_id)
        .single()

      if (transporterError) throw transporterError
      setTransporter(transporterData)
      setEditData({
        name: transporterData.name,
        phone: transporterData.phone,
        address: transporterData.address || ''
      })

      const { data: dispatchesData, error: dispatchesError } = await supabase
        .from('vehicle_dispatches')
        .select('*, dispatch_pellets(*)')
        .eq('transporter_id', id)
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .limit(10)

      if (dispatchesError) throw dispatchesError
      setDispatches(dispatchesData || [])
    } catch (err) {
      console.error('Error fetching transporter data:', err)
      showToast('Failed to load transporter details', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateTransporter() {
    if (!editData.name || !editData.phone) {
      showToast('Please fill in required fields', 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('transporters')
        .update({
          name: editData.name,
          phone: editData.phone,
          address: editData.address
        })
        .eq('id', id)

      if (error) throw error

      setTransporter({
        ...transporter,
        name: editData.name,
        phone: editData.phone,
        address: editData.address
      })

      setShowEditModal(false)
      showToast('Transporter updated successfully', 'success')
    } catch (err) {
      console.error('Error updating transporter:', err)
      showToast('Failed to update transporter', 'error')
    }
  }

  function handleCall(phone) {
    window.location.href = `tel:${phone}`
  }

  function handleSMS(phone) {
    window.location.href = `sms:${phone}`
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <Loader2 size={32} style={{ color: '#2d6a4f', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, color: '#595c4a' }}>Loading transporter...</p>
      </div>
    )
  }

  if (!transporter) {
    return (
      <div style={{ padding: '0 16px', paddingTop: 48, paddingBottom: 48 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 32, textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: '#b5b8a8', marginBottom: 8, margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, color: '#595c4a' }}>Transporter not found</p>
          <button
            onClick={() => navigate('/transporters')}
            style={{ marginTop: 16, padding: '8px 16px', background: '#2d6a4f', color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 8 }}
          >
            Back to Transporters
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <PageHeader
        title={transporter.name}
        subtitle="Transporter Details"
        backTo="/transporters"
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
        {/* Transporter Info Card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 12 }}>Transporter Information</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase', marginBottom: 4 }}>Name</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#2c2c2c' }}>{transporter.name}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Phone size={16} style={{ color: '#2d6a4f', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Phone</p>
                <a
                  href={`tel:${transporter.phone}`}
                  style={{ fontSize: 13, color: '#2d6a4f', fontWeight: 600, textDecoration: 'none' }}
                >
                  {transporter.phone}
                </a>
              </div>
            </div>

            {transporter.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <MapPin size={16} style={{ color: '#d4a373', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Address</p>
                  <p style={{ fontSize: 13, color: '#2c2c2c', marginTop: 2 }}>{transporter.address}</p>
                </div>
              </div>
            )}

            {transporter.created_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid #e5ddd0' }}>
                <Calendar size={16} style={{ color: '#b5b8a8', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Registered</p>
                  <p style={{ fontSize: 13, color: '#595c4a' }}>
                    {new Date(transporter.created_at).toLocaleDateString('en-IN')}
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
              onClick={() => handleCall(transporter.phone)}
              style={{ flex: 1, padding: '10px 12px', background: '#e8f0ec', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Phone size={16} style={{ color: '#2d6a4f' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2d6a4f' }}>Call</span>
            </button>
            <button
              onClick={() => handleSMS(transporter.phone)}
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
            <p style={{ fontSize: 13, color: '#595c4a', textAlign: 'center', padding: '16px 0' }}>No dispatches by this transporter yet</p>
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

      {/* Edit Transporter Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Transporter">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Transporter Name *</label>
            <input
              type="text"
              value={editData.name}
              onChange={e => setEditData({ ...editData, name: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Phone Number *</label>
            <input
              type="tel"
              value={editData.phone}
              onChange={e => setEditData({ ...editData, phone: e.target.value })}
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
              onClick={handleUpdateTransporter}
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
