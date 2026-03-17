import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import PhotoUpload from '../../components/PhotoUpload'
import { sanitizeText, sanitizeNumber } from '../../lib/sanitize'

export default function PurchaseForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { plant, employee } = useAuth()
  const queryClient = useQueryClient()

  const [saving, setSaving] = useState(false)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [scanning, setScanning] = useState(false)

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    purchase_time: new Date().toTimeString().slice(0, 5),
    supplier_id: '',
    raw_material_type_id: '',
    vehicle_number: '',
    vehicle_type: 'company',
    net_weight: '',
    moisture_percentage: '',
    deduction_kg: '',
    final_quantity: '',
    rate_per_kg: '',
    rm_amount: '',
    loading_charges: 0,
    unloading_charges: 0,
    transport_charges: 0,
    total_amount: '',
    average_cost_per_kg: '',
    katta_parchi_photo: null,
    payment_status: 'Pending',
    remarks: '',
  })

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    mobile: '',
    raw_material_type_id: '',
    rate_offered: '',
    address: '',
    remarks: '',
    location_lat: null,
    location_lng: null,
  })
  const [fetchingLocation, setFetchingLocation] = useState(false)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', plant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*').eq('plant_id', plant.id).order('name')
      if (error) throw error
      return data || []
    },
    enabled: !!plant?.id,
  })

  const { data: companyVehicles = [] } = useQuery({
    queryKey: ['companyVehicles', plant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').eq('plant_id', plant.id).eq('type', 'company').eq('is_active', true).order('number')
      if (error) throw error
      return data || []
    },
    enabled: !!plant?.id,
  })

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['rawMaterials', plant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('raw_material_types').select('*').eq('plant_id', plant.id).order('name')
      if (error) throw error
      return data || []
    },
    enabled: !!plant?.id,
  })

  const { data: purchaseData, isLoading: loading, isError } = useQuery({
    queryKey: ['purchase', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('raw_material_purchases').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id && !!plant?.id,
  })

  useEffect(() => {
    if (!purchaseData) return
    setFormData({
      date: purchaseData.date || new Date().toISOString().split('T')[0],
      purchase_time: purchaseData.purchase_time || '',
      supplier_id: purchaseData.supplier_id || '',
      raw_material_type_id: purchaseData.raw_material_type_id || '',
      vehicle_number: purchaseData.vehicle_number || '',
      vehicle_type: 'company',
      net_weight: purchaseData.net_weight ?? '',
      moisture_percentage: purchaseData.moisture_percent ?? '',
      deduction_kg: purchaseData.deduction_kg ?? '',
      final_quantity: purchaseData.final_quantity ?? '',
      rate_per_kg: purchaseData.rate_per_kg ?? '',
      rm_amount: purchaseData.rm_amount ?? '',
      loading_charges: purchaseData.loading_charges ?? 0,
      unloading_charges: purchaseData.unloading_charges ?? 0,
      transport_charges: purchaseData.transport_charges ?? 0,
      total_amount: purchaseData.total_amount ?? '',
      average_cost_per_kg: purchaseData.average_cost_per_kg ?? '',
      katta_parchi_photo: purchaseData.katta_parchi_photo || null,
      payment_status: purchaseData.payment_status || 'Pending',
      remarks: purchaseData.remarks || '',
    })
  }, [purchaseData])

  function handleFieldChange(field, value) {
    const updated = { ...formData, [field]: value }
    updateCalculatedFields(updated)
    setFormData(updated)
  }

  async function scanKattaParchi() {
    if (!formData.katta_parchi_photo) return
    try {
      setScanning(true)
      const { data: result, error } = await supabase.functions.invoke('extract-receipt', {
        body: { imageUrl: formData.katta_parchi_photo, type: 'katta_parchi' }
      })

      if (error) {
        showToast('Could not extract data from photo', 'error')
        return
      }

      if (result?.success) {
        const updated = { ...formData }
        if (result.data?.vehicle_number) {
          updated.vehicle_number = result.data.vehicle_number
        }
        if (result.data?.net_weight) {
          updated.net_weight = result.data.net_weight
        }
        if (result.data?.time) {
          updated.purchase_time = result.data.time
        }
        updateCalculatedFields(updated)
        setFormData(updated)
        showToast('Fields auto-filled from photo', 'success')
      } else {
        showToast('Could not extract data from photo', 'error')
      }
    } catch (err) {
      console.error('Error scanning photo:', err)
      showToast('Could not extract data from photo', 'error')
    } finally {
      setScanning(false)
    }
  }

  function updateCalculatedFields(data) {
    const net = parseFloat(data.net_weight) || 0
    const moisture = parseFloat(data.moisture_percentage) || 0
    const deduction = (net * moisture) / 100
    const finalQty = net - deduction
    const rate = parseFloat(data.rate_per_kg) || 0
    const rmAmount = finalQty * rate
    const loading = parseFloat(data.loading_charges) || 0
    const unloading = parseFloat(data.unloading_charges) || 0
    const transport = parseFloat(data.transport_charges) || 0
    const totalAmount = rmAmount + loading + unloading + transport
    const avgCost = finalQty > 0 ? totalAmount / finalQty : 0

    data.deduction_kg = deduction > 0 ? deduction.toFixed(2) : ''
    data.final_quantity = finalQty > 0 ? finalQty.toFixed(2) : ''
    data.rm_amount = rmAmount > 0 ? rmAmount.toFixed(2) : ''
    data.total_amount = totalAmount > 0 ? totalAmount.toFixed(2) : ''
    data.average_cost_per_kg = avgCost > 0 ? avgCost.toFixed(2) : ''
  }

  function fetchSupplierLocation() {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported by your browser', 'error')
      return
    }
    setFetchingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSupplierForm(prev => ({
          ...prev,
          location_lat: position.coords.latitude,
          location_lng: position.coords.longitude,
        }))
        setFetchingLocation(false)
        showToast('Location captured', 'success')
      },
      () => {
        setFetchingLocation(false)
        showToast('Failed to get location. Please allow location access.', 'error')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function addNewSupplier() {
    try {
      if (!supplierForm.name.trim()) {
        showToast('Supplier name is required', 'error')
        return
      }
      if (!supplierForm.mobile.trim()) {
        showToast('Supplier phone is required', 'error')
        return
      }
      if (!supplierForm.raw_material_type_id) {
        showToast('Raw material type is required', 'error')
        return
      }

      const supplierData = {
        plant_id: plant?.id,
        name: supplierForm.name.trim(),
        mobile: supplierForm.mobile.trim(),
        raw_material_type_id: supplierForm.raw_material_type_id,
        rate_offered: supplierForm.rate_offered ? parseFloat(supplierForm.rate_offered) : null,
        address: supplierForm.address || null,
        remarks: supplierForm.remarks || null,
        location_lat: supplierForm.location_lat,
        location_lng: supplierForm.location_lng,
      }

      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplierData])
        .select()
        .single()

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['suppliers', plant?.id] })
      handleFieldChange('supplier_id', data.id)
      if (supplierForm.raw_material_type_id) {
        handleFieldChange('raw_material_type_id', supplierForm.raw_material_type_id)
      }
      setShowAddSupplier(false)
      setSupplierForm({
        name: '',
        mobile: '',
        raw_material_type_id: '',
        rate_offered: '',
        address: '',
        remarks: '',
        location_lat: null,
        location_lng: null,
      })
      showToast('Supplier added successfully', 'success')
    } catch (err) {
      console.error('Error adding supplier:', err)
      showToast('Failed to add supplier', 'error')
    }
  }

  async function savePurchase() {
    if (saving) return
    try {
      if (!formData.supplier_id || !formData.raw_material_type_id || !formData.net_weight) {
        showToast('Please fill in all required fields', 'error')
        return
      }
      if (!formData.katta_parchi_photo) {
        showToast('Weight bridge photo is mandatory', 'error')
        return
      }

      setSaving(true)

      const purchaseData = {
        plant_id: plant?.id,
        employee_id: employee?.id,
        date: formData.date,
        purchase_time: formData.purchase_time || null,
        supplier_id: formData.supplier_id,
        raw_material_type_id: formData.raw_material_type_id,
        vehicle_number: sanitizeText(formData.vehicle_number, 20) || null,
        net_weight: sanitizeNumber(formData.net_weight),
        moisture_percent: sanitizeNumber(formData.moisture_percentage) || null,
        deduction_kg: sanitizeNumber(formData.deduction_kg) || null,
        final_quantity: sanitizeNumber(formData.final_quantity),
        rate_per_kg: sanitizeNumber(formData.rate_per_kg) || null,
        rm_amount: sanitizeNumber(formData.rm_amount) || null,
        loading_charges: sanitizeNumber(formData.loading_charges),
        unloading_charges: sanitizeNumber(formData.unloading_charges),
        transport_charges: sanitizeNumber(formData.transport_charges),
        total_amount: sanitizeNumber(formData.total_amount) || null,
        average_cost_per_kg: sanitizeNumber(formData.average_cost_per_kg) || null,
        katta_parchi_photo: formData.katta_parchi_photo,
        payment_status: formData.payment_status,
        remarks: sanitizeText(formData.remarks, 500) || null,
      }

      if (id) {
        const { error } = await supabase
          .from('raw_material_purchases')
          .update(purchaseData)
          .eq('id', id)

        if (error) throw error
        showToast('Purchase updated successfully', 'success')
      } else {
        const { error } = await supabase
          .from('raw_material_purchases')
          .insert([purchaseData])

        if (error) throw error
        showToast('Purchase saved successfully', 'success')
      }

      if (id) queryClient.invalidateQueries({ queryKey: ['purchase', id] })
      navigate(id ? `/purchase/${id}` : '/purchase')
    } catch (err) {
      console.error('Error saving purchase:', err)
      showToast('Failed to save purchase', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (id && isError) {
    return (
      <div style={{ minHeight: '100vh', background: '#fefae0' }}>
        <PageHeader title="Error" backTo="/purchase" />
        <div style={{ padding: 24, textAlign: 'center', color: '#d32f2f' }}>
          Failed to load purchase. Please go back and try again.
        </div>
      </div>
    )
  }

  if (loading || (id && !purchaseData)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Loader2 size={40} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fefae0', paddingBottom: 80 }}>
      <PageHeader title={id ? 'Edit Purchase' : 'New Purchase'} subtitle="Raw Material Purchase Entry" backTo="/purchase" />

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #e5ddd0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>
                Date <span style={{ color: '#d32f2f' }}>*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={e => handleFieldChange('date', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>Time</label>
              <input
                type="time"
                value={formData.purchase_time}
                onChange={e => handleFieldChange('purchase_time', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #e5ddd0' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>
            Supplier <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={formData.supplier_id}
              onChange={e => {
                const supplierId = e.target.value
                handleFieldChange('supplier_id', supplierId)
                // Auto-fill raw material type from supplier
                const selectedSupplier = suppliers.find(s => s.id === supplierId)
                if (selectedSupplier?.raw_material_type_id) {
                  handleFieldChange('raw_material_type_id', selectedSupplier.raw_material_type_id)
                }
              }}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0' }}
            >
              <option value="">Select supplier...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowAddSupplier(true)}
              style={{ padding: '10px 12px', background: '#2d6a4f', color: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, border: 'none', cursor: 'pointer' }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #e5ddd0' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>
            Raw Material Type <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <select
            value={formData.raw_material_type_id}
            onChange={e => handleFieldChange('raw_material_type_id', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0' }}
          >
            <option value="">Select type...</option>
            {rawMaterials.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #e5ddd0' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>Vehicle Type</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => handleFieldChange('vehicle_type', 'company')}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                border: '1.5px solid',
                borderColor: formData.vehicle_type === 'company' ? '#2d6a4f' : '#e5ddd0',
                background: formData.vehicle_type === 'company' ? '#e8f0ec' : '#fff',
                color: formData.vehicle_type === 'company' ? '#2d6a4f' : '#595c4a',
                cursor: 'pointer',
              }}
            >
              Company Owned
            </button>
            <button
              type="button"
              onClick={() => handleFieldChange('vehicle_type', 'other')}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                border: '1.5px solid',
                borderColor: formData.vehicle_type === 'other' ? '#2d6a4f' : '#e5ddd0',
                background: formData.vehicle_type === 'other' ? '#e8f0ec' : '#fff',
                color: formData.vehicle_type === 'other' ? '#2d6a4f' : '#595c4a',
                cursor: 'pointer',
              }}
            >
              Other Vehicle
            </button>
          </div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>Vehicle Number</label>
          {formData.vehicle_type === 'company' && companyVehicles.length > 0 ? (
            <select
              value={formData.vehicle_number}
              onChange={e => handleFieldChange('vehicle_number', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
            >
              <option value="">Select vehicle...</option>
              {companyVehicles.map(v => (
                <option key={v.id} value={v.number}>{v.number}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="e.g., HR-01-AB-1234"
              value={formData.vehicle_number}
              onChange={e => handleFieldChange('vehicle_number', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
            />
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #e5ddd0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 16 }}>Weight Details</h3>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>
              Net Weight (kg) <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="Enter net weight"
              value={formData.net_weight}
              onChange={e => handleFieldChange('net_weight', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0' }}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <PhotoUpload
              label="Weight Bridge Photo"
              required
              value={formData.katta_parchi_photo}
              onChange={file => handleFieldChange('katta_parchi_photo', file)}
              folder="purchases"
            />
            <div style={{ fontSize: 10, color: '#d32f2f', marginTop: 4 }}>* Weight bridge photo is mandatory</div>
            {formData.katta_parchi_photo && (
              <button
                type="button"
                onClick={scanKattaParchi}
                disabled={scanning}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: '12px 16px',
                  background: '#FEF3C7',
                  color: '#92400E',
                  border: '1.5px solid #F59E0B',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  opacity: scanning ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Sparkles size={18} />
                {scanning ? 'Scanning...' : '✨ Auto-fill from Photo'}
              </button>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #e5ddd0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 16 }}>Moisture & Deduction</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>Moisture %</label>
              <input
                type="number"
                step="0.01"
                value={formData.moisture_percentage}
                onChange={e => handleFieldChange('moisture_percentage', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>Deduction (kg)</label>
              <input
                type="number"
                disabled
                value={formData.deduction_kg}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', background: '#fefae0', opacity: 0.6, cursor: 'not-allowed', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 10, color: '#b5b8a8', marginTop: 4 }}>Auto-calculated</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>
              Final Quantity (kg) <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <input
              type="number"
              disabled
              value={formData.final_quantity}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', background: '#fefae0', opacity: 0.6, cursor: 'not-allowed', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 10, color: '#b5b8a8', marginTop: 4 }}>Auto-calculated</div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #e5ddd0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 16 }}>Pricing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>
                Rate per kg (₹) <span style={{ color: '#d32f2f' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.rate_per_kg}
                onChange={e => handleFieldChange('rate_per_kg', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>RM Amount (₹)</label>
              <input
                type="number"
                disabled
                value={formData.rm_amount}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', background: '#fefae0', opacity: 0.6, cursor: 'not-allowed', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 10, color: '#b5b8a8', marginTop: 4 }}>Auto-calculated</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #e5ddd0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 16 }}>Charges</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>Loading (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.loading_charges}
                onChange={e => handleFieldChange('loading_charges', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>Unloading (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.unloading_charges}
                onChange={e => handleFieldChange('unloading_charges', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>Transport (₹)</label>
            <input
              type="number"
              step="0.01"
              value={formData.transport_charges}
              onChange={e => handleFieldChange('transport_charges', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #e5ddd0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 16 }}>Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e5ddd0' }}>
              <span style={{ fontSize: 13, color: '#595c4a' }}>RM Amount</span>
              <span style={{ fontWeight: 700, color: '#2c2c2c' }}>₹{(parseFloat(formData.rm_amount) || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e5ddd0' }}>
              <span style={{ fontSize: 13, color: '#595c4a' }}>Total Charges</span>
              <span style={{ fontWeight: 700, color: '#2c2c2c' }}>₹{((parseFloat(formData.loading_charges) || 0) + (parseFloat(formData.unloading_charges) || 0) + (parseFloat(formData.transport_charges) || 0)).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#e8f0ec', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>Total Amount</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#2d6a4f' }}>₹{(parseFloat(formData.total_amount) || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <span style={{ fontSize: 13, color: '#595c4a' }}>Avg Cost per kg</span>
              <span style={{ fontWeight: 700, color: '#2c2c2c' }}>₹{(parseFloat(formData.average_cost_per_kg) || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #e5ddd0' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>
              Payment Status <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <select
              value={formData.payment_status}
              onChange={e => handleFieldChange('payment_status', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0' }}
            >
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #e5ddd0' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 8 }}>Remarks</label>
          <textarea
            value={formData.remarks}
            onChange={e => handleFieldChange('remarks', e.target.value)}
            placeholder="Add any additional notes..."
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', resize: 'none' }}
          />
        </div>

        <button
          onClick={savePurchase}
          disabled={saving}
          style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#2d6a4f', color: 'white', fontWeight: 700, fontSize: 16, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none' }}
        >
          {saving && <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />}
          {saving ? 'Saving...' : id ? 'Update Purchase' : 'Save Purchase'}
        </button>
      </div>

      <Modal isOpen={showAddSupplier} onClose={() => setShowAddSupplier(false)} title="Add New Supplier">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
              Name <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Supplier name"
              value={supplierForm.name}
              onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
              Phone <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <input
              type="tel"
              placeholder="Phone number"
              value={supplierForm.mobile}
              onChange={e => setSupplierForm({ ...supplierForm, mobile: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
              Raw Material Type <span style={{ color: '#d32f2f' }}>*</span>
            </label>
            <select
              value={supplierForm.raw_material_type_id}
              onChange={e => setSupplierForm({ ...supplierForm, raw_material_type_id: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0' }}
            >
              <option value="">Select type...</option>
              {rawMaterials.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Rate Offered (₹/kg)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={supplierForm.rate_offered}
              onChange={e => setSupplierForm({ ...supplierForm, rate_offered: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Address</label>
            <textarea
              placeholder="Supplier address"
              value={supplierForm.address}
              onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', resize: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Remarks</label>
            <textarea
              placeholder="Additional notes"
              value={supplierForm.remarks}
              onChange={e => setSupplierForm({ ...supplierForm, remarks: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', resize: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>Geolocation</label>
            <button
              type="button"
              onClick={fetchSupplierLocation}
              disabled={fetchingLocation}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 12,
                border: '1.5px solid #e5ddd0', fontSize: 13, fontWeight: 600,
                background: supplierForm.location_lat ? '#e8f0ec' : '#fefae0',
                color: supplierForm.location_lat ? '#2d6a4f' : '#595c4a',
                cursor: fetchingLocation ? 'not-allowed' : 'pointer',
                opacity: fetchingLocation ? 0.6 : 1,
              }}
            >
              {fetchingLocation ? 'Fetching location...' : supplierForm.location_lat ? `Location captured (${supplierForm.location_lat.toFixed(4)}, ${supplierForm.location_lng.toFixed(4)})` : 'Capture Current Location'}
            </button>
          </div>

          <button
            onClick={addNewSupplier}
            style={{ width: '100%', padding: '12px 0', borderRadius: 14, background: '#2d6a4f', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            Add Supplier
          </button>
        </div>
      </Modal>
    </div>
  )
}
