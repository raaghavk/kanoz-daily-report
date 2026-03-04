import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import PhotoUpload from '../../components/PhotoUpload'
import { Truck, Phone, Plus, X, ChevronLeft } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { sanitizeText, sanitizeNumber } from '../../lib/sanitize'

export default function DispatchForm() {
  const { employee, plant } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const returnToShift = location.state?.returnToShift || false
  const today = new Date().toISOString().split('T')[0]

  // Form state
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    truck_number: '',
    customer_id: '',
    destination: '',
    transporter: '',
    driver_name: '',
    driver_phone: '',
    pellets: [{ pellet_type_id: '', quantity_mt: '' }],
    invoice_number: '',
    loading_time: '',
    dispatch_time: '',
    katta_parchi_photo: null,
    remarks: ''
  })

  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: dispatches = [], isLoading: loading } = useQuery({
    queryKey: ['todayDispatches', plant?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('vehicle_dispatches')
        .select(`*, dispatch_pellets(*), customers(name)`)
        .eq('plant_id', plant.id)
        .eq('date', today)
        .order('created_at', { ascending: false })

      return (data || []).map(d => ({
        ...d,
        total_mt: d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0) || 0
      }))
    },
    enabled: !!plant?.id,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', plant?.org_id],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').eq('org_id', plant.org_id).eq('is_active', true).order('name')
      return data || []
    },
    enabled: !!plant?.id,
  })

  const { data: pelletTypes = [] } = useQuery({
    queryKey: ['pelletTypes', plant?.id],
    queryFn: async () => {
      const { data } = await supabase.from('pellet_types').select('*').eq('plant_id', plant.id).eq('is_active', true).order('name')
      return data || []
    },
    enabled: !!plant?.id,
  })

  const { data: activeShiftReport } = useQuery({
    queryKey: ['activeShiftReport', plant?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('shift_reports')
        .select('id')
        .eq('plant_id', plant.id)
        .eq('date', today)
        .order('shift', { ascending: false })
        .limit(1)
        .single()
      return data
    },
    enabled: !!plant?.id,
  })

  const shiftWarning = activeShiftReport === undefined ? false : !activeShiftReport

  async function addCustomer() {
    if (!newCustomer.trim()) {
      showToast('Customer name cannot be empty', 'error')
      return
    }

    try {
      const { data } = await supabase
        .from('customers')
        .insert([{ name: newCustomer, org_id: plant.org_id }])
        .select()

      if (data) {
        queryClient.invalidateQueries({ queryKey: ['customers', plant?.org_id] })
        setForm(prev => ({ ...prev, customer_id: data[0].id }))
        setNewCustomer('')
        setShowAddCustomer(false)
        showToast('Customer added', 'success')
      }
    } catch (err) {
      console.error('Error adding customer:', err)
      showToast('Failed to add customer', 'error')
    }
  }

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function updatePellet(index, field, value) {
    const newPellets = [...form.pellets]
    newPellets[index] = { ...newPellets[index], [field]: value }
    setForm(prev => ({ ...prev, pellets: newPellets }))
  }

  function addPelletRow() {
    setForm(prev => ({
      ...prev,
      pellets: [...prev.pellets, { pellet_type_id: '', quantity_mt: '' }]
    }))
  }

  function removePelletRow(index) {
    if (form.pellets.length > 1) {
      setForm(prev => ({
        ...prev,
        pellets: prev.pellets.filter((_, i) => i !== index)
      }))
    }
  }

  async function handleSave() {
    if (submitting) return
    if (!form.truck_number.trim()) {
      showToast('Truck number is required', 'error')
      return
    }
    if (!form.customer_id) {
      showToast('Customer is required', 'error')
      return
    }
    if (!form.driver_name.trim()) {
      showToast('Driver name is required', 'error')
      return
    }
    if (form.pellets.some(p => !p.pellet_type_id || !p.quantity_mt)) {
      showToast('Fill all pellet entries', 'error')
      return
    }
    try {
      setSubmitting(true)

      const { data: dispatch, error: dispatchError } = await supabase
        .from('vehicle_dispatches')
        .insert([{
          shift_report_id: activeShiftReport?.id || null,
          plant_id: plant.id,
          date: today,
          truck_number: sanitizeText(form.truck_number, 20),
          customer_id: form.customer_id,
          destination: sanitizeText(form.destination, 200),
          transporter: sanitizeText(form.transporter, 100),
          driver_name: sanitizeText(form.driver_name, 100),
          driver_phone: sanitizeText(form.driver_phone, 15),
          invoice_no: sanitizeText(form.invoice_number, 50),
          loading_time: form.loading_time || null,
          dispatch_time: form.dispatch_time || null,
          katta_parchi_url: form.katta_parchi_photo || null,
          remarks: sanitizeText(form.remarks, 500),
          created_by: employee?.id,
        }])
        .select()

      if (dispatchError) throw dispatchError

      if (dispatch?.[0]) {
        const pelletEntries = form.pellets.map(p => ({
          dispatch_id: dispatch[0].id,
          pellet_type_id: p.pellet_type_id,
          pellet_type_name: pelletTypes.find(pt => pt.id === p.pellet_type_id)?.name || '',
          quantity_mt: sanitizeNumber(p.quantity_mt)
        }))

        const { error: pelletError } = await supabase
          .from('dispatch_pellets')
          .insert(pelletEntries)

        if (pelletError) throw pelletError

        showToast('Dispatch saved successfully', 'success')
        setForm({
          truck_number: '',
          customer_id: '',
          destination: '',
          transporter: '',
          driver_name: '',
          driver_phone: '',
          pellets: [{ pellet_type_id: '', quantity_mt: '' }],
          invoice_number: '',
          loading_time: '',
          dispatch_time: '',
          katta_parchi_photo: null,
          remarks: ''
        })
        setShowForm(false)
        queryClient.invalidateQueries({ queryKey: ['todayDispatches'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      }
    } catch (err) {
      console.error('Error saving dispatch:', err)
      showToast('Failed to save dispatch', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <PageHeader
        title="Vehicle Dispatch"
        subtitle={returnToShift ? "Add dispatches, then go back to shift report" : "Quick dispatch entry for today"}
        backTo={returnToShift ? "/shift/new" : "/"}
      />

      {/* Return to Shift Banner */}
      {returnToShift && (
        <div style={{ margin: '12px 20px 0', background: '#e8f0ec', border: '1.5px solid #2d6a4f', borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: '#2d6a4f', fontWeight: 600 }}>You came from the Shift Report wizard.</div>
          <button
            onClick={() => navigate('/shift/new')}
            style={{ padding: '6px 12px', background: '#2d6a4f', color: 'white', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            ← Back to Shift
          </button>
        </div>
      )}

      {/* Info if no shift report — dispatch still allowed */}
      {shiftWarning && (
        <div style={{ margin: '16px 20px 0', background: '#fefae0', border: '1.5px solid #e9c46a', borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>No Active Shift Report</div>
          <div style={{ fontSize: 11, color: '#A16207', marginTop: 4 }}>Dispatch will be saved independently. It will be linked to a shift report when one is created.</div>
        </div>
      )}

      {/* Today's Dispatches List */}
      <div style={{ padding: '0 20px', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1 }}>Today's Dispatches</h2>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#2c2c2c' }}>{dispatches.length}</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 12, color: '#b5b8a8' }}>Loading...</div>
          </div>
        ) : dispatches.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dispatches.map(dispatch => (
              <div key={dispatch.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>
                      Truck {dispatch.truck_number}
                    </div>
                    <div style={{ fontSize: 12, color: '#595c4a', marginTop: 2 }}>
                      {dispatch.customers?.name || 'Unknown Customer'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2d6a4f' }}>
                      {dispatch.total_mt.toFixed(1)} MT
                    </div>
                    {dispatch.dispatch_time && (
                      <div style={{ fontSize: 10, color: '#b5b8a8', marginTop: 2 }}>
                        {dispatch.dispatch_time.slice(0, 5)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 24, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Truck size={24} style={{ color: '#b5b8a8' }} /></div>
            <p style={{ fontSize: 12, color: '#595c4a' }}>No dispatches yet</p>
          </div>
        )}
      </div>

      {/* Add Dispatch Button */}
      <div style={{ padding: '0 20px', marginTop: 16, marginBottom: 16 }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 14,
            background: showForm ? '#d4a373' : '#2d6a4f',
            color: 'white',
            cursor: 'pointer',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s'
          }}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add Dispatch'}
        </button>
      </div>

      {/* Dispatch Form */}
      {showForm && (
        <div style={{ padding: '0 20px', paddingBottom: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Truck Number */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Truck Number <span style={{ color: '#D32F2F' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., MH-01-AB-1234"
                value={form.truck_number}
                onChange={e => updateForm('truck_number', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
              />
            </div>

            {/* Customer */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Customer <span style={{ color: '#D32F2F' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={form.customer_id}
                  onChange={e => updateForm('customer_id', e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                >
                  <option value="">Select customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowAddCustomer(!showAddCustomer)}
                  style={{ padding: '10px 12px', background: '#1565C0', color: 'white', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} />
                </button>
              </div>
              {showAddCustomer && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="New customer name"
                    value={newCustomer}
                    onChange={e => setNewCustomer(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                  />
                  <button
                    onClick={addCustomer}
                    style={{ padding: '10px 12px', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Destination */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Destination
              </label>
              <input
                type="text"
                placeholder="Destination address"
                value={form.destination}
                onChange={e => updateForm('destination', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
              />
            </div>

            {/* Transporter */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Transporter
              </label>
              <input
                type="text"
                placeholder="Transporter name"
                value={form.transporter}
                onChange={e => updateForm('transporter', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
              />
            </div>

            {/* Driver Info */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Driver Name <span style={{ color: '#D32F2F' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Driver full name"
                value={form.driver_name}
                onChange={e => updateForm('driver_name', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Driver Phone
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="tel"
                  placeholder="Driver phone number"
                  value={form.driver_phone}
                  onChange={e => updateForm('driver_phone', e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                />
                {form.driver_phone && (
                  <a
                    href={`tel:${form.driver_phone}`}
                    style={{ padding: '10px 12px', background: '#2d6a4f', color: 'white', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration: 'none' }}
                  >
                    <Phone size={16} />
                  </a>
                )}
              </div>
            </div>

            {/* Pellets */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Pellet Details <span style={{ color: '#D32F2F' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.pellets.map((pellet, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={pellet.pellet_type_id}
                      onChange={e => updatePellet(idx, 'pellet_type_id', e.target.value)}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                    >
                      <option value="">Pellet type</option>
                      {pelletTypes.map(pt => (
                        <option key={pt.id} value={pt.id}>{pt.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="MT"
                      min="0"
                      step="0.1"
                      value={pellet.quantity_mt}
                      onChange={e => updatePellet(idx, 'quantity_mt', e.target.value)}
                      style={{ width: 80, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                    />
                    {form.pellets.length > 1 && (
                      <button
                        onClick={() => removePelletRow(idx)}
                        style={{ padding: '10px 12px', background: '#FFEBEE', color: '#D32F2F', borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addPelletRow}
                style={{ marginTop: 8, fontSize: 12, color: '#2d6a4f', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
              >
                <Plus size={14} /> Add Pellet Type
              </button>
            </div>

            {/* Invoice & Times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                  Invoice Number
                </label>
                <input
                  type="text"
                  placeholder="Invoice #"
                  value={form.invoice_number}
                  onChange={e => updateForm('invoice_number', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                  Loading Time
                </label>
                <input
                  type="time"
                  value={form.loading_time}
                  onChange={e => updateForm('loading_time', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Dispatch Time
              </label>
              <input
                type="time"
                value={form.dispatch_time}
                onChange={e => updateForm('dispatch_time', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
              />
            </div>

            {/* Photo Upload */}
            <PhotoUpload
              label="Katta Parchi Photo"
              value={form.katta_parchi_photo}
              onChange={file => updateForm('katta_parchi_photo', file)}
              bucket="katta_parchi"
            />

            {/* Remarks */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Remarks
              </label>
              <textarea
                placeholder="Any additional notes..."
                value={form.remarks}
                onChange={e => updateForm('remarks', e.target.value)}
                rows="3"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', resize: 'none' }}
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={submitting}
              style={{ width: '100%', padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
            >
              {submitting ? 'Saving...' : 'Save Dispatch'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
