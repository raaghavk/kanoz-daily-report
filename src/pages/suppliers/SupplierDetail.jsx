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
      <div className="flex flex-col items-center justify-center" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#1B7A45', marginBottom: 8 }} />
        <p style={{ fontSize: 14, color: '#5A6B62' }}>Loading supplier...</p>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div style={{ padding: '0 16px', paddingTop: 48, paddingBottom: 48 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 32, textAlign: 'center' }}>
          <AlertCircle size={32} className="mx-auto" style={{ color: '#C5CFC8', marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: '#5A6B62' }}>Supplier not found</p>
          <button
            onClick={() => navigate('/suppliers')}
            style={{ marginTop: 16, padding: '8px 16px', background: '#1B7A45', color: 'white', fontSize: 12, fontWeight: 700, borderRadius: 8 }}
          >
            Back to Suppliers
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <PageHeader
        title={supplier.name}
        subtitle="Supplier Details"
        backTo="/suppliers"
        rightAction={
          <button
            onClick={() => setShowEditModal(true)}
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <Edit2 size={16} color="white" />
          </button>
        }
      />

      <div style={{ padding: '0 20px', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Supplier Info Card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 12 }}>Supplier Information</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex items-center gap-3">
              <Phone size={16} className="flex-shrink-0" style={{ color: '#1B7A45' }} />
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8', textTransform: 'uppercase' }}>Mobile</p>
                <a
                  href={`tel:${supplier.mobile}`}
                  style={{ fontSize: 13, color: '#1B7A45', fontWeight: 600, textDecoration: 'none' }}
                >
                  {supplier.mobile}
                </a>
              </div>
            </div>

            {supplier.address && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="flex-shrink-0" style={{ color: '#D4960A', marginTop: 4 }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8', textTransform: 'uppercase' }}>Address</p>
                  <p style={{ fontSize: 13, color: '#1A1A2E', marginTop: 2 }}>{supplier.address}</p>
                </div>
              </div>
            )}

            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8', textTransform: 'uppercase', marginBottom: 4 }}>Material Type</p>
              <p style={{ fontSize: 13, color: '#1A1A2E' }}>{supplier.material_type}</p>
            </div>

            {supplier.rate_offered && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8', textTransform: 'uppercase', marginBottom: 4 }}>Rate Offered</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1B7A45' }}>₹{supplier.rate_offered}</p>
              </div>
            )}

            {supplier.gcv_value && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8', textTransform: 'uppercase', marginBottom: 4 }}>GCV Value</p>
                <p style={{ fontSize: 13, color: '#1A1A2E' }}>{supplier.gcv_value}</p>
              </div>
            )}

            {supplier.remarks && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8', textTransform: 'uppercase', marginBottom: 4 }}>Remarks</p>
                <p style={{ fontSize: 13, color: '#1A1A2E' }}>{supplier.remarks}</p>
              </div>
            )}

            {supplier.created_at && (
              <div className="flex items-center gap-3" style={{ paddingTop: 8, borderTop: '1px solid #E2E8E4' }}>
                <Calendar size={16} className="flex-shrink-0" style={{ color: '#C5CFC8' }} />
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8', textTransform: 'uppercase' }}>Registered</p>
                  <p style={{ fontSize: 13, color: '#5A6B62' }}>
                    {new Date(supplier.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GPS Location Section */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 12 }}>Location</h2>

          {supplier.location_lat && supplier.location_lng ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#F5F7F6', borderRadius: 8, padding: 12 }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8' }}>Latitude</p>
                    <p style={{ fontSize: 13, color: '#1A1A2E', fontFamily: 'monospace', marginTop: 4 }}>{supplier.location_lat.toFixed(6)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#C5CFC8' }}>Longitude</p>
                    <p style={{ fontSize: 13, color: '#1A1A2E', fontFamily: 'monospace', marginTop: 4 }}>{supplier.location_lng.toFixed(6)}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleGetDirections}
                className="w-full flex items-center justify-center gap-2"
                style={{ background: '#FFF8E6', borderRadius: 8, padding: '10px 0' }}
              >
                <Navigation size={16} style={{ color: '#D4960A' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#D4960A' }}>Get Directions</span>
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: '#5A6B62', marginBottom: 12 }}>No GPS location captured yet</p>
              <button
                onClick={handleGetLocation}
                disabled={gettingLocation}
                className="w-full flex items-center justify-center gap-2"
                style={{ background: '#1B7A45', color: 'white', borderRadius: 8, padding: '10px 0', opacity: gettingLocation ? 0.5 : 1, cursor: gettingLocation ? 'not-allowed' : 'pointer' }}
              >
                {gettingLocation ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
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
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 12 }}>Recent Purchases</h2>

          {purchases.length === 0 ? (
            <p style={{ fontSize: 13, color: '#5A6B62', textAlign: 'center', padding: '16px 0' }}>No purchases yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {purchases.map(purchase => (
                <div key={purchase.id} style={{ background: '#F5F7F6', borderRadius: 8, padding: 12 }}>
                  <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 12, color: '#C5CFC8' }}>
                        {new Date(purchase.purchase_date).toLocaleDateString('en-IN')}
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginTop: 2 }}>
                        {purchase.material_type}
                      </p>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1B7A45' }}>
                      ₹{purchase.amount?.toFixed(2) || '-'}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2" style={{ fontSize: 12 }}>
                    <div>
                      <span style={{ color: '#C5CFC8' }}>Quantity</span>
                      <p style={{ fontWeight: 600, color: '#1A1A2E', marginTop: 2 }}>
                        {purchase.quantity} {purchase.unit || 'units'}
                      </p>
                    </div>
                    <div>
                      <span style={{ color: '#C5CFC8' }}>Rate</span>
                      <p style={{ fontWeight: 600, color: '#1A1A2E', marginTop: 2 }}>
                        ₹{purchase.rate?.toFixed(2) || '-'}
                      </p>
                    </div>
                    <div>
                      <span style={{ color: '#C5CFC8' }}>GCV</span>
                      <p style={{ fontWeight: 600, color: '#1A1A2E', marginTop: 2 }}>
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
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Supplier Name *</label>
            <input
              type="text"
              value={editData.name}
              onChange={e => setEditData({ ...editData, name: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Mobile Number *</label>
            <input
              type="tel"
              value={editData.mobile}
              onChange={e => setEditData({ ...editData, mobile: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Address</label>
            <input
              type="text"
              value={editData.address}
              onChange={e => setEditData({ ...editData, address: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Material Type *</label>
            <input
              type="text"
              value={editData.material_type}
              onChange={e => setEditData({ ...editData, material_type: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Rate (per unit)</label>
            <input
              type="number"
              value={editData.rate_offered}
              onChange={e => setEditData({ ...editData, rate_offered: e.target.value })}
              step="0.01"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Remarks</label>
            <textarea
              value={editData.remarks}
              onChange={e => setEditData({ ...editData, remarks: e.target.value })}
              rows="3"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', background: '#F5F7F6', fontSize: 14, outline: 'none', resize: 'none' }}
            />
          </div>

          <div className="flex gap-2" style={{ paddingTop: 8 }}>
            <button
              onClick={() => setShowEditModal(false)}
              style={{ flex: 1, padding: '10px 0', background: '#f3f4f6', color: '#1A1A2E', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateSupplier}
              style={{ flex: 1, padding: '10px 0', background: '#1B7A45', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
