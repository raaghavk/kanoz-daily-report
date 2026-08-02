import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import PhotoUpload from '../../components/PhotoUpload'
import { Truck, Phone, Plus, X, ChevronDown, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { sanitizeText, sanitizeNumber } from '../../lib/sanitize'
import AddTransporterModal from '../../components/AddTransporterModal'
import { getLocalDate } from '../../lib/dateUtils'

const DISPATCH_DRAFT_KEY = 'kanoz_dispatch_draft'
const DISPATCH_DRAFT_MAX_AGE = 6 * 60 * 60 * 1000 // 6 hours

export default function DispatchForm() {
  const { employee, plant } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const returnToShift = location.state?.returnToShift || false
  const openFormDirectly = location.state?.showForm || false
  const today = getLocalDate()

  // Filter tab
  const filterTab = searchParams.get('tab') || 'week'
  function setFilterTab(tab) {
    setSearchParams({ tab }, { replace: true })
  }

  // Collapsible date groups
  const [collapsedDates, setCollapsedDates] = useState({})

  // Form state — open directly if navigated from "New Dispatch"
  const [showForm, setShowForm] = useState(openFormDirectly)

  // Also handle re-navigation to this page with showForm state
  useEffect(() => {
    if (location.state?.showForm) setShowForm(true)
  }, [location.state])

  // Apply voice prefill
  useEffect(() => {
    const prefill = location.state?.prefill
    if (!prefill) return

    setForm(prev => ({
      ...prev,
      ...(prefill.customer_id && { customer_id: prefill.customer_id }),
      ...(prefill.truck_number && { truck_number: prefill.truck_number }),
      ...(prefill.transporter_id && { transporter_id: prefill.transporter_id }),
      ...(prefill.transporter_name && !prefill.transporter_id && { transporter: prefill.transporter_name }),
      ...(prefill.pellet_type_id && prefill.quantity_mt && {
        pellets: [{ pellet_type_id: prefill.pellet_type_id, quantity_mt: String(prefill.quantity_mt) }]
      }),
    }))
    // Make sure form is visible
    setShowForm(true)
  }, [location.state?.prefill]) // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState({
    truck_number: '',
    customer_id: '',
    destination: '',
    transporter: '',
    transporter_id: '',
    driver_name: '',
    driver_phone: '',
    pellets: [{ pellet_type_id: '', quantity_mt: '' }],
    serial_no: '',
    invoice_number: '',
    loading_date: today,
    loading_time: new Date().toTimeString().slice(0, 5),
    dispatch_date: today,
    dispatch_time: new Date().toTimeString().slice(0, 5),
    katta_parchi_photo: null,
    remarks: ''
  })

  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState('')
  const [newCustomerAddress, setNewCustomerAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [restoredDraft, setRestoredDraft] = useState(false)

  function clearDispatchDraft() {
    try { localStorage.removeItem(DISPATCH_DRAFT_KEY) } catch (e) { /* ignore */ }
    setRestoredDraft(false)
  }

  // Restore an unsaved dispatch draft on mount (create-only form, so always for new entries).
  // Skip if we arrived via a voice prefill (prefill takes precedence).
  useEffect(() => {
    if (location.state?.prefill) return
    try {
      const saved = localStorage.getItem(DISPATCH_DRAFT_KEY)
      if (!saved) return
      const parsed = JSON.parse(saved)
      const { form: savedForm, savedAt } = parsed || {}
      if (!savedForm) return
      if (savedAt && Date.now() - savedAt > DISPATCH_DRAFT_MAX_AGE) {
        localStorage.removeItem(DISPATCH_DRAFT_KEY)
        return
      }
      setForm(prev => ({ ...prev, ...savedForm }))
      setRestoredDraft(true)
    } catch (e) {
      try { localStorage.removeItem(DISPATCH_DRAFT_KEY) } catch (_) { /* ignore */ }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist the in-progress dispatch to localStorage so it survives navigating away.
  useEffect(() => {
    try {
      localStorage.setItem(DISPATCH_DRAFT_KEY, JSON.stringify({ form, savedAt: Date.now() }))
    } catch (e) { /* ignore */ }
  }, [form])

  // Date filter logic
  function getDateFilter(tab) {
    const now = new Date()
    const start = new Date(now)
    if (tab === 'today') {
      return { start: getLocalDate(now), end: getLocalDate(now) }
    } else if (tab === 'week') {
      start.setDate(now.getDate() - now.getDay())
      return { start: getLocalDate(start), end: getLocalDate(now) }
    } else if (tab === 'month') {
      start.setDate(1)
      return { start: getLocalDate(start), end: getLocalDate(now) }
    } else {
      return { start: '2024-01-01', end: getLocalDate(now) }
    }
  }

  const { data: dispatches = [], isLoading: loading } = useQuery({
    queryKey: ['dispatches', plant?.id, filterTab],
    queryFn: async () => {
      const dateFilter = getDateFilter(filterTab)
      const { data } = await supabase
        .from('vehicle_dispatches')
        .select(`*, dispatch_pellets(*), customers(name)`)
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .gte('date', dateFilter.start)
        .lte('date', dateFilter.end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      return (data || []).map(d => ({
        ...d,
        total_mt: d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0) || 0
      }))
    },
    enabled: !!plant?.id,
  })

  // Group dispatches by date
  const groupedDispatches = {}
  dispatches.forEach(d => {
    const date = d.dispatch_date || d.date || ''
    if (!groupedDispatches[date]) groupedDispatches[date] = []
    groupedDispatches[date].push(d)
  })
  const dateKeys = Object.keys(groupedDispatches).sort((a, b) => new Date(b) - new Date(a))

  // Collapse all dates except the most recent one
  useEffect(() => {
    if (dateKeys.length > 1) {
      const collapsed = {}
      dateKeys.forEach((date, idx) => {
        if (idx > 0) collapsed[date] = true
      })
      setCollapsedDates(collapsed)
    }
  }, [dispatches.length, filterTab]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDateCollapse(date) {
    setCollapsedDates(prev => ({ ...prev, [date]: !prev[date] }))
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function getDateTotalMT(dispatchList) {
    return dispatchList.reduce((sum, d) => sum + d.total_mt, 0)
  }

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', plant?.org_id],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').eq('org_id', plant.org_id).eq('is_active', true).order('name')
      return data || []
    },
    enabled: !!plant?.id,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const { data: pelletTypes = [] } = useQuery({
    queryKey: ['pelletTypes', plant?.id],
    queryFn: async () => {
      const { data } = await supabase.from('pellet_types').select('*').eq('plant_id', plant.id).eq('is_active', true).order('name')
      return data || []
    },
    enabled: !!plant?.id,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const { data: transporters = [] } = useQuery({
    queryKey: ['transporters', plant?.org_id],
    queryFn: async () => {
      const { data } = await supabase.from('transporters').select('*').eq('org_id', plant.org_id).eq('is_active', true).order('name')
      return data || []
    },
    enabled: !!plant?.id,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  // Company vehicles are only for raw material purchases, not outgoing dispatches

  const [showAddTransporter, setShowAddTransporter] = useState(false)
  const { data: selectedTransporterVehicles = [] } = useQuery({
    queryKey: ['transporter-vehicles-dispatch', form.transporter_id],
    queryFn: async () => {
      if (!form.transporter_id) return []
      const { data } = await supabase
        .from('transporter_vehicles')
        .select('*')
        .eq('transporter_id', form.transporter_id)
        .eq('is_active', true)
        .order('vehicle_number')
      return data || []
    },
    enabled: !!form.transporter_id,
  })

  const { data: latestPelletStock = {} } = useQuery({
    queryKey: ['latestPelletStock', plant?.id],
    queryFn: async () => {
      const { data: latestReport } = await supabase
        .from('shift_reports')
        .select('id, date')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!latestReport) return {}
      const { data: stocks } = await supabase
        .from('pellet_stock')
        .select('pellet_type_id, closing_mt')
        .eq('shift_report_id', latestReport.id)
      const stockMap = {}
      for (const s of (stocks || [])) {
        stockMap[s.pellet_type_id] = parseFloat(s.closing_mt) || 0
      }

      // Closing stock only reflects dispatches recorded in that shift report —
      // subtract dispatches made since the snapshot so the same stock can't be
      // dispatched twice. Dispatches linked to the report itself are already
      // in its closing figures, so skip those.
      if (latestReport.date) {
        const { data: sinceDispatches } = await supabase
          .from('vehicle_dispatches')
          .select('id, date, shift_report_id, dispatch_pellets(pellet_type_id, quantity_mt)')
          .eq('plant_id', plant.id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .gte('date', latestReport.date)
        for (const d of (sinceDispatches || [])) {
          if (d.shift_report_id === latestReport.id) continue
          for (const p of (d.dispatch_pellets || [])) {
            if (stockMap[p.pellet_type_id] !== undefined) {
              stockMap[p.pellet_type_id] -= parseFloat(p.quantity_mt) || 0
            }
          }
        }
      }
      return stockMap
    },
    enabled: !!plant?.id,
    staleTime: 2 * 60 * 1000,
  })

  const { data: activeShiftReport } = useQuery({
    queryKey: ['activeShiftReport', plant?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('shift_reports')
        .select('id')
        .eq('plant_id', plant.id)
        .eq('date', today)
        .eq('is_deleted', false)
        .order('shift', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    },
    enabled: !!plant?.id,
  })

  async function addCustomer() {
    if (!newCustomer.trim()) {
      showToast('Customer name cannot be empty', 'error')
      return
    }

    try {
      const payload = { name: newCustomer, org_id: plant.org_id }
      if (newCustomerAddress.trim()) payload.address = newCustomerAddress.trim()
      const { data } = await supabase
        .from('customers')
        .insert([payload])
        .select()

      if (data) {
        queryClient.invalidateQueries({ queryKey: ['customers', plant?.org_id] })
        setForm(prev => ({ ...prev, customer_id: data[0].id, ...(data[0].address ? { destination: data[0].address } : {}) }))
        setNewCustomer('')
        setNewCustomerAddress('')
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
    if (!form.truck_number.trim()) { showToast('Truck number is required', 'error'); return }
    if (!form.customer_id) { showToast('Customer is required', 'error'); return }
    if (!form.destination.trim()) { showToast('Destination is required', 'error'); return }
    if (!form.transporter.trim()) { showToast('Transporter is required', 'error'); return }
    if (!form.driver_name.trim()) { showToast('Driver name is required', 'error'); return }
    if (!form.driver_phone.trim()) { showToast('Driver phone is required', 'error'); return }
    if (!/^\d{10}$/.test(form.driver_phone.trim())) { showToast('Driver phone must be 10 digits', 'error'); return }
    if (!form.katta_parchi_photo) { showToast('Weight bridge photo is required', 'error'); return }
    if (form.pellets.some(p => !p.pellet_type_id || !p.quantity_mt)) { showToast('Fill all pellet entries', 'error'); return }

    // Pellet stock validation — prevent dispatching more than available closing stock
    for (const p of form.pellets) {
      if (!p.pellet_type_id || !p.quantity_mt) continue
      const available = latestPelletStock[p.pellet_type_id]
      if (available !== undefined && parseFloat(p.quantity_mt) > available) {
        const typeName = pelletTypes.find(pt => pt.id === p.pellet_type_id)?.name || 'Pellet'
        showToast(`${typeName}: only ${available.toFixed(2)} MT available in closing stock`, 'error')
        return
      }
    }
    if (!form.invoice_number.trim()) { showToast('Invoice number is required', 'error'); return }
    if (!form.loading_time) { showToast('Loading time is required', 'error'); return }
    if (!form.dispatch_time) { showToast('Dispatch time is required', 'error'); return }
    // Loading happens before dispatch — enforce datetime ordering
    const loadingDT = new Date(`${form.loading_date || today}T${form.loading_time}`)
    const dispatchDT = new Date(`${form.dispatch_date || today}T${form.dispatch_time}`)
    if (!(dispatchDT > loadingDT)) { showToast('Dispatch date & time must be later than the loading date & time', 'error'); return }
    try {
      setSubmitting(true)

      // Check if dispatch is for a past date
      const dispatchDate = form.dispatch_date || today
      if (dispatchDate < today) {
        const confirmed = window.confirm(
          `This dispatch is for ${dispatchDate} (a past date). It will be linked to the shift report for that period.\n\nContinue saving?`
        )
        if (!confirmed) {
          setSubmitting(false)
          return
        }
      }

      // Auto-assign to correct shift report for past dates
      let shiftReportId = activeShiftReport?.id || null
      if (dispatchDate < today) {
        // Find shift report that covers this dispatch date
        const { data: pastReport } = await supabase
          .from('shift_reports')
          .select('id')
          .eq('plant_id', plant.id)
          .eq('date', dispatchDate)
          .eq('is_deleted', false)
          .order('shift', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (pastReport) {
          shiftReportId = pastReport.id
        }
      }

      const { data: dispatch, error: dispatchError } = await supabase
        .from('vehicle_dispatches')
        .insert([{
          shift_report_id: shiftReportId,
          plant_id: plant.id,
          date: form.dispatch_date || today,
          truck_number: sanitizeText(form.truck_number, 20),
          customer_id: form.customer_id,
          destination: sanitizeText(form.destination, 200),
          transporter: sanitizeText(form.transporter, 100),
          transporter_id: form.transporter_id || null,
          driver_name: sanitizeText(form.driver_name, 100),
          driver_phone: sanitizeText(form.driver_phone, 15),
          serial_no: sanitizeText(form.serial_no, 50) || null,
          invoice_no: sanitizeText(form.invoice_number, 50),
          loading_date: form.loading_date || today,
          loading_time: form.loading_time || null,
          dispatch_date: form.dispatch_date || today,
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

        // Send push notification to admins (non-blocking)
        const totalQty = form.pellets.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0)
        const customerName = customers?.find(c => c.id === form.customer_id)?.name || 'Unknown'
        import('../../lib/notifications').then(({ sendNotification }) => {
          sendNotification('dispatch_created', {
            truck_number: form.truck_number,
            customer: customerName,
            quantity_mt: totalQty.toFixed(1),
            plant: plant?.name,
          })
        }).catch(() => {})
        setForm({
          truck_number: '',
          customer_id: '',
          destination: '',
          transporter: '',
          transporter_id: '',
          driver_name: '',
          driver_phone: '',
          pellets: [{ pellet_type_id: '', quantity_mt: '' }],
          serial_no: '',
          invoice_number: '',
          loading_date: today,
          loading_time: new Date().toTimeString().slice(0, 5),
          dispatch_date: today,
          dispatch_time: new Date().toTimeString().slice(0, 5),
          katta_parchi_photo: null,
          remarks: ''
        })
        clearDispatchDraft()
        queryClient.invalidateQueries({ queryKey: ['dispatches'] })
        queryClient.invalidateQueries({ queryKey: ['todayDispatches'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['latestPelletStock'] })
        // If we came from the shift wizard, go straight back instead of showing list
        if (returnToShift) {
          navigate('/shift/new', { state: { returnToStep: 7 } })
        } else {
          setShowForm(false)
        }
      }
    } catch (err) {
      console.error('Error saving dispatch:', err)
      showToast('Failed to save dispatch', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function scanDispatchParchi(directUrl) {
    const imageUrl = directUrl !== undefined ? directUrl : form.katta_parchi_photo
    if (!imageUrl) return
    try {
      setScanning(true)
      const { data: result, error } = await supabase.functions.invoke('extract-receipt', {
        body: { imageUrl, type: 'katta_parchi' }
      })
      if (error || !result?.success) {
        showToast('Could not extract data from photo', 'error')
        return
      }
      const updates = {}
      if (result.data?.vehicle_number) updates.truck_number = result.data.vehicle_number
      if (result.data?.serial_no) updates.serial_no = result.data.serial_no
      if (result.data?.date) {
        const parsed = new Date(result.data.date)
        if (!isNaN(parsed.getTime())) {
          updates.dispatch_date = result.data.date
          updates.loading_date = result.data.date
        }
      }
      if (result.data?.time) {
        updates.dispatch_time = result.data.time
        updates.loading_time = result.data.time
      }
      setForm(prev => ({ ...prev, ...updates }))
      showToast('Fields auto-filled from photo', 'success')
    } catch (err) {
      showToast('Could not extract data from photo', 'error')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      {/* Header + Filter Tabs (sticky) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader
          title="Vehicle Dispatch"
          subtitle={returnToShift ? "Add dispatches, then go back to shift report" : "Manage all dispatches"}
          onBack={
            returnToShift
              ? () => navigate('/shift/new', { state: { returnToStep: 7 } })
              : showForm
                ? () => setShowForm(false)
                : () => navigate('/')
          }
        />

        {/* Return to Shift Banner — only when viewing list */}
        {!showForm && returnToShift && (
          <div style={{ margin: '12px 20px 0', background: '#e8f0ec', border: '1.5px solid #2d6a4f', borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: '#2d6a4f', fontWeight: 600 }}>You came from the Shift Report wizard.</div>
            <button
              onClick={() => navigate('/shift/new', { state: { returnToStep: 7 } })}
              style={{ padding: '6px 12px', background: '#2d6a4f', color: 'white', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              Back to Shift
            </button>
          </div>
        )}

        {/* Filter Tabs — only when viewing list */}
        {!showForm && (
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          background: '#fefae0', borderBottom: '1px solid #e5ddd0', padding: '10px 20px',
        }}>
          {['week', 'month', 'all'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              style={{
                padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                whiteSpace: 'nowrap', transition: 'all 0.2s', border: 'none', cursor: 'pointer',
                ...(filterTab === tab
                  ? { background: '#2d6a4f', color: 'white' }
                  : { background: 'white', color: '#2c2c2c', border: '1.5px solid #e5ddd0' })
              }}
            >
              {tab === 'week' ? 'This Week' : tab === 'month' ? 'This Month' : 'All'}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {!showForm && (
          <>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                <Loader2 size={32} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : dateKeys.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 24, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Truck size={24} style={{ color: '#b5b8a8' }} /></div>
                <p style={{ fontSize: 12, color: '#595c4a' }}>No dispatches found</p>
                <p style={{ fontSize: 11, color: '#b5b8a8', marginTop: 4 }}>Add your first dispatch to get started</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {dateKeys.map(date => {
                  const isCollapsed = collapsedDates[date]
                  const dateDispatches = groupedDispatches[date]
                  const dateTotalMT = getDateTotalMT(dateDispatches)

                  return (
                    <div key={date}>
                      {/* Date Header */}
                      <button
                        onClick={() => toggleDateCollapse(date)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                          padding: '0 0 10px 0', textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isCollapsed
                            ? <ChevronRight size={14} style={{ color: '#8a8d7a' }} />
                            : <ChevronDown size={14} style={{ color: '#8a8d7a' }} />
                          }
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#b5b8a8', textTransform: 'uppercase', letterSpacing: 1 }}>
                            {formatDate(date)}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f' }}>
                          {dateTotalMT.toFixed(1)} MT · {dateDispatches.length} trucks
                        </span>
                      </button>

                      {/* Dispatch cards */}
                      {!isCollapsed && (
                        <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
                          {dateDispatches.map((dispatch, idx) => (
                            <div
                              key={dispatch.id}
                              style={{
                                borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none',
                                padding: '10px 12px',
                              }}
                            >
                              {/* Main row — clickable to detail */}
                              <button
                                onClick={() => navigate(`/dispatch/${dispatch.id}`)}
                                style={{
                                  width: '100%', textAlign: 'left', cursor: 'pointer',
                                  background: 'transparent', border: 'none', padding: 0,
                                  display: 'flex', alignItems: 'center', gap: 10,
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    Truck {dispatch.truck_number}
                                  </div>
                                  <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>
                                    {dispatch.customers?.name || 'Unknown'} · {dispatch.dispatch_time?.slice(0, 5) || '-'}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#2d6a4f' }}>{dispatch.total_mt.toFixed(1)} MT</div>
                                </div>
                              </button>
                              {/* Driver info row with call button */}
                              {dispatch.driver_name && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px dashed #f0ebe0' }}>
                                  <div style={{ fontSize: 10, color: '#8a8d7a' }}>
                                    Driver: <span style={{ color: '#595c4a', fontWeight: 600 }}>{dispatch.driver_name}</span>
                                  </div>
                                  {dispatch.driver_phone && (
                                    <a
                                      href={`tel:${dispatch.driver_phone}`}
                                      onClick={e => e.stopPropagation()}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        padding: '4px 10px', background: '#e8f0ec', borderRadius: 8,
                                        fontSize: 10, fontWeight: 700, color: '#2d6a4f',
                                        textDecoration: 'none', border: 'none', cursor: 'pointer',
                                      }}
                                    >
                                      <Phone size={10} /> Call
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* No FAB — user adds dispatch via bottom nav "New" button */}

        {/* Dispatch Form */}
        {showForm && (
          <div style={{ padding: '0 20px', paddingBottom: 16 }}>
          {restoredDraft && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#e8f0ec', border: '1px solid #b7d3c4', borderRadius: 12, padding: '10px 12px', marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: '#2d6a4f', fontWeight: 600 }}>Restored your unsaved dispatch</span>
              <button onClick={() => setRestoredDraft(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d6a4f', display: 'flex', alignItems: 'center' }} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}
          {/* Photo Scan — first thing in form */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 16, border: '1.5px solid #e5ddd0', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={16} style={{ color: '#2d6a4f' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>Weight Bridge Photo</span>
            </div>
            <PhotoUpload
              label=""
              value={form.katta_parchi_photo}
              onChange={async (url) => {
                updateForm('katta_parchi_photo', url)
                if (url) scanDispatchParchi(url)
              }}
              folder="dispatches"
            />
            {form.katta_parchi_photo && (
              <button
                type="button"
                onClick={() => scanDispatchParchi()}
                disabled={scanning}
                style={{
                  marginTop: 12, width: '100%', padding: '12px 16px',
                  background: '#FEF3C7', color: '#92400E',
                  border: '1.5px solid #F59E0B', borderRadius: 12,
                  fontSize: 14, fontWeight: 600,
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  opacity: scanning ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Sparkles size={18} />
                {scanning ? 'Scanning...' : '↻ Re-scan Photo'}
              </button>
            )}
          </div>

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
                  onChange={e => {
                    const val = e.target.value
                    const selected = customers.find(c => c.id === val)
                    setForm(prev => ({ ...prev, customer_id: val, ...(selected?.address ? { destination: selected.address } : {}) }))
                  }}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                >
                  <option value="">Select customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowAddCustomer(!showAddCustomer)}
                  style={{ padding: '10px 12px', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} />
                </button>
              </div>
              {showAddCustomer && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
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
                  <input
                    type="text"
                    placeholder="Customer address (optional)"
                    value={newCustomerAddress}
                    onChange={e => setNewCustomerAddress(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                  />
                </div>
              )}
            </div>

            {/* Destination */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Destination <span style={{ color: '#D32F2F' }}>*</span>
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
                Transporter <span style={{ color: '#D32F2F' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {transporters.length > 0 ? (
                  <select
                    value={form.transporter_id}
                    onChange={e => {
                      const selected = transporters.find(t => t.id === e.target.value)
                      if (selected) {
                        updateForm('transporter_id', selected.id)
                        updateForm('transporter', selected.name)
                        if (selected.driver_name) updateForm('driver_name', selected.driver_name)
                        if (selected.driver_phone) {
                          updateForm('driver_phone', selected.driver_phone.replace(/^\+91/, ''))
                        }
                      }
                    }}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                  >
                    <option value="">Select transporter</option>
                    {transporters.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Transporter name"
                    value={form.transporter}
                    onChange={e => updateForm('transporter', e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                  />
                )}
                <button
                  onClick={() => setShowAddTransporter(!showAddTransporter)}
                  style={{ padding: '10px 12px', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} />
                </button>
              </div>
              {form.transporter_id && selectedTransporterVehicles.length > 0 && (
                <>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6, marginTop: 12 }}>Select Vehicle</label>
                  <select
                    value={form.truck_number}
                    onChange={e => {
                      const v = selectedTransporterVehicles.find(v => v.vehicle_number === e.target.value)
                      const updates = { truck_number: e.target.value }
                      if (v?.driver_name) updates.driver_name = v.driver_name
                      if (v?.driver_phone) updates.driver_phone = v.driver_phone.replace(/^\+91/, '')
                      setForm(prev => ({ ...prev, ...updates }))
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, color: '#2c2c2c', outline: 'none', background: '#fefae0', marginBottom: 12, boxSizing: 'border-box' }}
                  >
                    <option value="">Select vehicle...</option>
                    {selectedTransporterVehicles.map(v => (
                      <option key={v.id} value={v.vehicle_number}>{v.vehicle_number} ({v.vehicle_type}){v.driver_name ? ` — ${v.driver_name}` : ''}</option>
                    ))}
                  </select>
                </>
              )}
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
                Driver Phone <span style={{ color: '#D32F2F' }}>*</span>
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
                {pelletTypes.length === 0 && (
                  <div style={{ background: '#fef3c7', border: '1.5px solid #fbbf24', borderRadius: 12, padding: '10px 12px', fontSize: 12, color: '#92400e', marginBottom: 8 }}>
                    No pellet types yet. Submit a shift report first — pellet types are created automatically from your mixes.
                  </div>
                )}
                {form.pellets.map((pellet, idx) => {
                  const available = pellet.pellet_type_id ? latestPelletStock[pellet.pellet_type_id] : undefined
                  const enteredQty = parseFloat(pellet.quantity_mt) || 0
                  const exceeds = available !== undefined && enteredQty > available
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={pellet.pellet_type_id}
                          onChange={e => updatePellet(idx, 'pellet_type_id', e.target.value)}
                          style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                        >
                          <option value="">Pellet type</option>
                          {pelletTypes.map(pt => (
                            <option key={pt.id} value={pt.id}>
                              {pt.name}{pt.grade ? ` · ${pt.grade}` : ''}{pt.gcv_kcal_kg != null ? ` · ${Math.round(parseFloat(pt.gcv_kcal_kg))}` : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="MT"
                          min="0"
                          step="0.1"
                          value={pellet.quantity_mt}
                          onChange={e => updatePellet(idx, 'quantity_mt', e.target.value)}
                          style={{ width: 80, padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${exceeds ? '#D32F2F' : '#e5ddd0'}`, fontSize: 14, outline: 'none' }}
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
                      {available !== undefined && pellet.quantity_mt && (
                        <div style={{ fontSize: 11, marginTop: 4, color: exceeds ? '#D32F2F' : '#2d6a4f', fontWeight: 600 }}>
                          {exceeds
                            ? `⚠ Only ${available.toFixed(2)} MT available`
                            : `✓ ${available.toFixed(2)} MT available`}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <button
                onClick={addPelletRow}
                style={{ marginTop: 8, fontSize: 12, color: '#2d6a4f', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
              >
                <Plus size={14} /> Add Pellet Type
              </button>
            </div>

            {/* Serial Number (from weighbridge slip) */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Serial Number
              </label>
              <input
                type="text"
                placeholder="Slip serial #"
                value={form.serial_no}
                onChange={e => updateForm('serial_no', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
              />
            </div>

            {/* Invoice Number */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                Invoice Number <span style={{ color: '#D32F2F' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Invoice #"
                value={form.invoice_number}
                onChange={e => updateForm('invoice_number', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
              />
            </div>

            {/* Loading Date + Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                  Loading Date <span style={{ color: '#D32F2F' }}>*</span>
                </label>
                <input
                  type="date"
                  value={form.loading_date}
                  onChange={e => updateForm('loading_date', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                  Loading Time <span style={{ color: '#D32F2F' }}>*</span>
                </label>
                <input
                  type="time"
                  value={form.loading_time}
                  onChange={e => updateForm('loading_time', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                />
              </div>
            </div>

            {/* Dispatch Date + Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                  Dispatch Date <span style={{ color: '#D32F2F' }}>*</span>
                </label>
                <input
                  type="date"
                  value={form.dispatch_date}
                  onChange={e => updateForm('dispatch_date', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6 }}>
                  Dispatch Time <span style={{ color: '#D32F2F' }}>*</span>
                </label>
                <input
                  type="time"
                  value={form.dispatch_time}
                  onChange={e => updateForm('dispatch_time', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none' }}
                />
              </div>
            </div>

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

      {/* Add Transporter Modal (shared with Settings + Purchase) */}
      <AddTransporterModal
        isOpen={showAddTransporter}
        onClose={() => setShowAddTransporter(false)}
        orgId={plant?.org_id}
        onAdded={t => {
          queryClient.invalidateQueries({ queryKey: ['transporters', plant?.org_id] })
          updateForm('transporter_id', t.id)
          updateForm('transporter', t.name)
        }}
      />
    </div>
  )
}
