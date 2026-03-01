import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import PhotoUpload from '../../components/PhotoUpload'
import { Truck, Phone, Plus, X, ChevronLeft } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function DispatchForm() {
  const { employee, plant } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  // Today's dispatches
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [customers, setCustomers] = useState([])
  const [pelletTypes, setPelletTypes] = useState([])
  const [activeShiftReport, setActiveShiftReport] = useState(null)
  const [shiftWarning, setShiftWarning] = useState(false)

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

  useEffect(() => {
    if (plant?.id) {
      fetchTodayDispatches()
      fetchCustomers()
      fetchPelletTypes()
      fetchActiveShiftReport()
    }
  }, [plant])

  async function fetchTodayDispatches() {
    try {
      setLoading(true)
      const { data: dispatches } = await supabase
        .from('vehicle_dispatches')
        .select(`
          *,
          dispatch_pellets(*),
          customers(name)
        `)
        .eq('shift_reports.plant_id', plant.id)
        .eq('shift_reports.date', today)
        .order('dispatch_time', { ascending: false })

      if (dispatches) {
        const dispatchesWithTotals = dispatches.map(d => ({
          ...d,
          total_mt: d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0) || 0
        }))
        setDispatches(dispatchesWithTotals)
      }
    } catch (err) {
      console.error('Error fetching dispatches:', err)
      showToast('Failed to load dispatches', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchCustomers() {
    try {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('plant_id', plant.id)
        .order('name')

      setCustomers(data || [])
    } catch (err) {
      console.error('Error fetching customers:', err)
    }
  }

  async function fetchPelletTypes() {
    try {
      const { data } = await supabase
        .from('pellet_types')
        .select('*')
        .order('name')

      setPelletTypes(data || [])
    } catch (err) {
      console.error('Error fetching pellet types:', err)
    }
  }

  async function fetchActiveShiftReport() {
    try {
      const { data } = await supabase
        .from('shift_reports')
        .select('id')
        .eq('plant_id', plant.id)
        .eq('date', today)
        .order('shift', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setActiveShiftReport(data)
        setShiftWarning(false)
      } else {
        setShiftWarning(true)
      }
    } catch (err) {
      console.error('Error fetching shift report:', err)
      setShiftWarning(true)
    }
  }

  async function addCustomer() {
    if (!newCustomer.trim()) {
      showToast('Customer name cannot be empty', 'error')
      return
    }

    try {
      const { data } = await supabase
        .from('customers')
        .insert([{ name: newCustomer, plant_id: plant.id }])
        .select()

      if (data) {
        setCustomers([...customers, data[0]])
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
    if (!activeShiftReport) {
      showToast('No active shift report found. Please create one first.', 'error')
      return
    }

    try {
      setSubmitting(true)

      const { data: dispatch, error: dispatchError } = await supabase
        .from('vehicle_dispatches')
        .insert([{
          shift_report_id: activeShiftReport.id,
          truck_number: form.truck_number,
          customer_id: form.customer_id,
          destination: form.destination,
          transporter: form.transporter,
          driver_name: form.driver_name,
          driver_phone: form.driver_phone,
          invoice_number: form.invoice_number,
          loading_time: form.loading_time,
          dispatch_time: form.dispatch_time,
          katta_parchi_photo: form.katta_parchi_photo ? 'stored' : null,
          remarks: form.remarks
        }])
        .select()

      if (dispatchError) throw dispatchError

      if (dispatch?.[0]) {
        const pelletEntries = form.pellets.map(p => ({
          dispatch_id: dispatch[0].id,
          pellet_type_id: p.pellet_type_id,
          quantity_mt: parseFloat(p.quantity_mt)
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
        fetchTodayDispatches()
      }
    } catch (err) {
      console.error('Error saving dispatch:', err)
      showToast('Failed to save dispatch', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pb-20">
      <PageHeader title="Vehicle Dispatch" subtitle="Quick dispatch entry for today" backTo="/" />

      {/* Warning if no shift report */}
      {shiftWarning && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="text-xs font-bold text-red-800">No Active Shift Report</div>
          <div className="text-xs text-red-700 mt-1">Create a shift report first to add dispatches</div>
        </div>
      )}

      {/* Today's Dispatches List */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider">Today's Dispatches</h2>
          <span className="text-xs font-semibold text-kanoz-text">{dispatches.length}</span>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-xs text-kanoz-text-tertiary">Loading...</div>
          </div>
        ) : dispatches.length > 0 ? (
          <div className="space-y-2">
            {dispatches.map(dispatch => (
              <div key={dispatch.id} className="bg-kanoz-card rounded-xl border border-kanoz-border p-3">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="text-sm font-bold text-kanoz-text">
                      Truck {dispatch.truck_number}
                    </div>
                    <div className="text-xs text-kanoz-text-secondary mt-0.5">
                      {dispatch.customers?.name || 'Unknown Customer'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-kanoz-green">
                      {dispatch.total_mt.toFixed(1)} MT
                    </div>
                    {dispatch.dispatch_time && (
                      <div className="text-[10px] text-kanoz-text-tertiary mt-0.5">
                        {dispatch.dispatch_time.slice(0, 5)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-6 text-center">
            <Truck size={24} className="mx-auto text-kanoz-text-tertiary mb-2" />
            <p className="text-xs text-kanoz-text-secondary">No dispatches yet</p>
          </div>
        )}
      </div>

      {/* Add Dispatch Button */}
      <div className="px-4 mt-4 mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={shiftWarning}
          className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            shiftWarning
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : showForm
              ? 'bg-kanoz-accent text-white'
              : 'bg-kanoz-green text-white hover:bg-kanoz-green/90'
          }`}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add Dispatch'}
        </button>
      </div>

      {/* Dispatch Form */}
      {showForm && !shiftWarning && (
        <div className="px-4 pb-4">
          <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-4 space-y-4">

            {/* Truck Number */}
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                Truck Number <span className="text-kanoz-red">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., MH-01-AB-1234"
                value={form.truck_number}
                onChange={e => updateForm('truck_number', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              />
            </div>

            {/* Customer */}
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                Customer <span className="text-kanoz-red">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={form.customer_id}
                  onChange={e => updateForm('customer_id', e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
                >
                  <option value="">Select customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowAddCustomer(!showAddCustomer)}
                  className="px-3 py-2.5 bg-kanoz-blue text-white rounded-xl text-xs font-bold"
                >
                  <Plus size={16} />
                </button>
              </div>
              {showAddCustomer && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="New customer name"
                    value={newCustomer}
                    onChange={e => setNewCustomer(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-blue"
                  />
                  <button
                    onClick={addCustomer}
                    className="px-3 py-2.5 bg-kanoz-green text-white rounded-xl text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Destination */}
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                Destination
              </label>
              <input
                type="text"
                placeholder="Destination address"
                value={form.destination}
                onChange={e => updateForm('destination', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              />
            </div>

            {/* Transporter */}
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                Transporter
              </label>
              <input
                type="text"
                placeholder="Transporter name"
                value={form.transporter}
                onChange={e => updateForm('transporter', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              />
            </div>

            {/* Driver Info */}
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                Driver Name <span className="text-kanoz-red">*</span>
              </label>
              <input
                type="text"
                placeholder="Driver full name"
                value={form.driver_name}
                onChange={e => updateForm('driver_name', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                Driver Phone
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="Driver phone number"
                  value={form.driver_phone}
                  onChange={e => updateForm('driver_phone', e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
                />
                {form.driver_phone && (
                  <a
                    href={`tel:${form.driver_phone}`}
                    className="px-3 py-2.5 bg-kanoz-green text-white rounded-xl flex items-center justify-center"
                  >
                    <Phone size={16} />
                  </a>
                )}
              </div>
            </div>

            {/* Pellets */}
            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                Pellet Details <span className="text-kanoz-red">*</span>
              </label>
              <div className="space-y-2">
                {form.pellets.map((pellet, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select
                      value={pellet.pellet_type_id}
                      onChange={e => updatePellet(idx, 'pellet_type_id', e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
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
                      className="w-20 px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
                    />
                    {form.pellets.length > 1 && (
                      <button
                        onClick={() => removePelletRow(idx)}
                        className="px-3 py-2.5 bg-red-100 text-kanoz-red rounded-xl"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addPelletRow}
                className="mt-2 text-xs text-kanoz-green font-bold flex items-center gap-1"
              >
                <Plus size={14} /> Add Pellet Type
              </button>
            </div>

            {/* Invoice & Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                  Invoice Number
                </label>
                <input
                  type="text"
                  placeholder="Invoice #"
                  value={form.invoice_number}
                  onChange={e => updateForm('invoice_number', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                  Loading Time
                </label>
                <input
                  type="time"
                  value={form.loading_time}
                  onChange={e => updateForm('loading_time', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                Dispatch Time
              </label>
              <input
                type="time"
                value={form.dispatch_time}
                onChange={e => updateForm('dispatch_time', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
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
              <label className="block text-xs font-semibold text-kanoz-text-secondary mb-1.5">
                Remarks
              </label>
              <textarea
                placeholder="Any additional notes..."
                value={form.remarks}
                onChange={e => updateForm('remarks', e.target.value)}
                rows="3"
                className="w-full px-3 py-2.5 rounded-xl border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green resize-none"
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={submitting}
              className="w-full py-3 bg-kanoz-green text-white rounded-xl font-bold text-sm hover:bg-kanoz-green/90 disabled:bg-gray-300 transition-all"
            >
              {submitting ? 'Saving...' : 'Save Dispatch'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
