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
      <div className="min-h-screen bg-kanoz-bg flex items-center justify-center">
        <Loader2 size={40} className="text-kanoz-green animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-kanoz-bg pb-20">
      <PageHeader title={id ? 'Edit Purchase' : 'New Purchase'} subtitle="Raw Material Purchase Entry" backTo="/purchase" />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-kanoz-card rounded-xl p-4 border border-kanoz-border">
          <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">
            Date <span className="text-kanoz-red">*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={e => handleFieldChange('date', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-kanoz-card rounded-xl p-4 border border-kanoz-border">
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">
              Supplier <span className="text-kanoz-red">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={formData.supplier_id}
                onChange={e => handleFieldChange('supplier_id', e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowAddSupplier(true)}
                className="px-3 py-2.5 bg-kanoz-green text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="bg-kanoz-card rounded-xl p-4 border border-kanoz-border">
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">
              Raw Material Type <span className="text-kanoz-red">*</span>
            </label>
            <select
              value={formData.raw_material_type_id}
              onChange={e => handleFieldChange('raw_material_type_id', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
            >
              <option value="">Select type...</option>
              {rawMaterials.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-kanoz-card rounded-xl p-4 border border-kanoz-border">
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">Vehicle Number</label>
            <input
              type="text"
              placeholder="e.g., HR-01-AB-1234"
              value={formData.vehicle_number}
              onChange={e => handleFieldChange('vehicle_number', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg placeholder-kanoz-text-tertiary"
            />
          </div>
        </div>

        <div className="bg-kanoz-card rounded-xl p-5 border border-kanoz-border">
          <h3 className="text-sm font-bold text-kanoz-text mb-4">Weight Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">
                Gross Weight (kg) <span className="text-kanoz-red">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.gross_weight}
                onChange={e => handleFieldChange('gross_weight', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">
                Tare Weight (kg) <span className="text-kanoz-red">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.tare_weight}
                onChange={e => handleFieldChange('tare_weight', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">Net Weight (kg)</label>
              <input
                type="number"
                disabled
                value={formData.net_weight}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text-secondary bg-kanoz-bg opacity-60 cursor-not-allowed"
              />
              <div className="text-[10px] text-kanoz-text-tertiary mt-1">Auto-calculated</div>
            </div>
          </div>
        </div>

        <div className="bg-kanoz-card rounded-xl p-5 border border-kanoz-border">
          <h3 className="text-sm font-bold text-kanoz-text mb-4">Moisture & Deduction</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">Moisture %</label>
              <input
                type="number"
                step="0.01"
                value={formData.moisture_percentage}
                onChange={e => handleFieldChange('moisture_percentage', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">Deduction (kg)</label>
              <input
                type="number"
                disabled
                value={formData.deduction_kg}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text-secondary bg-kanoz-bg opacity-60 cursor-not-allowed"
              />
              <div className="text-[10px] text-kanoz-text-tertiary mt-1">Auto-calculated</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">
                Final Quantity (kg) <span className="text-kanoz-red">*</span>
              </label>
              <input
                type="number"
                disabled
                value={formData.final_quantity}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text-secondary bg-kanoz-bg opacity-60 cursor-not-allowed"
              />
              <div className="text-[10px] text-kanoz-text-tertiary mt-1">Auto-calculated</div>
            </div>
          </div>
        </div>

        <div className="bg-kanoz-card rounded-xl p-5 border border-kanoz-border">
          <h3 className="text-sm font-bold text-kanoz-text mb-4">Pricing</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">
                Rate per kg (₹) <span className="text-kanoz-red">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.rate_per_kg}
                onChange={e => handleFieldChange('rate_per_kg', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">RM Amount (₹)</label>
              <input
                type="number"
                disabled
                value={formData.rm_amount}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text-secondary bg-kanoz-bg opacity-60 cursor-not-allowed"
              />
              <div className="text-[10px] text-kanoz-text-tertiary mt-1">Auto-calculated</div>
            </div>
          </div>
        </div>

        <div className="bg-kanoz-card rounded-xl p-5 border border-kanoz-border">
          <h3 className="text-sm font-bold text-kanoz-text mb-4">Charges</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">Loading (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.loading_charges}
                onChange={e => handleFieldChange('loading_charges', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">Unloading (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.unloading_charges}
                onChange={e => handleFieldChange('unloading_charges', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">Transport (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.transport_charges}
                onChange={e => handleFieldChange('transport_charges', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
              />
            </div>
          </div>
        </div>

        <div className="bg-kanoz-card rounded-xl p-5 border border-kanoz-border">
          <h3 className="text-sm font-bold text-kanoz-text mb-4">Summary</h3>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center py-2.5 border-b border-kanoz-border">
              <span className="text-sm text-kanoz-text-secondary">RM Amount</span>
              <span className="font-bold text-kanoz-text">₹{(parseFloat(formData.rm_amount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-kanoz-border">
              <span className="text-sm text-kanoz-text-secondary">Total Charges</span>
              <span className="font-bold text-kanoz-text">₹{((parseFloat(formData.loading_charges) || 0) + (parseFloat(formData.unloading_charges) || 0) + (parseFloat(formData.transport_charges) || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-kanoz-green/10 rounded-lg px-3">
              <span className="text-sm font-bold text-kanoz-text">Total Amount</span>
              <span className="text-lg font-bold text-kanoz-green">₹{(parseFloat(formData.total_amount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-sm text-kanoz-text-secondary">Avg Cost per kg</span>
              <span className="font-bold text-kanoz-text">₹{(parseFloat(formData.average_cost_per_kg) || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-kanoz-card rounded-xl p-4 border border-kanoz-border">
          <PhotoUpload
            label="Katta Parchi Photo"
            value={formData.katta_parchi_photo}
            onChange={file => handleFieldChange('katta_parchi_photo', file)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-kanoz-card rounded-xl p-4 border border-kanoz-border">
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">
              Payment Status <span className="text-kanoz-red">*</span>
            </label>
            <select
              value={formData.payment_status}
              onChange={e => handleFieldChange('payment_status', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
            >
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>

        <div className="bg-kanoz-card rounded-xl p-4 border border-kanoz-border">
          <label className="block text-xs font-semibold text-kanoz-text-secondary mb-2">Remarks</label>
          <textarea
            value={formData.remarks}
            onChange={e => handleFieldChange('remarks', e.target.value)}
            placeholder="Add any additional notes..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg placeholder-kanoz-text-tertiary resize-none"
          />
        </div>

        <button
          onClick={savePurchase}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-kanoz-green text-white font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={20} className="animate-spin" />}
          {saving ? 'Saving...' : id ? 'Update Purchase' : 'Save Purchase'}
        </button>
      </div>

      <Modal isOpen={showAddSupplier} onClose={() => setShowAddSupplier(false)} title="Add New Supplier">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
              Name <span className="text-kanoz-red">*</span>
            </label>
            <input
              type="text"
              placeholder="Supplier name"
              value={supplierForm.name}
              onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg placeholder-kanoz-text-tertiary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Mobile</label>
            <input
              type="tel"
              placeholder="Phone number"
              value={supplierForm.mobile}
              onChange={e => setSupplierForm({ ...supplierForm, mobile: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg placeholder-kanoz-text-tertiary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Raw Material Type</label>
            <select
              value={supplierForm.raw_material_type_id}
              onChange={e => setSupplierForm({ ...supplierForm, raw_material_type_id: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg"
            >
              <option value="">Select type (optional)</option>
              {rawMaterials.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Rate Offered (₹/kg)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={supplierForm.rate_offered}
              onChange={e => setSupplierForm({ ...supplierForm, rate_offered: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg placeholder-kanoz-text-tertiary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Address</label>
            <textarea
              placeholder="Supplier address"
              value={supplierForm.address}
              onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg placeholder-kanoz-text-tertiary resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">Remarks</label>
            <textarea
              placeholder="Additional notes"
              value={supplierForm.remarks}
              onChange={e => setSupplierForm({ ...supplierForm, remarks: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-kanoz-border text-sm text-kanoz-text focus:outline-none focus:ring-2 focus:ring-kanoz-green bg-kanoz-bg placeholder-kanoz-text-tertiary resize-none"
            />
          </div>

          <button
            onClick={addNewSupplier}
            className="w-full py-3 rounded-lg bg-kanoz-green text-white font-bold hover:bg-green-700 transition-colors"
          >
            Add Supplier
          </button>
        </div>
      </Modal>
    </div>
  )
}
