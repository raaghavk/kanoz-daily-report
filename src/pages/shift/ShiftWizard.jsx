import { useState, useEffect, useMemo, useCallback, useRef, Component } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Stepper from '../../components/Stepper'
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle } from 'lucide-react'
import ConfirmDialog from '../../components/ConfirmDialog'
import PageHeader from '../../components/PageHeader'
import { sanitizeText, sanitizeNumber } from '../../lib/sanitize'
import { getLocalDate } from '../../lib/dateUtils'
import { getValidationErrors } from './validation'
import Step1Header from './Step1Header'
import Step2Machines from './Step2Machines'
import Step3RawMaterialMix from './Step3RawMaterialMix'
import Step4Production from './Step4Production'
import Step5RawMaterialReview from './Step5RawMaterialReview'
import Step5Diesel from './Step5Diesel'
import Step6Dispatch from './Step6Dispatch'
import Step7PelletStock from './Step7PelletStock'
import Step8Issues from './Step8Issues'
import Step9Submit from './Step9Submit'
import StepProcessing, { computeProcessingDeltas } from './StepProcessing'

const STEPS = [
  { num: 1, title: 'Report Header', component: Step1Header },
  { num: 2, title: 'Machine Timings', component: Step2Machines },
  { num: 3, title: 'Raw Material & Mix', component: Step3RawMaterialMix },
  { num: 4, title: 'In-House Processing', component: StepProcessing },
  { num: 5, title: 'Production', component: Step4Production },
  { num: 6, title: 'RM & Mix Review', component: Step5RawMaterialReview },
  { num: 7, title: 'Equipment & Diesel', component: Step5Diesel },
  { num: 8, title: 'Dispatch Summary', component: Step6Dispatch },
  { num: 9, title: 'Pellet Stock', component: Step7PelletStock },
  { num: 10, title: 'Issues', component: Step8Issues },
  { num: 11, title: 'Submit', component: Step9Submit },
]

const WIZARD_STORAGE_KEY = 'kanoz_shift_wizard_state'

// Fold in-house processing runs into raw material stock.
//  - `used` on each row is mix-only consumption; processing input is added on top
//  - `produced` captures in-house output (e.g. Saw Dust made this shift)
//  - closing = opening + purchased + produced - used(mix) - processing input
// Idempotent: derives everything from opening/purchased/used + processing.
function foldProcessingIntoRawMaterials(rawMaterials, processing) {
  const deltas = computeProcessingDeltas(processing, rawMaterials)
  return (rawMaterials || []).map(rm => {
    const d = deltas[rm.id] || { produced: 0, procUsed: 0 }
    const opening = parseFloat(rm.opening) || 0
    const purchased = parseFloat(rm.purchased) || 0
    const mixUsed = parseFloat(rm.used) || 0
    const produced = d.produced || 0
    const procUsed = d.procUsed || 0
    return {
      ...rm,
      produced,
      closing: opening + purchased + produced - mixUsed - procUsed,
    }
  })
}

// Error boundary to catch render errors in individual steps and show an error
// message instead of a blank screen. key={step} resets it on every step change.
class StepErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[ShiftWizard] Step render error:', error, info?.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#fee2e2', borderRadius: 12, margin: 8, border: '1.5px solid #d32f2f' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#d32f2f', marginBottom: 8 }}>⚠️ Something went wrong on this step</div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', background: '#fff', padding: 10, borderRadius: 8, wordBreak: 'break-word', color: '#2c2c2c', marginBottom: 12 }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: '8px 16px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function ShiftWizard() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { employee, plant } = useAuth()
  const { id: editId } = useParams()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [reportId, setReportId] = useState(editId || null)
  const [restoredFromStorage, setRestoredFromStorage] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [initError, setInitError] = useState(null)
  const [processRoutes, setProcessRoutes] = useState([])

  // Report data state — shared across all steps
  const [reportData, setReportData] = useState({
    date: getLocalDate(),
    shift: 'A',
    start_time: '08:00',
    end_time: '20:00',
    shift_start_date: getLocalDate(),
    shift_end_date: getLocalDate(),
    start_power_reading: 0,
    end_power_reading: 0,
    machines: [],
    mixes: [],
    production: [],
    processing: [],
    rawMaterials: [],
    diesel: [],
    diesel_stock: { opening: 0, purchases: [], closing: 0 },
    dispatches: [],
    dispatchTotals: {},
    pelletStock: [],
    issues: [],
    handover_notes: '',
    remarks: '',
  })

  const updateData = useCallback((key, value) => {
    setReportData(prev => ({ ...prev, [key]: value }))
  }, [])

  // Save wizard state to localStorage (survives app close; iOS clears sessionStorage aggressively)
  const saveWizardState = useCallback(() => {
    try {
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({ reportData, step, reportId, savedAt: Date.now() }))
    } catch (e) {
      console.error('Failed to save wizard state:', e)
    }
  }, [reportData, step, reportId])

  // Restore from localStorage if returning from dispatch
  const [initDone, setInitDone] = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [pendingRestore, setPendingRestore] = useState(null)

  useEffect(() => {
    if (editId) { setInitDone(true); return }
    const returnToStep = location.state?.returnToStep
    try {
      const saved = localStorage.getItem(WIZARD_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const { reportData: savedData, step: savedStep, reportId: savedId, savedAt } = parsed
        if (savedData && (savedData.date || savedData.machines?.length > 0)) {
          const now = Date.now()
          const maxDraftAge = 24 * 60 * 60 * 1000
          const isExpired = savedAt && (now - savedAt > maxDraftAge)
          const today = getLocalDate()
          const savedDate = savedData.shift_start_date || savedData.date
          const isDifferentDay = savedDate && savedDate !== today

          // If returning from dispatch creation (returnToStep), always restore immediately
          if (returnToStep) {
            setReportData({ ...savedData, processing: savedData.processing || [] })
            setStep(returnToStep)
            if (savedId) setReportId(savedId)
            setRestoredFromStorage(true)
            setInitDone(true)
            return
          }

          // Discard stale drafts (older than 24h) instead of prompting
          if (isExpired) {
            localStorage.removeItem(WIZARD_STORAGE_KEY)
            setInitDone(true)
            return
          }

          // Ask user before restoring any saved draft to avoid accidental reuse
          // of prior in-progress data for "fresh" new entries.
          setPendingRestore({ savedData, savedStep, savedId, savedDate, isExpired, isDifferentDay })
          setShowResumePrompt(true)
          setInitDone(true)
          return
        }
      }
    } catch (e) {
      console.error('Failed to restore wizard state:', e)
    }
    setInitDone(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResume = useCallback(() => {
    if (pendingRestore) {
      setReportData({ ...pendingRestore.savedData, processing: pendingRestore.savedData.processing || [] })
      setStep(pendingRestore.savedStep || 1)
      if (pendingRestore.savedId) setReportId(pendingRestore.savedId)
      setRestoredFromStorage(true)
    }
    setShowResumePrompt(false)
    setPendingRestore(null)
  }, [pendingRestore])

  const handleStartFresh = useCallback(() => {
    localStorage.removeItem(WIZARD_STORAGE_KEY)
    setShowResumePrompt(false)
    setPendingRestore(null)
  }, [])

  const [duplicateReportId, setDuplicateReportId] = useState(null)

  // Auto-save wizard state to localStorage on changes (so it survives navigation/app close)
  useEffect(() => {
    if (!initDone || editId) return
    try {
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({ reportData, step, reportId, savedAt: Date.now() }))
    } catch { /* ignore */ }
  }, [reportData, step, reportId, initDone, editId])

  // Also save when app goes to background (mobile app switch) or page unloads
  // Use a ref to always have latest state — avoids stale closure bug
  const stateRef = useRef({ reportData, step, reportId })
  useEffect(() => {
    stateRef.current = { reportData, step, reportId }
  }, [reportData, step, reportId])

  useEffect(() => {
    if (!initDone || editId) return
    function saveOnHide() {
      try {
        const payload = { ...stateRef.current, savedAt: Date.now() }
        localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(payload))
      } catch { /* ignore */ }
    }
    function handleVisChange() { if (document.hidden) saveOnHide() }
    document.addEventListener('visibilitychange', handleVisChange)
    window.addEventListener('beforeunload', saveOnHide)
    window.addEventListener('pagehide', saveOnHide)
    return () => {
      document.removeEventListener('visibilitychange', handleVisChange)
      window.removeEventListener('beforeunload', saveOnHide)
      window.removeEventListener('pagehide', saveOnHide)
    }
  }, [initDone, editId])

  // Unified Loader Effect: runs on mount / plant context load and handles both Edit and New paths cleanly
  useEffect(() => {
    if (!plant?.id || !initDone) return

    // Skip initialization if we successfully restored a draft from local storage
    if (restoredFromStorage && !editId) {
      setLoadingData(false)
      return
    }

    let cancelled = false

    async function loadData() {
      try {
        setLoadingData(true)
        setInitError(null)

        // 1. Fetch active configurations (reference lists) in parallel
        const [machinesRes, materialsRes, pelletTypesRes, equipmentRes, routesRes] = await Promise.all([
          supabase.from('machines').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
          supabase.from('raw_material_types').select('*').eq('plant_id', plant.id).eq('is_active', true),
          supabase.from('pellet_types').select('*').eq('plant_id', plant.id).eq('is_active', true),
          supabase.from('equipment').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
          supabase.from('process_routes').select('*, process_route_stages(*)').eq('plant_id', plant.id).eq('is_active', true),
        ])

        if (machinesRes.error) throw machinesRes.error
        if (materialsRes.error) throw materialsRes.error
        if (pelletTypesRes.error) throw pelletTypesRes.error
        if (equipmentRes.error) throw equipmentRes.error
        if (routesRes.error) throw routesRes.error

        const activeRoutes = (routesRes.data || []).map(rt => ({
          ...rt,
          process_route_stages: [...(rt.process_route_stages || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0)),
        }))
        if (!cancelled) setProcessRoutes(activeRoutes)

        let freshReportData = {
          date: getLocalDate(),
          shift: 'A',
          start_time: '08:00',
          end_time: '20:00',
          shift_start_date: getLocalDate(),
          shift_end_date: getLocalDate(),
          start_power_reading: 0,
          end_power_reading: 0,
          machines: [],
          mixes: [],
          production: [],
          processing: [],
          rawMaterials: [],
          diesel: [],
          diesel_stock: { opening: 0, purchases: [], closing: 0 },
          dispatches: [],
          dispatchTotals: {},
          pelletStock: [],
          issues: [],
          handover_notes: '',
          remarks: '',
        }

        // Initialize active database lists as base
        const activeMachines = (machinesRes.data || []).map(m => ({
          id: m.id, name: m.name, machine_type: m.machine_type ?? null, did_not_run: true, from_time: '', to_time: '', breakdown_hrs: 0, production_hours: 0, remarks: '',
        }))
        const activeRawMaterials = (materialsRes.data || []).map(m => ({
          id: m.id, name: m.name, gcv_kcal_kg: m.gcv_kcal_kg ?? null, opening_stock_kg: m.opening_stock_kg ?? 0, opening: 0, purchased: 0, used: 0, closing: 0
        }))
        const activePellets = (pelletTypesRes.data || []).map(p => ({
          id: p.id, name: p.name, opening_stock_mt: p.opening_stock_mt ?? 0, opening: 0, production: 0, dispatch: 0, wastage: 0, closing: 0
        }))
        const activeDiesel = (equipmentRes.data || []).map(eq => ({
          id: eq.id, equipment_name: eq.name, equipment_type: eq.equipment_type ?? null, opening_stock_litres: eq.opening_stock_litres ?? 0, opening: 0, added: 0, used: 0, closing: 0, hours: 0, avg_per_hr: 0, collapsed: true,
        }))

        if (editId) {
          // ================= EDIT REPORT PATH =================
          const { data: report, error: reportErr } = await supabase
            .from('shift_reports')
            .select('*')
            .eq('id', editId)
            .single()

          if (reportErr) throw reportErr
          if (!report) throw new Error('Shift report not found')

          setReportId(editId)
          freshReportData.date = report.date
          freshReportData.shift = report.shift
          freshReportData.start_time = report.start_time || '08:00'
          freshReportData.end_time = report.end_time || '20:00'
          freshReportData.shift_start_date = report.shift_start_date || report.date
          freshReportData.shift_end_date = report.shift_end_date || report.date
          freshReportData.start_power_reading = report.start_power_reading || 0
          freshReportData.end_power_reading = report.end_power_reading || 0
          freshReportData.handover_notes = report.handover_notes || ''
          freshReportData.remarks = report.remarks || ''

          // Load all child tables in parallel
          const [machProd, rmUsage, diesel, pStock, issuesData, dStock, dPurchases, mixesRes, processingRes] = await Promise.all([
            supabase.from('machine_production').select('*, machines(name)').eq('shift_report_id', editId),
            supabase.from('raw_material_usage').select('*, raw_material_types(name)').eq('shift_report_id', editId),
            supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', editId),
            supabase.from('pellet_stock').select('*, pellet_types(name)').eq('shift_report_id', editId),
            supabase.from('issues').select('*').eq('shift_report_id', editId),
            supabase.from('diesel_stock').select('*').eq('shift_report_id', editId).maybeSingle(),
            supabase.from('diesel_purchases').select('*').eq('shift_report_id', editId),
            supabase.from('shift_mixes').select('*, shift_mix_compositions(*), shift_mix_machine_usage(*)').eq('shift_report_id', editId),
            supabase.from('processing_runs').select('*').eq('shift_report_id', editId),
          ])

          if (machProd.error) throw machProd.error
          if (rmUsage.error) throw rmUsage.error
          if (diesel.error) throw diesel.error
          if (pStock.error) throw pStock.error
          if (issuesData.error) throw issuesData.error
          if (mixesRes.error) throw mixesRes.error
          if (processingRes?.error) throw processingRes.error

          // Hydrate in-house processing runs (route-based). Resolve material
          // ids from the route when present, else fall back to name lookup, so
          // computeProcessingDeltas keeps matching the raw material rows.
          freshReportData.processing = (processingRes?.data || []).map(pr => {
            const route = activeRoutes.find(rt => rt.id === pr.route_id)
            const stages = route
              ? (route.process_route_stages || []).map(st => ({ seq: st.seq, machine_id: st.machine_id, machine_name: st.machine_name }))
              : []
            let machineHours = {}
            if (pr.machine_hours && typeof pr.machine_hours === 'object') machineHours = { ...pr.machine_hours }
            else if (typeof pr.machine_hours === 'string') { try { machineHours = JSON.parse(pr.machine_hours) || {} } catch (e) { machineHours = {} } }
            const inId = (route && route.input_material_type_id) || (activeRawMaterials.find(rm => rm.name === pr.input_material) || {}).id || null
            const outId = (route && route.output_material_type_id) || (activeRawMaterials.find(rm => rm.name === pr.output_material) || {}).id || null
            return {
              local_id: 'proc_' + pr.id,
              db_id: pr.id,
              route_id: pr.route_id || null,
              route_name: route ? route.name : null,
              input_material: pr.input_material || (route ? route.input_material_name : '') || '',
              input_material_id: inId,
              input_material_type_id: inId,
              input_kg: pr.input_kg != null ? parseFloat(pr.input_kg) : '',
              output_material: pr.output_material || (route ? route.output_material_name : '') || '',
              output_material_id: outId,
              output_material_type_id: outId,
              output_kg: pr.output_kg != null ? parseFloat(pr.output_kg) : '',
              expected_yield_pct: route && route.expected_yield_pct != null ? parseFloat(route.expected_yield_pct) : null,
              stages,
              machine_hours: machineHours,
              note: pr.note || '',
            }
          })

          // Merge machines production
          freshReportData.machines = activeMachines.map(m => {
            const prod = (machProd.data || []).find(mp => mp.machine_id === m.id)
            if (prod) {
              return {
                ...m,
                did_not_run: prod.did_not_run || false,
                production_hours: parseFloat(prod.hours_run) || 0,
                total_hours: parseFloat(prod.total_hours) || parseFloat(prod.hours_run) || 0,
                from_time: prod.from_time || '',
                to_time: prod.to_time || '',
                breakdown_hrs: parseFloat(prod.breakdown_hours) || 0,
                remarks: prod.remarks || '',
              }
            }
            return m
          })

          // Merge raw material usage. Saved quantity_kg is TOTAL consumed
          // (mix + in-house processing input). Recover mix-only `used` by
          // subtracting this shift's processing input so the fold below is
          // idempotent (closing recomputes to the saved value).
          {
            const procDeltas = computeProcessingDeltas(freshReportData.processing, activeRawMaterials)
            freshReportData.rawMaterials = activeRawMaterials.map(m => {
              const rmData = (rmUsage.data || []).find(r => r.raw_material_type_id === m.id)
              const totalUsed = rmData ? parseFloat(rmData.quantity_kg) || 0 : 0
              const procUsed = (procDeltas[m.id] || {}).procUsed || 0
              return {
                ...m,
                opening: rmData ? parseFloat(rmData.opening_kg) || 0 : 0,
                purchased: rmData ? parseFloat(rmData.purchased_kg) || 0 : 0,
                used: Math.max(0, totalUsed - procUsed),
                closing: rmData ? parseFloat(rmData.closing_kg) || 0 : 0,
              }
            })
          }

          // Merge pellet stock
          freshReportData.pelletStock = activePellets.map(p => {
            const psData = (pStock.data || []).find(ps => ps.pellet_type_id === p.id)
            return {
              ...p,
              opening: psData ? parseFloat(psData.opening_mt) || 0 : 0,
              production: psData ? parseFloat(psData.production_mt) || 0 : 0,
              dispatch: psData ? parseFloat(psData.dispatch_mt) || 0 : 0,
              wastage: psData ? parseFloat(psData.wastage_mt) || 0 : 0,
              closing: psData ? parseFloat(psData.closing_mt) || 0 : 0,
            }
          })

          // Retain deactivated/deleted pellet stocks to prevent data loss
          const knownTypeIds = new Set(activePellets.map(p => p.id))
          for (const ps of (pStock.data || [])) {
            if (ps.pellet_type_id && !knownTypeIds.has(ps.pellet_type_id)) {
              freshReportData.pelletStock.push({
                id: ps.pellet_type_id,
                name: ps.pellet_types?.name || 'Unknown type',
                opening: parseFloat(ps.opening_mt) || 0,
                production: parseFloat(ps.production_mt) || 0,
                dispatch: parseFloat(ps.dispatch_mt) || 0,
                wastage: parseFloat(ps.wastage_mt) || 0,
                closing: parseFloat(ps.closing_mt) || 0,
              })
            }
          }

          // Merge equipment diesel
          freshReportData.diesel = activeDiesel.map(eq => {
            const dieselData = (diesel.data || []).find(d => d.equipment_name === eq.equipment_name)
            return {
              ...eq,
              opening: dieselData ? parseFloat(dieselData.opening_litres) || 0 : 0,
              added: dieselData ? parseFloat(dieselData.added_litres) || 0 : 0,
              used: dieselData ? (parseFloat(dieselData.opening_litres) || 0) + (parseFloat(dieselData.added_litres) || 0) - (parseFloat(dieselData.closing_litres) || 0) : 0,
              closing: dieselData ? parseFloat(dieselData.closing_litres) || 0 : 0,
              hours: dieselData ? parseFloat(dieselData.hours_worked) || 0 : 0,
            }
          })

          // Merge mixes
          if (mixesRes.data?.length) {
            freshReportData.mixes = mixesRes.data.map(m => ({
              local_id: 'mix_' + m.id,
              db_id: m.id,
              name: m.name,
              type: m.type,
              derived_pellet_name: m.derived_pellet_name || m.type || null,
              derived_gcv: m.derived_gcv != null ? parseFloat(m.derived_gcv) : null,
              derived_grade: m.derived_grade || null,
              opening_kg: parseFloat(m.opening_kg) || 0,
              prepared_kg: parseFloat(m.prepared_kg) || 0,
              used_kg: parseFloat(m.used_kg) || 0,
              ingredients: (m.shift_mix_compositions || []).map(c => ({
                raw_material_type_id: c.raw_material_type_id,
                name: c.raw_material_name,
                quantity_kg: parseFloat(c.quantity_kg) || 0,
              })),
              consumed_ingredients: (parseFloat(m.prepared_kg) || 0) > 0
                ? (m.shift_mix_compositions || []).map(c => ({
                    raw_material_type_id: c.raw_material_type_id,
                    name: c.raw_material_name,
                    quantity_kg: parseFloat(c.quantity_kg) || 0,
                  }))
                : [],
            }))

            if (machProd.data?.length) {
              freshReportData.production = machProd.data
                .filter(mp => !mp.did_not_run)
                .map(mp => {
                  const mixUsages = freshReportData.mixes.flatMap(mix =>
                    (mix.db_id ? mixesRes.data.find(m => m.id === mix.db_id)?.shift_mix_machine_usage || [] : [])
                      .filter(u => u.machine_id === mp.machine_id)
                      .map(u => ({ mix_local_id: mix.local_id, quantity_kg: parseFloat(u.quantity_kg) || 0 }))
                  )
                  return {
                    id: mp.id,
                    machine_id: mp.machine_id,
                    machine_name: mp.machines?.name || 'Unknown',
                    quantity: parseFloat(mp.production_mt) || 0,
                    mix_usages: mixUsages,
                  }
                })
            }
          } else if (machProd.data?.length) {
            freshReportData.production = machProd.data
              .filter(mp => !mp.did_not_run)
              .map(mp => ({
                id: mp.id,
                machine_id: mp.machine_id,
                machine_name: mp.machines?.name || 'Unknown',
                quantity: parseFloat(mp.production_mt) || 0,
                mix_usages: [],
              }))
          }

          // Merge issues
          if (issuesData.data?.length) {
            freshReportData.issues = issuesData.data.map(i => ({
              id: i.id,
              type: i.issue_type,
              description: i.description,
              severity: i.severity,
              photo_url: i.photo_url,
            }))
          }

          // Merge diesel stock
          if (dStock.data) {
            const purchases = (dPurchases.data || []).map(dp => ({
              litres: parseFloat(dp.litres) || 0,
              cost_per_litre: parseFloat(dp.cost_per_litre) || 0,
              receipt_url: dp.receipt_url || null,
            }))
            freshReportData.diesel_stock = {
              opening: parseFloat(dStock.data.opening_litres) || 0,
              purchases,
              closing: parseFloat(dStock.data.closing_litres) || 0,
            }
          }
        } else {
          // ================= NEW REPORT PATH =================
          // Fetch previous shift report for carry-forward values
          const { data: prevReport } = await supabase
            .from('shift_reports')
            .select('id, date')
            .eq('plant_id', plant.id)
            .eq('is_deleted', false)
            .order('date', { ascending: false })
            .order('shift', { ascending: false })
            .limit(1)
            .maybeSingle()

          let prevPelletStock = []
          let prevDieselLog = []
          let prevRawMaterials = []
          let prevDieselStock = null
          let prevMixes = []

          if (prevReport) {
            const [psRes, dlRes, rmRes, dsRes, mixRes] = await Promise.all([
              supabase.from('pellet_stock').select('*').eq('shift_report_id', prevReport.id),
              supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', prevReport.id),
              supabase.from('raw_material_usage').select('*').eq('shift_report_id', prevReport.id),
              supabase.from('diesel_stock').select('*').eq('shift_report_id', prevReport.id).maybeSingle(),
              supabase.from('shift_mixes').select('*, shift_mix_compositions(*)').eq('shift_report_id', prevReport.id),
            ])
            prevPelletStock = psRes.data || []
            prevDieselLog = dlRes.data || []
            prevRawMaterials = rmRes.data || []
            prevDieselStock = dsRes.data
            prevMixes = mixRes.data || []
          }

          // Carry forward mix opening stock (only mixes with remaining stock)
          if (prevMixes.length > 0) {
            freshReportData.mixes = prevMixes
              .filter(m => (parseFloat(m.closing_kg) || 0) > 0)
              .map(m => ({
                local_id: 'mix_' + Date.now() + '_' + Math.random().toString(36).slice(2),
                db_id: null,
                name: m.name,
                type: m.type,
                derived_pellet_name: m.derived_pellet_name || m.type || null,
                derived_gcv: m.derived_gcv != null ? parseFloat(m.derived_gcv) : null,
                derived_grade: m.derived_grade || null,
                opening_kg: parseFloat(m.closing_kg) || 0,
                prepared_kg: 0,
                consumed_ingredients: [],
                isCarryForward: true,
                recipeIngredients: (m.shift_mix_compositions || []).map(c => ({
                  raw_material_type_id: c.raw_material_type_id,
                  name: c.raw_material_name,
                  quantity_kg: parseFloat(c.quantity_kg) || 0,
                })),
                ingredients: (m.shift_mix_compositions || []).map(c => ({
                  raw_material_type_id: c.raw_material_type_id,
                  name: c.raw_material_name,
                  quantity_kg: parseFloat(c.quantity_kg) || 0,
                })),
              }))
          }

          // Machines
          freshReportData.machines = activeMachines

          // Roll the raw-material PURCHASES ledger (Purchases module) into opening/purchased
          // so recorded purchases show up even before the first shift report exists.
          // Purchases dated before this shift's date -> opening; on this shift's date -> purchased.
          // Lower-bounded by the previous report's date so each purchase is counted exactly once.
          const shiftDate = freshReportData.shift_start_date
          const prevDate = prevReport?.date || null
          // The opening_stock figures are as of this date; purchases before it are already
          // inside the opening and must NOT be added again.
          const stockAsOf = plant?.stock_opening_date || null
          const openingAdd = {}
          const purchasedAdd = {}
          {
            // Resolve purchases to a material id by id first, else by name — matching
            // exactly how the Stock screen aggregates the ledger, so the two never diverge.
            const normNm = (x) => (x || '').toString().trim().toLowerCase()
            const idByName = {}
            for (const rm of activeRawMaterials) idByName[normNm(rm.name)] = rm.id
            let pq = supabase
              .from('raw_material_purchases')
              .select('raw_material_type_id, raw_material_type, date, quantity_kg')
              .eq('plant_id', plant.id)
              .eq('is_deleted', false)
              .lte('date', shiftDate)
            if (stockAsOf) pq = pq.gte('date', stockAsOf)
            if (prevDate) pq = pq.gt('date', prevDate)
            const { data: purchLedger } = await pq
            for (const p of (purchLedger || [])) {
              const id = p.raw_material_type_id || idByName[normNm(p.raw_material_type)]
              if (!id) continue
              const qty = parseFloat(p.quantity_kg) || 0
              if (p.date < shiftDate) openingAdd[id] = (openingAdd[id] || 0) + qty
              else purchasedAdd[id] = (purchasedAdd[id] || 0) + qty
            }
          }

          // Carry forward raw materials (closing stock -> opening stock).
          // First-ever shift (no previous): fall back to the opening_stock_kg
          // configured in plant settings (pre-app stock on hand), plus any ledger purchases.
          freshReportData.rawMaterials = activeRawMaterials.map(m => {
            const prev = prevRawMaterials.find(r => r.raw_material_type_id === m.id)
            const base = prev ? (parseFloat(prev.closing_kg) || 0) : (parseFloat(m.opening_stock_kg) || 0)
            const opening = base + (openingAdd[m.id] || 0)
            const purchased = purchasedAdd[m.id] || 0
            return { ...m, opening, purchased, closing: opening + purchased }
          })

          // Carry forward pellet stock
          freshReportData.pelletStock = activePellets.map(p => {
            const prev = prevPelletStock.find(ps => ps.pellet_type_id === p.id)
            const opening = prev ? (parseFloat(prev.closing_mt) || 0) : (parseFloat(p.opening_stock_mt) || 0)
            return { ...p, opening, closing: opening }
          })

          // Carry forward diesel log
          freshReportData.diesel = activeDiesel.map(eq => {
            const prev = prevDieselLog.find(d => d.equipment_name === eq.equipment_name)
            const opening = prev ? (parseFloat(prev.closing_litres) || 0) : (parseFloat(eq.opening_stock_litres) || 0)
            return { ...eq, opening, closing: opening }
          })

          // Carry forward diesel stock overall tank
          if (prevDieselStock) {
            freshReportData.diesel_stock = {
              opening: parseFloat(prevDieselStock.closing_litres) || 0,
              purchases: [],
              closing: parseFloat(prevDieselStock.closing_litres) || 0,
            }
          }
        }

        if (!cancelled) {
          // Reflect in-house processing in raw material stock (produced + closing)
          freshReportData.rawMaterials = foldProcessingIntoRawMaterials(freshReportData.rawMaterials, freshReportData.processing)
          setReportData(freshReportData)
          setLoadingData(false)
        }
      } catch (err) {
        console.error('[ShiftWizard] Unified Data Loader Error:', err)
        if (!cancelled) {
          setInitError(err.message || 'Failed to initialize shift report data')
          setLoadingData(false)
        }
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [plant?.id, editId, initDone, restoredFromStorage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live duplicate shift report detector for Step 1
  useEffect(() => {
    if (editId || !plant?.id || !reportData.date || !reportData.shift) {
      setDuplicateReportId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('shift_reports')
          .select('id')
          .eq('plant_id', plant.id)
          .eq('date', reportData.date)
          .eq('shift', reportData.shift)
          .eq('is_deleted', false)
          .maybeSingle()
        if (error) throw error
        if (!cancelled) {
          setDuplicateReportId(data?.id || null)
        }
      } catch (err) {
        console.error('Duplicate report check error:', err)
      }
    })()
    return () => { cancelled = true }
  }, [reportData.date, reportData.shift, plant?.id, editId])

  // Validation is handled by the extracted getValidationErrors(reportData) function

  async function saveReport() {
    if (saving) return
    const errors = getValidationErrors(reportData)
    if (errors.length > 0) {
      showToast(`Please fix ${errors.length} issue${errors.length > 1 ? 's' : ''} before submitting (check Steps ${[...new Set(errors.map(e => e.step))].join(', ')})`, 'error')
      return
    }
    setSaving(true)
    try {
      // Create or update the shift report
      const reportPayload = {
        plant_id: plant.id,
        date: reportData.shift_end_date || reportData.shift_start_date || reportData.date,
        shift: reportData.shift,
        start_time: reportData.start_time,
        end_time: reportData.end_time,
        shift_start_date: reportData.shift_start_date,
        shift_end_date: reportData.shift_end_date,
        start_power_reading: sanitizeNumber(reportData.start_power_reading) || 0,
        end_power_reading: sanitizeNumber(reportData.end_power_reading) || 0,
        pellet_production_mt: reportData.production.reduce((sum, p) => sum + sanitizeNumber(p.quantity), 0),
        handover_notes: sanitizeText(reportData.handover_notes, 1000),
        remarks: sanitizeText(reportData.remarks, 1000),
      }

      let report
      if (reportId) {
        const { data, error } = await supabase.from('shift_reports').update({ ...reportPayload, updated_at: new Date().toISOString(), last_edited_by: employee?.id }).eq('id', reportId).select().single()
        if (error) throw error
        report = data
      } else {
        const { data, error } = await supabase.from('shift_reports').insert({ ...reportPayload, supervisor_id: employee?.id, created_by: employee?.id }).select().single()
        if (error) throw error
        report = data
        setReportId(report.id)
      }

      // Helper: derive pellet_type_name for a machine from its mix usages.
      // Uses each mix's derived pellet name (falls back to mix.type). If a
      // machine ran mixes with different names, the mix contributing the most
      // kg wins — no hardcoded fallback names.
      function derivePelletType(machineId) {
        const mixName = m => m?.derived_pellet_name || m?.type || null
        const machineEntries = reportData.production.filter(p => p.machine_id === machineId)
        const kgByName = {}
        machineEntries.forEach(p => {
          (p.mix_usages || []).forEach(u => {
            const name = mixName((reportData.mixes || []).find(m => m.local_id === u.mix_local_id))
            if (!name) return
            kgByName[name] = (kgByName[name] || 0) + sanitizeNumber(u.quantity_kg)
          })
        })
        const names = Object.keys(kgByName)
        if (names.length === 0) {
          // Fall back: use first mix name in this shift (avoids null when mix_usages not set)
          return mixName((reportData.mixes || []).find(m => mixName(m)))
        }
        return names.reduce((a, b) => (kgByName[b] > kgByName[a] ? b : a))
      }

      // Save machine production
      if (reportData.machines.length) {
        const { error: mDelErr } = await supabase.from('machine_production').delete().eq('shift_report_id', report.id)
        if (mDelErr) throw mDelErr
        
        const machineRows = reportData.machines
          .filter(m => m.did_not_run || sanitizeNumber(m.production_hours) > 0 || sanitizeNumber(m.total_hours) > 0 || m.from_time || m.to_time)
          .map(m => ({
            shift_report_id: report.id,
            machine_id: m.id,
            did_not_run: m.did_not_run || false,
            hours_run: sanitizeNumber(m.production_hours) || sanitizeNumber(m.total_hours),
            from_time: m.from_time || null,
            to_time: m.to_time || null,
            total_hours: sanitizeNumber(m.total_hours) || null,
            breakdown_hours: sanitizeNumber(m.breakdown_hrs) || 0,
            remarks: sanitizeText(m.remarks, 500),
            production_mt: reportData.production
              .filter(p => p.machine_id === m.id)
              .reduce((sum, p) => sum + sanitizeNumber(p.quantity), 0),
            pellet_type_name: derivePelletType(m.id),
          }))
        if (machineRows.length) {
          const { error: mInsErr } = await supabase.from('machine_production').insert(machineRows)
          if (mInsErr) throw mInsErr
        }
      }

      // Save mixes (shift_mixes + compositions + machine_usage)
      // shift_mix_compositions and shift_mix_machine_usage cascade-delete via FK when shift_mixes is deleted
      const { error: muDelErr } = await supabase.from('shift_mix_machine_usage').delete().eq('shift_report_id', report.id)
      if (muDelErr) throw muDelErr
      const { error: mxDelErr } = await supabase.from('shift_mixes').delete().eq('shift_report_id', report.id)
      if (mxDelErr) throw mxDelErr

      if ((reportData.mixes || []).length > 0) {
        for (const mix of reportData.mixes) {
          // Compute used_kg from production mix_usages
          const computedUsedKg = (reportData.production || []).reduce((sum, p) =>
            sum + (p.mix_usages || []).filter(u => u.mix_local_id === mix.local_id).reduce((s, u) => s + sanitizeNumber(u.quantity_kg), 0), 0)
          // Prefer manually overridden used_kg (set in Step 5) over computed
          const usedKg = (mix.used_kg !== undefined && mix.used_kg !== null) ? sanitizeNumber(mix.used_kg) : computedUsedKg
          const closingKg = (sanitizeNumber(mix.opening_kg) + sanitizeNumber(mix.prepared_kg)) - usedKg

          const { data: savedMix, error: mixErr } = await supabase.from('shift_mixes').insert({
            shift_report_id: report.id,
            plant_id: plant.id,
            org_id: plant.org_id,
            name: sanitizeText(mix.name, 100),
            type: sanitizeText(mix.type, 50),
            opening_kg: sanitizeNumber(mix.opening_kg),
            prepared_kg: sanitizeNumber(mix.prepared_kg),
            used_kg: usedKg,
            closing_kg: closingKg,
            derived_pellet_name: sanitizeText(mix.derived_pellet_name || mix.type, 100) || null,
            derived_gcv: mix.derived_gcv != null ? sanitizeNumber(mix.derived_gcv) : null,
            derived_grade: sanitizeText(mix.derived_grade, 20) || null,
          }).select().single()
          if (mixErr) throw mixErr

          // Save compositions
          if (mix.ingredients?.length > 0) {
            const compRows = mix.ingredients
              .filter(ing => ing.raw_material_type_id && sanitizeNumber(ing.quantity_kg) > 0)
              .map(ing => ({
                mix_id: savedMix.id,
                raw_material_type_id: ing.raw_material_type_id,
                raw_material_name: sanitizeText(ing.name, 100),
                quantity_kg: sanitizeNumber(ing.quantity_kg),
              }))
            if (compRows.length > 0) {
              const { error: compErr } = await supabase.from('shift_mix_compositions').insert(compRows)
              if (compErr) throw compErr
            }
          }

          // Save machine usages for this mix
          const machineUsageRows = []
          ;(reportData.production || []).forEach(p => {
            ;(p.mix_usages || []).filter(u => u.mix_local_id === mix.local_id && sanitizeNumber(u.quantity_kg) > 0).forEach(u => {
              machineUsageRows.push({
                mix_id: savedMix.id,
                shift_report_id: report.id,
                machine_id: p.machine_id,
                quantity_kg: sanitizeNumber(u.quantity_kg),
              })
            })
          })
          if (machineUsageRows.length > 0) {
            const { error: usageErr } = await supabase.from('shift_mix_machine_usage').insert(machineUsageRows)
            if (usageErr) throw usageErr
          }
        }
      }

      // Save raw material usage (with opening/closing for carry-forward).
      // Fold in-house processing: quantity_kg = mix used + processing input;
      // closing = opening + purchased + produced - mix used - processing input.
      const procDeltasSave = computeProcessingDeltas(reportData.processing, reportData.rawMaterials)
      if (reportData.rawMaterials.length) {
        const { error: rmDelErr } = await supabase.from('raw_material_usage').delete().eq('shift_report_id', report.id)
        if (rmDelErr) throw rmDelErr
        const rmRows = reportData.rawMaterials
          .map(rm => {
            const d = procDeltasSave[rm.id] || { produced: 0, procUsed: 0 }
            const opening = sanitizeNumber(rm.opening)
            const purchased = sanitizeNumber(rm.purchased)
            const mixUsed = sanitizeNumber(rm.used)
            const totalUsed = mixUsed + (d.procUsed || 0)
            const closing = opening + purchased + (d.produced || 0) - totalUsed
            return {
              shift_report_id: report.id,
              raw_material_type_id: rm.id,
              quantity_kg: totalUsed,
              opening_kg: opening,
              purchased_kg: purchased,
              closing_kg: closing,
            }
          })
        if (rmRows.length) {
          const { error: rmInsErr } = await supabase.from('raw_material_usage').insert(rmRows)
          if (rmInsErr) throw rmInsErr
        }
      }

      // Save in-house processing runs
      {
        const { error: prDelErr } = await supabase.from('processing_runs').delete().eq('shift_report_id', report.id)
        if (prDelErr) throw prDelErr
        const procRows = (reportData.processing || [])
          .filter(r => sanitizeNumber(r.input_kg) > 0 || sanitizeNumber(r.output_kg) > 0)
          .map(r => {
            const inKg = sanitizeNumber(r.input_kg)
            const outKg = sanitizeNumber(r.output_kg)
            // Sanitize per-machine hours into a clean { machine_id: number } jsonb.
            const machineHours = {}
            Object.entries(r.machine_hours || {}).forEach(([mid, hrs]) => {
              if (!mid) return
              const n = sanitizeNumber(hrs)
              if (n > 0) machineHours[mid] = n
            })
            return {
              shift_report_id: report.id,
              plant_id: plant.id,
              org_id: plant.org_id,
              route_id: r.route_id || null,
              input_material: sanitizeText(r.input_material, 100),
              input_kg: inKg,
              output_material: sanitizeText(r.output_material, 100),
              output_kg: outKg,
              yield_pct: inKg > 0 ? Math.round((outKg / inKg) * 10000) / 100 : null,
              machine_hours: machineHours,
              note: sanitizeText(r.note, 500) || null,
            }
          })
        if (procRows.length) {
          const { error: prInsErr } = await supabase.from('processing_runs').insert(procRows)
          if (prInsErr) throw prInsErr
        }
      }

      // Save equipment diesel log
      if (reportData.diesel && reportData.diesel.length) {
        const { error: dDelErr } = await supabase.from('equipment_diesel_log').delete().eq('shift_report_id', report.id)
        if (dDelErr) throw dDelErr
        const dieselRows = reportData.diesel
          .map(d => {
            const openL  = sanitizeNumber(d.opening)
            const addedL = sanitizeNumber(d.added)
            const usedL  = sanitizeNumber(d.used)
            // Always recompute closing at save time — never trust potentially stale form state
            const closeL = openL + addedL - usedL
            return {
              shift_report_id: report.id,
              equipment_name: sanitizeText(d.equipment_name, 100),
              opening_litres: openL,
              added_litres:   addedL,
              used_litres:    usedL,
              closing_litres: closeL,
              hours_worked:   sanitizeNumber(d.hours),
            }
          })
        if (dieselRows.length) {
          const { error: dInsErr } = await supabase.from('equipment_diesel_log').insert(dieselRows)
          if (dInsErr) throw dInsErr
        }
      }

      // Save pellet stock (all entries — closing_mt is GENERATED, don't insert it)
      if (reportData.pelletStock && reportData.pelletStock.length) {
        const { error: psDelErr } = await supabase.from('pellet_stock').delete().eq('shift_report_id', report.id)
        if (psDelErr) throw psDelErr
        const stockRows = reportData.pelletStock
          .map(ps => ({
            shift_report_id: report.id,
            pellet_type_id: ps.id,
            opening_mt: sanitizeNumber(ps.opening),
            production_mt: sanitizeNumber(ps.production),
            dispatch_mt: sanitizeNumber(ps.dispatch),
            wastage_mt: sanitizeNumber(ps.wastage),
          }))
        if (stockRows.length) {
          const { error: psInsErr } = await supabase.from('pellet_stock').insert(stockRows)
          if (psInsErr) throw psInsErr
        }
      }

      // Save issues
      if (reportData.issues.length) {
        const { error: isDelErr } = await supabase.from('issues').delete().eq('shift_report_id', report.id)
        if (isDelErr) throw isDelErr
        const issueRows = reportData.issues.map(i => ({
          shift_report_id: report.id,
          issue_type: sanitizeText(i.type, 50),
          description: sanitizeText(i.description, 1000),
          severity: sanitizeText(i.severity, 20),
          photo_url: i.photo_url,
        }))
        const { error: isInsErr } = await supabase.from('issues').insert(issueRows)
        if (isInsErr) throw isInsErr
      }

      // Save diesel stock (overall tank) + diesel purchases
      const { error: dpDelErr } = await supabase.from('diesel_purchases').delete().eq('shift_report_id', report.id)
      if (dpDelErr) throw dpDelErr
      const { error: dsDelErr } = await supabase.from('diesel_stock').delete().eq('shift_report_id', report.id)
      if (dsDelErr) throw dsDelErr
      const totalAddedToEquipment = (reportData.diesel || []).reduce((sum, eq) => sum + sanitizeNumber(eq.added), 0)
      const ds = reportData.diesel_stock || {}
      const purchases = ds.purchases || []
      const totalPurchased = purchases.reduce((sum, p) => sum + sanitizeNumber(p.litres), 0)
      const totalCost = purchases.reduce((sum, p) => {
        return sum + (sanitizeNumber(p.litres) * sanitizeNumber(p.cost_per_litre))
      }, 0)
      const dsOpening = sanitizeNumber(ds.opening)
      const { error: dsInsErr } = await supabase.from('diesel_stock').insert({
        shift_report_id: report.id,
        opening_litres: dsOpening,
        purchased_litres: totalPurchased,
        purchase_cost: totalCost,
        used_litres: totalAddedToEquipment,
        closing_litres: dsOpening + totalPurchased - totalAddedToEquipment,
      })
      if (dsInsErr) throw dsInsErr
      // Save individual purchase entries
      if (purchases.length > 0) {
        const purchaseRows = purchases
          .filter(p => sanitizeNumber(p.litres) > 0)
          .map(p => ({
            shift_report_id: report.id,
            litres: sanitizeNumber(p.litres),
            cost_per_litre: sanitizeNumber(p.cost_per_litre),
            total_cost: sanitizeNumber(p.litres) * sanitizeNumber(p.cost_per_litre),
            receipt_url: p.receipt_url || null,
            purchase_time: p.purchase_time || null,
          }))
        if (purchaseRows.length > 0) {
          const { error: dpInsErr } = await supabase.from('diesel_purchases').insert(purchaseRows)
          if (dpInsErr) throw dpInsErr
        }
      }

      // Link dispatches within this shift's time window to this shift report
      try {
        const normalizeTime = (t) => t ? t.substring(0, 5) : t
        const shiftStart = `${reportData.shift_start_date}T${normalizeTime(reportData.start_time)}:00`
        const shiftEnd = `${reportData.shift_end_date}T${normalizeTime(reportData.end_time)}:00`

        // Unlink any dispatches previously linked to this report
        await supabase.from('vehicle_dispatches')
          .update({ shift_report_id: null })
          .eq('shift_report_id', report.id)
          .eq('plant_id', plant.id)

        // Load dispatches in date range
        const { data: candidateDispatches } = await supabase
          .from('vehicle_dispatches')
          .select('id, date, dispatch_date, dispatch_time')
          .eq('plant_id', plant.id)
          .eq('is_deleted', false)
          .gte('date', reportData.shift_start_date)
          .lte('date', reportData.shift_end_date)

        if (candidateDispatches?.length) {
          const shiftStartDt = new Date(shiftStart)
          const shiftEndDt = new Date(shiftEnd)
          const toLink = candidateDispatches.filter(d => {
            const dDate = d.dispatch_date || d.date
            const dTime = d.dispatch_time || '00:00:00'
            const dt = new Date(`${dDate}T${dTime}`)
            return dt >= shiftStartDt && dt <= shiftEndDt
          }).map(d => d.id)

          if (toLink.length > 0) {
            await supabase.from('vehicle_dispatches')
              .update({ shift_report_id: report.id })
              .in('id', toLink)
          }
        }
      } catch (dispatchErr) {
        console.error('Dispatch linking error:', dispatchErr)
        // Non-critical — don't fail the whole save
      }

      localStorage.removeItem(WIZARD_STORAGE_KEY)
      showToast(editId ? 'Report updated!' : 'Report submitted!', 'success')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })

      // Send push notifications (non-blocking)
      import('../../lib/notifications').then(({ sendNotification }) => {
        if (!editId) {
          // New report submitted
          const totalMT = reportData.production.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
          sendNotification('report_submitted', {
            shift: reportData.shift,
            supervisor: employee?.name,
            production_mt: totalMT.toFixed(1),
            plant: plant?.name,
            date: reportData.date,
          })
        } else {
          // Existing report edited
          sendNotification('report_edited', {
            shift: reportData.shift,
            supervisor: employee?.name,
            plant: plant?.name,
            report_id: reportId,
          })
        }
        // Issue reported — fire once for the most severe issue
        const issues = (reportData.issues || []).filter(i => i.description?.trim())
        if (issues.length > 0) {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
          const sorted = [...issues].sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3))
          const top = sorted[0]
          sendNotification('issue_reported', {
            type: top.type,
            description: (top.description || '').slice(0, 60),
            severity: top.severity,
            count: issues.length,
            plant: plant?.name || '',
            report_id: reportId,
          })
        }
      }).catch(() => {})

      if (!editId) {

        // Auto-sync to Google Sheets (non-blocking)
        supabase.functions.invoke('sync-to-sheets', {
          body: { report_id: report.id },
        }).catch(() => {})
      }

      navigate('/')
    } catch (err) {
      console.error('Save error:', err)
      if (!reportId && err?.code === '23505' && String(err?.message || '').includes('shift_reports_plant_id_date_shift_key')) {
        showToast('A shift report for this plant/date/shift already exists. Opening it in edit mode.', 'error')
        try {
          const { data: existing } = await supabase
            .from('shift_reports')
            .select('id')
            .eq('plant_id', plant.id)
            .eq('date', reportData.date)
            .eq('shift', reportData.shift)
            .maybeSingle()
          if (existing?.id) {
            navigate(`/shift/edit/${existing.id}`)
            return
          }
        } catch (lookupErr) {
          console.error('Duplicate report lookup failed:', lookupErr)
        }
      }
      showToast(err.message || 'Failed to save report', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Hooks must run on every render — keep above the early returns below
  const allErrors = useMemo(() => {
    try {
      return getValidationErrors(reportData)
    } catch (e) {
      console.error('[ShiftWizard] Validation error:', e)
      return []
    }
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    reportData.date, reportData.shift, reportData.start_time, reportData.end_time,
    reportData.machines, reportData.production, reportData.rawMaterials
  ])
  const stepsWithErrors = useMemo(() => [...new Set(allErrors.map(e => e.step))], [allErrors])
  const currentWarnings = useMemo(() => allErrors.filter(e => e.step === step), [allErrors, step])

  if (loadingData) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fefae0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #2d6a4f', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 14, color: '#595c4a', fontWeight: 600 }}>Loading shift report data...</p>
        </div>
      </div>
    )
  }

  if (initError) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fefae0', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #fca5a5', padding: 24, maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#b91c1c', margin: '0 0 8px 0' }}>Failed to Load Data</h3>
          <p style={{ fontSize: 13, color: '#595c4a', lineHeight: 1.5, margin: '0 0 20px 0' }}>{initError}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: '#2d6a4f', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const CurrentStep = STEPS[step - 1].component

  return (
    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', background: '#f5edd6' }}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fefae0', width: '100%', maxWidth: 480, boxShadow: '0 0 40px rgba(0,0,0,0.08)' }}>
      <PageHeader
        title={STEPS[step - 1].title}
        subtitle={`${editId ? 'Editing · ' : ''}Step ${step} of ${STEPS.length} · ${plant?.name || 'Plant'} · Shift ${reportData.shift}`}
        onBack={() => {
          if (step === 1) {
            if (window.confirm('Stop editing? Any unsaved changes will be lost.')) {
              localStorage.removeItem(WIZARD_STORAGE_KEY)
              navigate('/')
            }
          } else {
            setStep(step - 1)
          }
        }}
      />

      <Stepper currentStep={step} onStepClick={setStep} stepsWithErrors={stepsWithErrors} />

      {/* Step Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px' }}>
          {/* Validation warnings for this step */}
          {currentWarnings.length > 0 && (
            <div style={{ background: '#fefae0', border: '1.5px solid #e9c46a', borderRadius: 12, padding: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={16} color="#d4a373" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: '#92400E' }}>
                {currentWarnings.map((w, i) => <div key={i}>{w.message}</div>)}
              </div>
            </div>
          )}
          <StepErrorBoundary key={step}>
            <CurrentStep
              data={reportData}
              updateData={updateData}
              plant={plant}
              employee={employee}
              routes={processRoutes}
              saveWizardState={saveWizardState}
              duplicateReportId={duplicateReportId}
            />
          </StepErrorBoundary>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 12, background: '#fff', borderTop: '1.5px solid #e5ddd0', padding: '16px 20px' }}>
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', border: '1.5px solid #e5ddd0', borderRadius: 14, fontSize: 14, fontWeight: 600, background: '#fff', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} /> Previous
          </button>
        )}
        {step < STEPS.length ? (
          <button
            onClick={() => setStep(step + 1)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => {
              if (allErrors.length > 0) {
                showToast(`Fix ${allErrors.length} issue${allErrors.length > 1 ? 's' : ''} before submitting (Steps: ${[...new Set(allErrors.map(e => e.step))].join(', ')})`, 'error')
                return
              }
              setShowConfirm(true)
            }}
            disabled={saving}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', background: allErrors.length > 0 ? '#d4a373' : '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {allErrors.length > 0 ? `Fix ${allErrors.length} Issue${allErrors.length > 1 ? 's' : ''} to Submit` : (editId ? 'Update Report' : 'Submit Report')}
          </button>
        )}
      </div>
      {/* Resume or Start Fresh prompt for stale wizard data */}
      {showResumePrompt && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 14, padding: 24,
              maxWidth: 360, width: '100%',
              boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={20} color="#d4a373" />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#2c2c2c', margin: 0 }}>
                Unsaved Report Found
              </h3>
            </div>
            <p style={{ fontSize: 13, color: '#595c4a', lineHeight: 1.5, margin: '0 0 8px 0' }}>
              You have an incomplete shift report
              {pendingRestore?.savedDate ? ` from ${new Date(pendingRestore.savedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}.
            </p>
            <p style={{ fontSize: 13, color: '#595c4a', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Would you like to continue where you left off, or start a new report?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleStartFresh}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  border: '1.5px solid #e5ddd0', background: '#fff',
                  fontSize: 13, fontWeight: 600, color: '#2c2c2c', cursor: 'pointer',
                }}
              >
                Start Fresh
              </button>
              <button
                onClick={handleResume}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  border: 'none', background: '#2d6a4f', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={saveReport}
        title={editId ? 'Update Report?' : 'Submit Report?'}
        message={editId ? 'Are you sure you want to update this shift report?' : 'Are you sure you want to submit this shift report? Please verify all entries are correct.'}
        confirmLabel={editId ? 'Update Report' : 'Submit Report'}
        variant="primary"
      />
    </div>
    </div>
  )
}
