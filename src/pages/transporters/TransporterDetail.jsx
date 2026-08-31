import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { MapPin, Phone, Edit2, Loader2, AlertCircle, Calendar } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { VEHICLE_TYPES } from '../../lib/vehicleTypes'

export default function TransporterDetail() {
  const { id: transporterId } = useParams()
  const id = transporterId
  const navigate = useNavigate()
  const { plant } = useAuth()
  const [transporter, setTransporter] = useState(null)
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    address: '',
    category: '',
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
  })

  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [newVehicle, setNewVehicle] = useState({ vehicle_number: '', vehicle_type: 'Tractor', driver_name: '', driver_phone: '' })
  const [addingVehicle, setAddingVehicle] = useState(false)

  const { data: vehicles = [], refetch: refetchVehicles } = useQuery({
    queryKey: ['transporter-vehicles', transporterId],
    queryFn: async () => {
      const { data } = await supabase
        .from('transporter_vehicles')
        .select('*')
        .eq('transporter_id', transporterId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      return data || []
    },
    enabled: !!transporterId,
  })

  async function addVehicle() {
    if (!newVehicle.vehicle_number.trim()) { showToast('Vehicle number required', 'error'); return }
    setAddingVehicle(true)
    try {
      const { error } = await supabase.from('transporter_vehicles').insert([{
        transporter_id: transporterId,
        vehicle_number: newVehicle.vehicle_number.trim().toUpperCase(),
        vehicle_type: newVehicle.vehicle_type || 'Tractor',
        driver_name: newVehicle.driver_name.trim() || null,
        driver_phone: newVehicle.driver_phone.trim() ? '+91' + newVehicle.driver_phone.trim().replace(/^\+91/, '') : null,
      }])
      if (error) throw error
      refetchVehicles()
      setNewVehicle({ vehicle_number: '', vehicle_type: 'Tractor', driver_name: '', driver_phone: '' })
      setShowAddVehicle(false)
      showToast('Vehicle added', 'success')
    } catch { showToast('Failed to add vehicle', 'error') }
    finally { setAddingVehicle(false) }
  }

  async function deactivateVehicle(vehicleId) {
    try {
      await supabase.from('transporter_vehicles').update({ is_active: false }).eq('id', vehicleId)
      refetchVehicles()
      showToast('Vehicle removed', 'success')
    } catch { showToast('Failed to remove', 'error') }
  }

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
        address: transporterData.address || '',
        category: transporterData.category || '',
        vehicle_number: transporterData.vehicle_number || '',
        driver_name: transporterData.driver_name || '',
        driver_phone: transporterData.driver_phone ? transporterData.driver_phone.replace(/^\+91/, '') : '',
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
          address: editData.address || null,
          category: editData.category || null,
          vehicle_number: editData.vehicle_number.trim() || null,
          driver_name: editData.driver_name.trim() || null,
          driver_phone: editData.driver_phone.trim() ? '+91' + editData.driver_phone.replace(/^\+91/, '').trim() : null,
        })
        .eq('id', id)

      if (error) throw error

      setTransporter({
        ...transporter,
        name: editData.name,
        phone: editData.phone,
        address: editData.address || null,
        category: editData.category || null,
        vehicle_number: editData.vehicle_number.trim() || null,
        driver_name: editData.driver_name.trim() || null,
        driver_phone: editData.driver_phone.trim() ? '+91' + editData.driver_phone.replace(/^\+91/, '').trim() : null,
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

            {(transporter.category || transporter.vehicle_number) && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase', marginBottom: 4 }}>Vehicle</p>
                <p style={{ fontSize: 13, color: '#2c2c2c' }}>{[transporter.category, transporter.vehicle_number].filter(Boolean).join(' · ')}</p>
              </div>
            )}

            {(transporter.driver_name || transporter.driver_phone) && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase', marginBottom: 4 }}>Default Driver</p>
                <p style={{ fontSize: 13, color: '#2c2c2c' }}>{transporter.driver_name || ''}</p>
                {transporter.driver_phone && (
                  <a href={`tel:${transporter.driver_phone}`} style={{ fontSize: 13, color: '#2d6a4f', textDecoration: 'none' }}>
                    📞 {transporter.driver_phone.replace('+91', '')}
                  </a>
                )}
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

        {/* Vehicles */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #e5ddd0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>Vehicles ({vehicles.length})</span>
            <button onClick={() => setShowAddVehicle(v => !v)}
              style={{ fontSize: 12, color: '#2d6a4f', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              + Add Vehicle
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8a8d7a', textAlign: 'center', padding: '8px 0' }}>No vehicles added yet</div>
          ) : (
            vehicles.map(v => (
              <div key={v.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0ebe0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>{v.vehicle_number}</div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>{v.vehicle_type}</div>
                  {v.driver_name && <div style={{ fontSize: 12, color: '#595c4a', marginTop: 2 }}>{v.driver_name}</div>}
                  {v.driver_phone && (
                    <a href={`tel:${v.driver_phone}`} style={{ fontSize: 12, color: '#2d6a4f', textDecoration: 'none', display: 'block', marginTop: 2 }}>
                      📞 {v.driver_phone.replace('+91', '')}
                    </a>
                  )}
                </div>
                <button onClick={() => deactivateVehicle(v.id)}
                  style={{ fontSize: 11, color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            ))
          )}

          {showAddVehicle && (
            <div style={{ marginTop: 12, padding: '12px 0', borderTop: '1px solid #e5ddd0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>Vehicle No *</label>
                  <input type="text" placeholder="UP70MT6151" value={newVehicle.vehicle_number}
                    onChange={e => setNewVehicle(p => ({ ...p, vehicle_number: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', background: '#fefae0', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>Type</label>
                  <select
                    value={VEHICLE_TYPES.includes(newVehicle.vehicle_type) ? newVehicle.vehicle_type : (newVehicle.vehicle_type ? 'Other' : 'Tractor')}
                    onChange={e => setNewVehicle(p => ({ ...p, vehicle_type: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
                  >
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <input type="text" placeholder="Driver name" value={newVehicle.driver_name}
                onChange={e => setNewVehicle(p => ({ ...p, driver_name: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', background: '#fefae0', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <span style={{ padding: '9px 8px 9px 12px', background: '#e8f0ec', borderRadius: '12px 0 0 12px', border: '1.5px solid #e5ddd0', borderRight: 'none', fontSize: 13, color: '#2d6a4f', fontWeight: 600 }}>+91</span>
                <input type="tel" placeholder="Driver phone" value={newVehicle.driver_phone}
                  onChange={e => setNewVehicle(p => ({ ...p, driver_phone: e.target.value }))}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: '0 12px 12px 0', border: '1.5px solid #e5ddd0', fontSize: 13, outline: 'none', background: '#fefae0' }} />
              </div>
              <button onClick={addVehicle} disabled={addingVehicle}
                style={{ width: '100%', padding: '10px 0', borderRadius: 12, background: '#2d6a4f', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: addingVehicle ? 0.6 : 1 }}>
                {addingVehicle ? 'Adding...' : 'Add Vehicle'}
              </button>
            </div>
          )}
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

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Type</label>
            <select value={editData.category} onChange={e => setEditData({ ...editData, category: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}>
              <option value="">Select type...</option>
              <option value="Tractor">Tractor</option>
              <option value="Truck">Truck</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Vehicle Number</label>
            <input type="text" value={editData.vehicle_number} onChange={e => setEditData({ ...editData, vehicle_number: e.target.value })} placeholder="e.g., UP70 AB 1234" style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Driver Name</label>
            <input type="text" value={editData.driver_name} onChange={e => setEditData({ ...editData, driver_name: e.target.value })} placeholder="Default driver name" style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Driver Phone</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span style={{ padding: '10px 8px 10px 12px', background: '#e8f0ec', borderRadius: '12px 0 0 12px', border: '1.5px solid #e5ddd0', borderRight: 'none', fontSize: 14, color: '#2d6a4f', fontWeight: 600 }}>+91</span>
              <input type="tel" value={editData.driver_phone} onChange={e => setEditData({ ...editData, driver_phone: e.target.value })} placeholder="10-digit number" style={{ flex: 1, padding: '10px 12px', borderRadius: '0 12px 12px 0', border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }} />
            </div>
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
