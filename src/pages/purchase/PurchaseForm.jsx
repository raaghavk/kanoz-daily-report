import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import PhotoUpload from '../../components/PhotoUpload'

export default function PurchaseForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { plant, employee } = useAuth()

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [showAddSupplier, setShowAddSupplier] = useState(false)

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    raw_material_type_id: '',
    vehicle_number: '',
    gross_weight: '',
    tare_weight: '',
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
  })

  useEffect(() => {
    if (plant?.id) {
      fetchSuppliers()
      fetchRawMaterials()
      if (id) {
        fetchPurchase(id)
      }
    }
  }, [plant?.id, id])

  async function fetchSuppliers() {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('plant_id', plant?.id)
        .order('name')

      if (error) throw error
      setSuppliers(data || [])
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    }
  }

  async function fetchRawMaterials() {
    try {
      const { data, error } = await supabase
        .from('raw_material_types')
        .select('*')
        .eq('plant_id', plant?.id)
        .order('name')

      if (error) throw error
      setRawMaterials(data || [])
    } catch (err) {
      console.error('Error fetching raw materials:', err)
    }
  }

  async function fetchPurchase(purchaseId) {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('rm_purchases')
        .select('*')
        .eq('id', purchaseId)
        .single()

      if (error) throw error

      setFormData({
        date: data.date || formData.date,
        supplier_id: data.supplier_id || '',
        raw_material_type_id: data.raw_material_type_id || '',
        vehicle_number: data.vehicle_number || '',
        gross_weight: data.gross_weight || '',
        tare_weight: data.tare_weight || '',
        net_weight: data.net_weight || '',
        moisture_percentage: data.moisture_percentage || '',
        deduction_kg: data.deduction_kg || '',
        final_quantity: data.final_quantity || '',
        rate_per_kg: data.rate_per_kg || '',
        rm_amount: data.rm_amount || '',
        loading_charges: data.loading_charges || 0,
        unloading_charges: data.unloading_charges || 0,
        transport_charges: data.transport_charges || 0,
        total_amount: data.total_amount || '',
        average_cost_per_kg: data.average_cost_per_kg || '',
        katta_parchi_photo: data.katta_parchi_photo || null,
        payment_status: data.payment_status || 'Pending',
        remarks: data.remarks || '',
      })
    } catch (err) {
      console.error('Error fetching purchase:', err)
      showToast('Failed to load purchase', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleFieldChange(field, value) {
    const updated = { ...formData, [field]: value }
    updateCalculatedFields(updated)
    setFormData(updated)
  }

  function updateCalculatedFields(data) {
    const gross = parseFloat(data.gross_weight) || 0
    const tare = parseFloat(data.tare_weight) || 0
    const net = gross - tare
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

    data.net_weight = net > 0 ? net.toFixed(2) : ''
    data.deduction_kg = deduction > 0 ? deduction.toFixed(2) : ''
    data.final_quantity = finalQty > 0 ? finalQty.toFixed(2) : ''
    data.rm_amount = rmAmount > 0 ? rmAmount.toFixed(2) : ''
    data.total_amount = totalAmount > 0 ? totalAmount.toFixed(2) : ''
    data.average_cost_per_kg = avgCost > 0 ? avgCost.toFixed(2) : ''
  }

  async function addNewSupplier() {
    try {
      if (!supplierForm.name.trim()) {
        showToast('Supplier name is required', 'error')
        return
      }

      const supplierData = {
        plant_id: plant?.id,
        name: supplierForm.name.trim(),
        mobile: supplierForm.mobile || null,
        raw_material_type_id: supplierForm.raw_material_type_id || null,
        rate_offered: supplierForm.rate_offered ? parseFloat(supplierForm.rate_offered) : null,
        address: supplierForm.address || null,
        remarks: supplierForm.remarks || null,
      }

      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplierData])
        .select()
        .single()

      if (error) throw error

      setSuppliers([...suppliers, data])
      handleFieldChange('supplier_id', data.id)
      setShowAddSupplier(false)
      setSupplierForm({
        name: '',
        mobile: '',
        raw_material_type_id: '',
        rate_offered: '',
        address: '',
        remarks: '',
      })
      showToast('Supplier added successfully', 'success')
    } catch (err) {
      console.error('Error adding supplier:', err)
      showToast('Failed to add supplier', 'error')
    }
  }

  async function savePurchase() {
    try {
      if (!formData.supplier_id || !formData.raw_material_type_id || !formData.final_quantity) {
        showToast('Please fill in all required fields', 'error')
        return
      }

      setSaving(true)

      const purchaseData = {
        plant_id: plant?.id,
        employee_id: employee?.id,
        date: formData.date,
        supplier_id: formData.supplier_id,
        raw_material_type_id: formData.raw_material_type_id,
        vehicle_number: formData.vehicle_number || null,
        gross_weight: parseFloat(formData.gross_weight) || null,
        tare_weight: parseFloat(formData.tare_weight) || null,
        net_weight: parseFloat(formData.net_weight) || null,
        moisture_percentage: parseFloat(formData.moisture_percentage) || null,
        deduction_kg: parseFloat(formData.deduction_kg) || null,
        final_quantity: parseFloat(formData.final_quantity),
        rate_per_kg: parseFloat(formData.rate_per_kg) || null,
        rm_amount: parseFloat(formData.rm_amount) || null,
        loading_charges: parseFloat(formData.loading_charges) || 0,
        unloading_charges: parseFloat(formData.unloading_charges) || 0,
        transport_charges: parseFloat(formData.transport_charges) || 0,
        total_amount: parseFloat(formData.total_amount) || null,
        average_cost_per_kg: parseFloat(formData.average_cost_per_kg) || null,
        katta_parchi_photo: formData.katta_parchi_photo,
        payment_status: formData.payment_status,
        remarks: formData.remarks || null,
      }

      let result
      if (id) {
        const { error } = await supabase
          .from('rm_purchases')
          .update(purchaseData)
          .eq('id', id)

        if (error) throw error
        showToast('Purchase updated successfully', 'success')
      } else {
        const { error } = await supabase
          .from('rm_purchases')
          .insert([purchaseData])

        if (error) throw error
        showToast('Purchase saved successfully', 'success')
      }

      navigate('/purchase')
    } catch (err) {
      console.error('Error saving purchase:', err)
      showToast('Failed to save purchase', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <Loader2 size={40} className="animate-spin" style={{ color: '#1B7A45' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7F6', paddingBottom: 80 }}>
      <PageHeader title={id ? 'Edit Purchase' : 'New Purchase'} subtitle="Raw Material Purchase Entry" backTo="/purchase" />

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #E2E8E4' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>
            Date <span style={{ color: '#E53E3E' }}>*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={e => handleFieldChange('date', e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #E2E8E4' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>
              Supplier <span style={{ color: '#E53E3E' }}>*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={formData.supplier_id}
                onChange={e => handleFieldChange('supplier_id', e.target.value)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowAddSupplier(true)}
                style={{ padding: '10px 12px', background: '#1B7A45', color: 'white', borderRadius: 8 }}
                className="flex items-center gap-1"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #E2E8E4' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>
              Raw Material Type <span style={{ color: '#E53E3E' }}>*</span>
            </label>
            <select
              value={formData.raw_material_type_id}
              onChange={e => handleFieldChange('raw_material_type_id', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
            >
              <option value="">Select type...</option>
              {rawMaterials.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #E2E8E4' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>Vehicle Number</label>
            <input
              type="text"
              placeholder="e.g., HR-01-AB-1234"
              value={formData.vehicle_number}
              onChange={e => handleFieldChange('vehicle_number', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
            />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #E2E8E4' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 16 }}>Weight Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>
                Gross Weight (kg) <span style={{ color: '#E53E3E' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.gross_weight}
                onChange={e => handleFieldChange('gross_weight', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>
                Tare Weight (kg) <span style={{ color: '#E53E3E' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.tare_weight}
                onChange={e => handleFieldChange('tare_weight', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>Net Weight (kg)</label>
              <input
                type="number"
                disabled
                value={formData.net_weight}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', background: '#F5F7F6', opacity: 0.6, cursor: 'not-allowed' }}
              />
              <div style={{ fontSize: 10, color: '#C5CFC8', marginTop: 4 }}>Auto-calculated</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #E2E8E4' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 16 }}>Moisture & Deduction</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>Moisture %</label>
              <input
                type="number"
                step="0.01"
                value={formData.moisture_percentage}
                onChange={e => handleFieldChange('moisture_percentage', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>Deduction (kg)</label>
              <input
                type="number"
                disabled
                value={formData.deduction_kg}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', background: '#F5F7F6', opacity: 0.6, cursor: 'not-allowed' }}
              />
              <div style={{ fontSize: 10, color: '#C5CFC8', marginTop: 4 }}>Auto-calculated</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>
                Final Quantity (kg) <span style={{ color: '#E53E3E' }}>*</span>
              </label>
              <input
                type="number"
                disabled
                value={formData.final_quantity}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', background: '#F5F7F6', opacity: 0.6, cursor: 'not-allowed' }}
              />
              <div style={{ fontSize: 10, color: '#C5CFC8', marginTop: 4 }}>Auto-calculated</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #E2E8E4' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 16 }}>Pricing</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>
                Rate per kg (₹) <span style={{ color: '#E53E3E' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.rate_per_kg}
                onChange={e => handleFieldChange('rate_per_kg', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>RM Amount (₹)</label>
              <input
                type="number"
                disabled
                value={formData.rm_amount}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', background: '#F5F7F6', opacity: 0.6, cursor: 'not-allowed' }}
              />
              <div style={{ fontSize: 10, color: '#C5CFC8', marginTop: 4 }}>Auto-calculated</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #E2E8E4' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 16 }}>Charges</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>Loading (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.loading_charges}
                onChange={e => handleFieldChange('loading_charges', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>Unloading (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.unloading_charges}
                onChange={e => handleFieldChange('unloading_charges', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>Transport (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.transport_charges}
                onChange={e => handleFieldChange('transport_charges', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
              />
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1.5px solid #E2E8E4' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 16 }}>Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="flex justify-between items-center" style={{ padding: '10px 0', borderBottom: '1px solid #E2E8E4' }}>
              <span style={{ fontSize: 13, color: '#5A6B62' }}>RM Amount</span>
              <span style={{ fontWeight: 700, color: '#1A1A2E' }}>₹{(parseFloat(formData.rm_amount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center" style={{ padding: '10px 0', borderBottom: '1px solid #E2E8E4' }}>
              <span style={{ fontSize: 13, color: '#5A6B62' }}>Total Charges</span>
              <span style={{ fontWeight: 700, color: '#1A1A2E' }}>₹{((parseFloat(formData.loading_charges) || 0) + (parseFloat(formData.unloading_charges) || 0) + (parseFloat(formData.transport_charges) || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center" style={{ padding: '12px', background: '#E8F5EE', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>Total Amount</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#1B7A45' }}>₹{(parseFloat(formData.total_amount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center" style={{ padding: '10px 0' }}>
              <span style={{ fontSize: 13, color: '#5A6B62' }}>Avg Cost per kg</span>
              <span style={{ fontWeight: 700, color: '#1A1A2E' }}>₹{(parseFloat(formData.average_cost_per_kg) || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #E2E8E4' }}>
          <PhotoUpload
            label="Katta Parchi Photo"
            value={formData.katta_parchi_photo}
            onChange={file => handleFieldChange('katta_parchi_photo', file)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #E2E8E4' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>
              Payment Status <span style={{ color: '#E53E3E' }}>*</span>
            </label>
            <select
              value={formData.payment_status}
              onChange={e => handleFieldChange('payment_status', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
            >
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #E2E8E4' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 8 }}>Remarks</label>
          <textarea
            value={formData.remarks}
            onChange={e => handleFieldChange('remarks', e.target.value)}
            placeholder="Add any additional notes..."
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6', resize: 'none' }}
          />
        </div>

        <button
          onClick={savePurchase}
          disabled={saving}
          className="flex items-center justify-center gap-2"
          style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#1B7A45', color: 'white', fontWeight: 700, fontSize: 16, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving && <Loader2 size={20} className="animate-spin" />}
          {saving ? 'Saving...' : id ? 'Update Purchase' : 'Save Purchase'}
        </button>
      </div>

      <Modal isOpen={showAddSupplier} onClose={() => setShowAddSupplier(false)} title="Add New Supplier">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>
              Name <span style={{ color: '#E53E3E' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Supplier name"
              value={supplierForm.name}
              onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Mobile</label>
            <input
              type="tel"
              placeholder="Phone number"
              value={supplierForm.mobile}
              onChange={e => setSupplierForm({ ...supplierForm, mobile: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Raw Material Type</label>
            <select
              value={supplierForm.raw_material_type_id}
              onChange={e => setSupplierForm({ ...supplierForm, raw_material_type_id: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
            >
              <option value="">Select type (optional)</option>
              {rawMaterials.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Rate Offered (₹/kg)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={supplierForm.rate_offered}
              onChange={e => setSupplierForm({ ...supplierForm, rate_offered: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Address</label>
            <textarea
              placeholder="Supplier address"
              value={supplierForm.address}
              onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6', resize: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A9B92', marginBottom: 6 }}>Remarks</label>
            <textarea
              placeholder="Additional notes"
              value={supplierForm.remarks}
              onChange={e => setSupplierForm({ ...supplierForm, remarks: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E2E8E4', fontSize: 14, color: '#1A1A2E', outline: 'none', background: '#F5F7F6', resize: 'none' }}
            />
          </div>

          <button
            onClick={addNewSupplier}
            style={{ width: '100%', padding: '12px 0', borderRadius: 14, background: '#1B7A45', color: 'white', fontWeight: 700 }}
          >
            Add Supplier
          </button>
        </div>
      </Modal>
    </div>
  )
}
