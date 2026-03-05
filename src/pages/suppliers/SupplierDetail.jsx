import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { MapPin, Phone, Edit2, Navigation, Loader2, AlertCircle, Calendar } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function SupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { plant } = useAuth()
  const [supplier, setSupplier] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    mobile: '',
    address: '',
    material_type: '',
    rate_offered: '',
    remarks: ''
  })

  useEffect(() => {
    if (id && plant?.id) {
      fetchSupplierData()
    }
  }, [id, plant])

  async function fetchSupplierData() {
    try {
      setLoading(true)
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .eq('org_id', plant.org_id)
        .single()

      if (supplierError) throw supplierError
      setSupplier(supplierData)
      setEditData({
        name: supplierData.name,
        mobile: supplierData.mobile,
        address: supplierData.address || '',
        material_type: supplierData.material_type,
        rate_offered: supplierData.rate_offered?.toString() || '',
        remarks: supplierData.remarks || ''
      })

      const { data: purchasesData, error: purchasesError } = await supabase
        .from('rm_purchases')
        .select('*')
        .eq('supplier_id', id)
        .eq('plant_id', plant.id)
        .order('purchase_date', { ascending: false })
        .limit(10)

      if (purchasesError) throw purchasesError
      setPurchases(purchasesData || [])
    } catch (err) {
      console.error('Error fetching supplier data:', err)
      showToast('Failed to load supplier details', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateSupplier() {
    if (!editData.name || !editData.mobile || !editData.material_type) {
      showToast('Please fill in required fields', 'error')
      return
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: editData.name,
          mobile: editData.mobile,
          address: editData.address,
          material_type: editData.material_type,
          rate_offered: editData.rate_offered ? parseFloat(editData.rate_offered) : null,
          remarks: editData.remarks
        })
        .eq('id', id)

      if (error) throw error

      setSupplier({
        ...supplier,
        name: editData.name,
        mobile: editData.mobile,
        address: editData.address,
        material_type: editData.material_type,
        rate_offered: editData.rate_offered ? parseFloat(editData.rate_offered) : null,
        remarks: editData.remarks
      })

      setShowEditModal(false)
      showToast('Supplier updated successfully', 'success')
    } catch (err) {
      console.error('Error updating supplier:', err)
      showToast('Failed to update supplier', 'error')
    }
  }

  async function handleGetLocation() {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported by your browser', 'error')
      return
    }

    try {
      setGettingLocation(true)
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          try {
            const { error } = await supabase
              .from('suppliers')
              .update({
                location_lat: latitude,
                location_lng: longitude
              })
              .eq('id', id)

            if (error) throw error

            setSupplier({
              ...supplier,
              location_lat: latitude,
              location_lng: longitude
            })

            showToast('Location saved successfully', 'success')
          } catch (err) {
            console.error('Error saving location:', err)
            showToast('Failed to save location', 'error')
          }
        },
        (error) => {
          console.error('Geolocation error:', error)
          showToast('Failed to get location. Check permissions.', 'error')
        },
        { enableHighAccuracy: true }
      )
    } finally {
      setGettingLocation(false)
    }
  }

  function handleGetDirections() {
    if (supplier?.location_lat && supplier?.location_lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${supplier.location_lat},${supplier.location_lng}`
      window.open(url, '_blank')
    } else if (supplier?.address) {
      const encoded = encodeURIComponent(supplier.address)
      const url = `https://www.google.com/maps/search/${encoded}`
      window.open(url, '_blank')
    } else {
      showToast('No location or address available', 'info')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <Loader2 size={32} style={{ color: '#2d6a4f', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, color: '#595c4a' }}>Loading supplier...</p>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div style={{ padding: '0 16px', paddingTop: 48, paddingBottom: 48 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 32, textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: '#b5b8a8', marginBottom: 8, margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, color: '#595c4a' }}>Supplier not found</p>
          <button
            onClick={() => navigate('/suppliers')}
            style={{ marginTop: 16, padding: '8px 16px', background: '#2d6a4f', color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 8 }}
          >
            Back to Suppliers
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <PageHeader
        title={supplier.name}
        subtitle="Supplier Details"
        backTo="/suppliers"
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
        {/* Supplier Info Card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 12 }}>Supplier Information</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Phone size={16} style={{ color: '#2d6a4f', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Mobile</p>
                <a
                  href={`tel:${supplier.mobile}`}
                  style={{ fontSize: 13, color: '#2d6a4f', fontWeight: 600, textDecoration: 'none' }}
                >
                  {supplier.mobile}
                </a>
              </div>
            </div>

            {supplier.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <MapPin size={16} style={{ color: '#d4a373', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Address</p>
                  <p style={{ fontSize: 13, color: '#2c2c2c', marginTop: 2 }}>{supplier.address}</p>
                </div>
              </div>
            )}

            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase', marginBottom: 4 }}>Material Type</p>
              <p style={{ fontSize: 13, color: '#2c2c2c' }}>{supplier.material_type}</p>
            </div>

            {supplier.rate_offered && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase', marginBottom: 4 }}>Rate Offered</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#2d6a4f' }}>₹{supplier.rate_offered}</p>
              </div>
            )}

            {supplier.gcv_value && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase', marginBottom: 4 }}>GCV Value</p>
                <p style={{ fontSize: 13, color: '#2c2c2c' }}>{supplier.gcv_value}</p>
              </div>
            )}

            {supplier.remarks && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase', marginBottom: 4 }}>Remarks</p>
                <p style={{ fontSize: 13, color: '#2c2c2c' }}>{supplier.remarks}</p>
              </div>
            )}

            {supplier.created_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid #e5ddd0' }}>
                <Calendar size={16} style={{ color: '#b5b8a8', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8', textTransform: 'uppercase' }}>Registered</p>
                  <p style={{ fontSize: 13, color: '#595c4a' }}>
                    {new Date(supplier.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GPS Location Section */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 12 }}>Location</h2>

          {supplier.location_lat && supplier.location_lng ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#fefae0', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8' }}>Latitude</p>
                    <p style={{ fontSize: 13, color: '#2c2c2c', fontFamily: 'monospace', marginTop: 4 }}>{supplier.location_lat.toFixed(6)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#b5b8a8' }}>Longitude</p>
                    <p style={{ fontSize: 13, color: '#2c2c2c', fontFamily: 'monospace', marginTop: 4 }}>{supplier.location_lng.toFixed(6)}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleGetDirections}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fefae0', borderRadius: 8, padding: '10px 0', border: 'none', cursor: 'pointer' }}
              >
                <Navigation size={16} style={{ color: '#d4a373' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#d4a373' }}>Get Directions</span>
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: '#595c4a', marginBottom: 12 }}>No GPS location captured yet</p>
              <button
                onClick={handleGetLocation}
                disabled={gettingLocation}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#2d6a4f', color: 'white', borderRadius: 8, padding: '10px 0', opacity: gettingLocation ? 0.5 : 1, cursor: gettingLocation ? 'not-allowed' : 'pointer', border: 'none' }}
              >
                {gettingLocation ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Getting Location...</span>
                  </>
                ) : (
                  <>
                    <MapPin size={16} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Get Current Location</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Recent Purchases Section */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 12 }}>Recent Purchases</h2>

          {purchases.length === 0 ? (
            <p style={{ fontSize: 13, color: '#595c4a', textAlign: 'center', padding: '16px 0' }}>No purchases yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {purchases.map(purchase => (
                <div key={purchase.id} style={{ background: '#fefae0', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 12, color: '#b5b8a8' }}>
                        {new Date(purchase.purchase_date).toLocaleDateString('en-IN')}
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2c', marginTop: 2 }}>
                        {purchase.material_type}
                      </p>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#2d6a4f' }}>
                      ₹{purchase.amount?.toFixed(2) || '-'}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div>
                      <span style={{ color: '#b5b8a8' }}>Quantity</span>
                      <p style={{ fontWeight: 600, color: '#2c2c2c', marginTop: 2 }}>
                        {purchase.quantity} {purchase.unit || 'units'}
                      </p>
                    </div>
                    <div>
                      <span style={{ color: '#b5b8a8' }}>Rate</span>
                      <p style={{ fontWeight: 600, color: '#2c2c2c', marginTop: 2 }}>
                        ₹{purchase.rate?.toFixed(2) || '-'}
                      </p>
                    </div>
                    <div>
                      <span style={{ color: '#b5b8a8' }}>GCV</span>
                      <p style={{ fontWeight: 600, color: '#2c2c2c', marginTop: 2 }}>
                        {purchase.gcv_value?.toFixed(2) || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Supplier Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Supplier">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Supplier Name *</label>
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

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Material Type *</label>
            <input
              type="text"
              value={editData.material_type}
              onChange={e => setEditData({ ...editData, material_type: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Rate (per unit)</label>
            <input
              type="number"
              value={editData.rate_offered}
              onChange={e => setEditData({ ...editData, rate_offered: e.target.value })}
              step="0.01"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Remarks</label>
            <textarea
              value={editData.remarks}
              onChange={e => setEditData({ ...editData, remarks: e.target.value })}
              rows="3"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', background: '#fefae0', fontSize: 14, outline: 'none', resize: 'none' }}
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
              onClick={handleUpdateSupplier}
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
