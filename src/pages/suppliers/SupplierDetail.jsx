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
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={32} className="text-kanoz-green animate-spin mb-2" />
        <p className="text-sm text-kanoz-text-secondary">Loading supplier...</p>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="px-4 py-12">
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-8 text-center">
          <AlertCircle size={32} className="mx-auto text-kanoz-text-tertiary mb-2" />
          <p className="text-sm text-kanoz-text-secondary">Supplier not found</p>
          <button
            onClick={() => navigate('/suppliers')}
            className="mt-4 px-4 py-2 bg-kanoz-green text-white text-xs font-bold rounded-lg"
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

      <div className="px-4 mt-4 space-y-4">
        {/* Supplier Info Card */}
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-4">
          <h2 className="text-sm font-bold text-kanoz-text mb-3">Supplier Information</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone size={16} className="text-kanoz-green flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-kanoz-text-tertiary uppercase">Mobile</p>
                <a
                  href={`tel:${supplier.mobile}`}
                  className="text-sm text-kanoz-green font-semibold hover:underline"
                >
                  {supplier.mobile}
                </a>
              </div>
            </div>

            {supplier.address && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-kanoz-accent flex-shrink-0 mt-1" />
                <div>
                  <p className="text-[10px] font-semibold text-kanoz-text-tertiary uppercase">Address</p>
                  <p className="text-sm text-kanoz-text mt-0.5">{supplier.address}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] font-semibold text-kanoz-text-tertiary uppercase mb-1">Material Type</p>
              <p className="text-sm text-kanoz-text">{supplier.material_type}</p>
            </div>

            {supplier.rate_offered && (
              <div>
                <p className="text-[10px] font-semibold text-kanoz-text-tertiary uppercase mb-1">Rate Offered</p>
                <p className="text-sm font-semibold text-kanoz-green">₹{supplier.rate_offered}</p>
              </div>
            )}

            {supplier.gcv_value && (
              <div>
                <p className="text-[10px] font-semibold text-kanoz-text-tertiary uppercase mb-1">GCV Value</p>
                <p className="text-sm text-kanoz-text">{supplier.gcv_value}</p>
              </div>
            )}

            {supplier.remarks && (
              <div>
                <p className="text-[10px] font-semibold text-kanoz-text-tertiary uppercase mb-1">Remarks</p>
                <p className="text-sm text-kanoz-text">{supplier.remarks}</p>
              </div>
            )}

            {supplier.created_at && (
              <div className="flex items-center gap-3 pt-2 border-t border-kanoz-border">
                <Calendar size={16} className="text-kanoz-text-tertiary flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-kanoz-text-tertiary uppercase">Registered</p>
                  <p className="text-sm text-kanoz-text-secondary">
                    {new Date(supplier.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GPS Location Section */}
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-4">
          <h2 className="text-sm font-bold text-kanoz-text mb-3">Location</h2>

          {supplier.location_lat && supplier.location_lng ? (
            <div className="space-y-3">
              <div className="bg-kanoz-bg rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-semibold text-kanoz-text-tertiary">Latitude</p>
                    <p className="text-sm text-kanoz-text font-mono mt-1">{supplier.location_lat.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-kanoz-text-tertiary">Longitude</p>
                    <p className="text-sm text-kanoz-text font-mono mt-1">{supplier.location_lng.toFixed(6)}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleGetDirections}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-kanoz-accent/10 hover:bg-kanoz-accent/20 rounded-lg transition-colors"
              >
                <Navigation size={16} className="text-kanoz-accent" />
                <span className="text-sm font-semibold text-kanoz-accent">Get Directions</span>
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-kanoz-text-secondary mb-3">No GPS location captured yet</p>
              <button
                onClick={handleGetLocation}
                disabled={gettingLocation}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-kanoz-green text-white rounded-lg hover:bg-kanoz-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gettingLocation ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm font-semibold">Getting Location...</span>
                  </>
                ) : (
                  <>
                    <MapPin size={16} />
                    <span className="text-sm font-semibold">Get Current Location</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Recent Purchases Section */}
        <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-4">
          <h2 className="text-sm font-bold text-kanoz-text mb-3">Recent Purchases</h2>

          {purchases.length === 0 ? (
            <p className="text-sm text-kanoz-text-secondary text-center py-4">No purchases yet</p>
          ) : (
            <div className="space-y-2">
              {purchases.map(purchase => (
                <div key={purchase.id} className="bg-kanoz-bg rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-kanoz-text-tertiary">
                        {new Date(purchase.purchase_date).toLocaleDateString('en-IN')}
                      </p>
                      <p className="text-sm font-semibold text-kanoz-text mt-0.5">
                        {purchase.material_type}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-kanoz-green">
                      ₹{purchase.amount?.toFixed(2) || '-'}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-kanoz-text-tertiary">Quantity</span>
                      <p className="font-semibold text-kanoz-text mt-0.5">
                        {purchase.quantity} {purchase.unit || 'units'}
                      </p>
                    </div>
                    <div>
                      <span className="text-kanoz-text-tertiary">Rate</span>
                      <p className="font-semibold text-kanoz-text mt-0.5">
                        ₹{purchase.rate?.toFixed(2) || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-kanoz-text-tertiary">GCV</span>
                      <p className="font-semibold text-kanoz-text mt-0.5">
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
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Supplier Name *</label>
            <input
              type="text"
              value={editData.name}
              onChange={e => setEditData({ ...editData, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Mobile Number *</label>
            <input
              type="tel"
              value={editData.mobile}
              onChange={e => setEditData({ ...editData, mobile: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Address</label>
            <input
              type="text"
              value={editData.address}
              onChange={e => setEditData({ ...editData, address: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Material Type *</label>
            <input
              type="text"
              value={editData.material_type}
              onChange={e => setEditData({ ...editData, material_type: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Rate (per unit)</label>
            <input
              type="number"
              value={editData.rate_offered}
              onChange={e => setEditData({ ...editData, rate_offered: e.target.value })}
              step="0.01"
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Remarks</label>
            <textarea
              value={editData.remarks}
              onChange={e => setEditData({ ...editData, remarks: e.target.value })}
              rows="3"
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border bg-kanoz-bg text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowEditModal(false)}
              className="flex-1 py-2.5 bg-gray-100 text-kanoz-text rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateSupplier}
              className="flex-1 py-2.5 bg-kanoz-green text-white rounded-lg text-sm font-semibold hover:bg-kanoz-green/90 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
