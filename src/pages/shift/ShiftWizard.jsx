import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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

const STEPS = [
  { num: 1, title: 'Report Header', component: Step1Header },
  { num: 2, title: 'Machine Timings', component: Step2Machines },
  { num: 3, title: 'Raw Material & Mix', component: Step3RawMaterialMix },
  { num: 4, title: 'Production', component: Step4Production },
  { num: 5, title: 'RM & Mix Review', component: Step5RawMaterialReview },
  { num: 6, title: 'Equipment & Diesel', component: Step5Diesel },
  { num: 7, title: 'Dispatch Summary', component: Step6Dispatch },
  { num: 8, title: 'Pellet Stock', component: Step7PelletStock },
  { num: 9, title: 'Issues', component: Step8Issues },
  { num: 10, title: 'Submit', component: Step9Submit },
]

const WIZARD_STORAGE_KEY = 'kanoz_shift_wizard_state'

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

  // Save wizard state to sessionStorage (called before navigating away)
  const saveWizardState = useCallback(() => {
    try {
      sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({ reportData, step, reportId, savedAt: Date.now() }))
    } catch (e) {
      console.error('Failed to save wizard state:', e)
    }
  }, [reportData, step, reportId])

  // Restore from sessionStorage if returning from dispatch
  const [initDone, setInitDone] = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [pendingRestore, setPendingRestore] = useState(null)

  useEffect(() => {
    if (editId) { setInitDone(true); return }
    const returnToStep = location.state?.returnToStep
    try {
      const saved = sessionStorage.getItem(WIZARD_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const { reportData: savedData, step: savedStep, reportId: savedId, savedAt } = parsed
        if (savedData && (savedData.date || savedData.machines?.length > 0)) {
          const now = Date.now()
          const twelveHours = 12 * 60 * 60 * 1000
          const isExpired = savedAt && (now - savedAt > twelveHours)
          const today = getLocalDate()
          const savedDate = savedData.shift_start_date || savedData.date
          const isDifferentDay = savedDate && savedDate !== today

          // If returning from dispatch creation (returnToStep), always restore immediately
          if (returnToStep) {
            setReportData(savedData)
            setStep(returnToStep)
            if (savedId) setReportId(savedId)
            setRestoredFromStorage(true)
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
      setReportData(pendingRestore.savedData)
      setStep(pendingRestore.savedStep || 1)
      if (pendingRestore.savedId) setReportId(pendingRestore.savedId)
      setRestoredFromStorage(true)
    }
    setShowResumePrompt(false)
    setPendingRestore(null)
  }, [pendingRestore])

  const handleStartFresh = useCallback(() => {
    sessionStorage.removeItem(WIZARD_STORAGE_KEY)
    setShowResumePrompt(false)
    setPendingRestore(null)
  }, [])

  // Guard: only ever load plant data once per wizard session.
  // Without this, a plant reference change (AuthContext re-render) or a slow
  // async return from loadPlantData could fire again and wipe user-entered timings.
  const plantDataLoadedRef = useRef(false)
  useEffect(() => {
    if (plant?.id && initDone && !restoredFromStorage && !editId && !plantDataLoadedRef.current) {
      plantDataLoadedRef.current = true
      loadPlantData()
    }
  }, [plant, initDone, restoredFromStorage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save wizard state to sessionStorage on changes (so it survives navigation)
  useEffect(() => {
    if (!initDone || editId) return
    try {
      sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({ reportData, step, reportId, savedAt: Date.now() }))
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
        sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(payload))
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

  // For edit mode: load plant data first, then merge existing report on top
  useEffect(() => {
    if (editId && plant?.id) {
      loadPlantData().then(() => loadExistingReport())
    }
  }, [editId, plant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPlantData() {
    const [machinesRes, materialsRes, pelletTypesRes, equipmentRes] = await Promise.all([
      supabase.from('machines').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
      supabase.from('raw_material_types').select('*').eq('plant_id', plant.id).eq('is_active', true),
      supabase.from('pellet_types').select('*').eq('plant_id', plant.id).eq('is_active', true),
      supabase.from('equipment').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
    ])

    // Fetch previous shift data for carry-forward (opening = prev closing)
    let prevPelletStock = []
    let prevDieselLog = []
    let prevRawMaterials = []
    let prevDieselStock = null
    const { data: prevReport } = await supabase
      .from('shift_reports')
      .select('id')
      .eq('plant_id', plant.id)
      .order('date', { ascending: false })
      .order('shift', { ascending: false })
      .limit(1)
      .maybeSingle()

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

    // Carry forward mix opening stock from previous shift closing
    if (prevMixes.length > 0) {
      const carryForwardMixes = prevMixes.map(m => ({
        local_id: 'mix_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        db_id: null,
        name: m.name,
        type: m.type,
        opening_kg: parseFloat(m.closing_kg) || 0,
        prepared_kg: 0,
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
      updateData('mixes', carryForwardMixes)
    }

    if (machinesRes.data) {
      updateData('machines', machinesRes.data.map(m => ({
        id: m.id, name: m.name, from_time: '', to_time: '', breakdown_hrs: 0, production_hours: 0, remarks: '',
      })))
    }
    if (materialsRes.data) {
      updateData('rawMaterials', materialsRes.data.map(m => {
        const prev = prevRawMaterials.find(r => r.raw_material_type_id === m.id)
        const opening = prev ? parseFloat(prev.closing_kg) || 0 : 0
        return { id: m.id, name: m.name, opening, purchased: 0, used: 0, closing: opening }
      }))
    }
    if (pelletTypesRes.data) {
      updateData('pelletStock', pelletTypesRes.data.map(p => {
        const prev = prevPelletStock.find(ps => ps.pellet_type_id === p.id)
        const opening = prev ? parseFloat(prev.closing_mt) || 0 : 0
        return { id: p.id, name: p.name, opening, production: 0, dispatch: 0, wastage: 0, closing: opening }
      }))
    }
    if (equipmentRes.data) {
      updateData('diesel', equipmentRes.data.map(eq => {
        const prev = prevDieselLog.find(d => d.equipment_name === eq.name)
        const opening = prev ? parseFloat(prev.closing_litres) || 0 : 0
        return {
          id: eq.id, equipment_name: eq.name, opening, added: 0, used: 0,
          closing: opening, hours: 0, avg_per_hr: 0, collapsed: true,
        }
      }))
    }

    // Carry forward diesel stock tank opening from previous shift closing
    if (prevDieselStock) {
      updateData('diesel_stock', {
        opening: parseFloat(prevDieselStock.closing_litres) || 0,
        purchases: [],
        closing: parseFloat(prevDieselStock.closing_litres) || 0,
      })
    }
  }

  async function loadExistingReport() {
    try {
      const { data: report } = await supabase
        .from('shift_reports')
        .select('*')
        .eq('id', editId)
        .single()

      if (!report) { showToast('Report not found', 'error'); navigate('/'); return }

      setReportId(editId)
      updateData('date', report.date)
      updateData('shift', report.shift)
      updateData('start_time', report.start_time)
      updateData('end_time', report.end_time)
      updateData('shift_start_date', report.shift_start_date || report.date)
      updateData('shift_end_date', report.shift_end_date || report.date)
      updateData('start_power_reading', report.start_power_reading || 0)
      updateData('end_power_reading', report.end_power_reading || 0)
      updateData('handover_notes', report.handover_notes || '')
      updateData('remarks', report.remarks || '')

      // Load machines, materials, equipment first (needed for merging data)
      const [machinesRes, materialsRes, pelletTypesRes, equipmentRes, machProd, rmUsage, diesel, pStock, issuesData, dStock, dPurchases, mixesRes] = await Promise.all([
        supabase.from('machines').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
        supabase.from('raw_material_types').select('*').eq('plant_id', plant.id).eq('is_active', true),
        supabase.from('pellet_types').select('*').eq('plant_id', plant.id).eq('is_active', true),
        supabase.from('equipment').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
        supabase.from('machine_production').select('*, machines(name)').eq('shift_report_id', editId),
        supabase.from('raw_material_usage').select('*, raw_material_types(name)').eq('shift_report_id', editId),
        supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', editId),
        supabase.from('pellet_stock').select('*, pellet_types(name)').eq('shift_report_id', editId),
        supabase.from('issues').select('*').eq('shift_report_id', editId),
        supabase.from('diesel_stock').select('*').eq('shift_report_id', editId).maybeSingle(),
        supabase.from('diesel_purchases').select('*').eq('shift_report_id', editId),
        supabase.from('shift_mixes').select('*, shift_mix_compositions(*), shift_mix_machine_usage(*)').eq('shift_report_id', editId),
      ])

      // Initialize machines array from active machines
      if (machinesRes.data) {
        const initialMachines = machinesRes.data.map(m => ({
          id: m.id, name: m.name, from_time: '', to_time: '', breakdown_hrs: 0, total_hours: 0, production_hours: 0, remarks: '',
        }))

        // Merge machine production hours back into machines
        if (machProd.data?.length) {
          const machinesWithProduction = initialMachines.map(m => {
            const prod = machProd.data.find(mp => mp.machine_id === m.id)
            if (prod) {
              return {
                ...m,
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
          updateData('machines', machinesWithProduction)
        } else {
          updateData('machines', initialMachines)
        }
      }

      // Initialize raw materials and pellet stock for editing
      if (materialsRes.data) {
        const materialRows = materialsRes.data.map(m => {
          const rmData = rmUsage.data?.find(r => r.raw_material_type_id === m.id)
          return {
            id: m.id,
            name: m.name,
            opening: rmData ? parseFloat(rmData.opening_kg) || 0 : 0,
            purchased: rmData ? parseFloat(rmData.purchased_kg) || 0 : 0,
            used: rmData ? parseFloat(rmData.quantity_kg) || 0 : 0,
            closing: rmData ? parseFloat(rmData.closing_kg) || 0 : 0,
          }
        })
        updateData('rawMaterials', materialRows)
      }

      if (pelletTypesRes.data) {
        const pelletRows = pelletTypesRes.data.map(p => {
          const psData = pStock.data?.find(ps => ps.pellet_type_id === p.id)
          return {
            id: p.id,
            name: p.name,
            opening: psData ? parseFloat(psData.opening_mt) || 0 : 0,
            production: psData ? parseFloat(psData.production_mt) || 0 : 0,
            dispatch: psData ? parseFloat(psData.dispatch_mt) || 0 : 0,
            wastage: psData ? parseFloat(psData.wastage_mt) || 0 : 0,
            closing: psData ? parseFloat(psData.closing_mt) || 0 : 0,
          }
        })
        updateData('pelletStock', pelletRows)
      }

      if (equipmentRes.data) {
        const equipmentRows = equipmentRes.data.map(eq => {
          const dieselData = diesel.data?.find(d => d.equipment_name === eq.name)
          return {
            id: eq.id,
            equipment_name: eq.name,
            opening: dieselData ? parseFloat(dieselData.opening_litres) || 0 : 0,
            added: dieselData ? parseFloat(dieselData.added_litres) || 0 : 0,
            used: dieselData ? (parseFloat(dieselData.opening_litres) || 0) + (parseFloat(dieselData.added_litres) || 0) - (parseFloat(dieselData.closing_litres) || 0) : 0,
            closing: dieselData ? parseFloat(dieselData.closing_litres) || 0 : 0,
            hours: dieselData ? parseFloat(dieselData.hours_worked) || 0 : 0,
            avg_per_hr: 0,
            collapsed: true,
          }
        })
        updateData('diesel', equipmentRows)
      }

      // Load mixes (Step 3)
      if (mixesRes.data?.length) {
        const loadedMixes = mixesRes.data.map(m => ({
          local_id: 'mix_' + m.id, // stable client-side ID derived from DB ID
          db_id: m.id,
          name: m.name,
          type: m.type,
          opening_kg: parseFloat(m.opening_kg) || 0,
          prepared_kg: parseFloat(m.prepared_kg) || 0,
          used_kg: parseFloat(m.used_kg) || 0,
          ingredients: (m.shift_mix_compositions || []).map(c => ({
            raw_material_type_id: c.raw_material_type_id,
            name: c.raw_material_name,
            quantity_kg: parseFloat(c.quantity_kg) || 0,
          })),
        }))
        updateData('mixes', loadedMixes)

        // Load production entries with mix_usages restored (Step 4)
        if (machProd.data?.length) {
          const productionEntries = machProd.data
            .map(mp => {
              // Restore mix_usages from shift_mix_machine_usage
              const mixUsages = loadedMixes.flatMap(mix =>
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
          if (productionEntries.length > 0) updateData('production', productionEntries)
        }
      } else if (machProd.data?.length) {
        // No mixes — load production entries without mix_usages
        const productionEntries = machProd.data
          .map(mp => ({
            id: mp.id,
            machine_id: mp.machine_id,
            machine_name: mp.machines?.name || 'Unknown',
            quantity: parseFloat(mp.production_mt) || 0,
            mix_usages: [],
          }))
        if (productionEntries.length > 0) updateData('production', productionEntries)
      }


      if (issuesData.data?.length) {
        updateData('issues', issuesData.data.map(i => ({
          id: i.id,
          type: i.issue_type,
          description: i.description,
          severity: i.severity,
          photo_url: i.photo_url,
        })))
      }

      if (dStock.data) {
        const purchases = (dPurchases.data || []).map(dp => ({
          litres: parseFloat(dp.litres) || 0,
          cost_per_litre: parseFloat(dp.cost_per_litre) || 0,
          receipt_url: dp.receipt_url || null,
        }))
        updateData('diesel_stock', {
          opening: parseFloat(dStock.data.opening_litres) || 0,
          purchases,
          closing: parseFloat(dStock.data.closing_litres) || 0,
        })
      }
    } catch (err) {
      console.error('Error loading report:', err)
      showToast('Failed to load report', 'error')
    }
  }

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
        date: reportData.date,
        shift: reportData.shift,
        start_time: reportData.start_time,
        end_time: reportData.end_time,
        shift_start_date: reportData.shift_start_date,
        shift_end_date: reportData.shift_end_date,
        start_power_reading: sanitizeNumber(reportData.start_power_reading) || 0,
        end_power_reading: sanitizeNumber(reportData.end_power_reading) || 0,
        pellet_production_mt: reportData.production.reduce((sum, p) => sum + sanitizeNumber(p.quantity), 0),
        supervisor_id: employee?.id,
        created_by: employee?.id,
        handover_notes: sanitizeText(reportData.handover_notes, 1000),
        remarks: sanitizeText(reportData.remarks, 1000),
      }

      let report
      if (reportId) {
        const { data, error } = await supabase.from('shift_reports').update(reportPayload).eq('id', reportId).select().single()
        if (error) throw error
        report = data
      } else {
        const { data, error } = await supabase.from('shift_reports').insert(reportPayload).select().single()
        if (error) throw error
        report = data
        setReportId(report.id)
      }

      // Helper: derive pellet_type_name for a machine from its mix usages
      function derivePelletType(machineId) {
        const machineEntries = reportData.production.filter(p => p.machine_id === machineId)
        const usedMixTypes = machineEntries.flatMap(p =>
          (p.mix_usages || []).map(u => (reportData.mixes || []).find(m => m.local_id === u.mix_local_id)?.type).filter(Boolean)
        )
        if (usedMixTypes.length === 0) {
          // Fall back: use first mix type in this shift (avoids null when mix_usages not set)
          return (reportData.mixes || []).find(m => m.type)?.type || null
        }
        const unique = [...new Set(usedMixTypes)]
        return unique.length === 1 ? unique[0] : 'Sample'
      }

      // Save machine production
      if (reportData.machines.length) {
        await supabase.from('machine_production').delete().eq('shift_report_id', report.id)
        const machineRows = reportData.machines
          .filter(m => sanitizeNumber(m.production_hours) > 0 || sanitizeNumber(m.total_hours) > 0 || m.from_time || m.to_time)
          .map(m => ({
            shift_report_id: report.id,
            machine_id: m.id,
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
          await supabase.from('machine_production').insert(machineRows)
        }
      }

      // Save mixes (shift_mixes + compositions + machine_usage)
      // shift_mix_compositions and shift_mix_machine_usage cascade-delete via FK when shift_mixes is deleted
      await supabase.from('shift_mix_machine_usage').delete().eq('shift_report_id', report.id)
      await supabase.from('shift_mixes').delete().eq('shift_report_id', report.id)

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
          }).select().single()
          if (mixErr) { console.error('Mix save error:', mixErr); continue }

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
            if (compRows.length > 0) await supabase.from('shift_mix_compositions').insert(compRows)
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
          if (machineUsageRows.length > 0) await supabase.from('shift_mix_machine_usage').insert(machineUsageRows)
        }
      }

      // Save raw material usage (with opening/closing for carry-forward)
      if (reportData.rawMaterials.length) {
        await supabase.from('raw_material_usage').delete().eq('shift_report_id', report.id)
        const rmRows = reportData.rawMaterials
          .map(rm => ({
            shift_report_id: report.id,
            raw_material_type_id: rm.id,
            quantity_kg: sanitizeNumber(rm.used),
            opening_kg: sanitizeNumber(rm.opening),
            purchased_kg: sanitizeNumber(rm.purchased),
            closing_kg: sanitizeNumber(rm.closing),
          }))
        if (rmRows.length) {
          await supabase.from('raw_material_usage').insert(rmRows)
        }
      }

      // Save equipment diesel log
      if (reportData.diesel && reportData.diesel.length) {
        await supabase.from('equipment_diesel_log').delete().eq('shift_report_id', report.id)
        const dieselRows = reportData.diesel
          .filter(d => !d.did_not_run)
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
          await supabase.from('equipment_diesel_log').insert(dieselRows)
        }
      }

      // Save pellet stock (all entries — closing_mt is GENERATED, don't insert it)
      if (reportData.pelletStock && reportData.pelletStock.length) {
        await supabase.from('pellet_stock').delete().eq('shift_report_id', report.id)
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
          await supabase.from('pellet_stock').insert(stockRows)
        }
      }

      // Save issues
      if (reportData.issues.length) {
        await supabase.from('issues').delete().eq('shift_report_id', report.id)
        const issueRows = reportData.issues.map(i => ({
          shift_report_id: report.id,
          issue_type: sanitizeText(i.type, 50),
          description: sanitizeText(i.description, 1000),
          severity: sanitizeText(i.severity, 20),
          photo_url: i.photo_url,
        }))
        await supabase.from('issues').insert(issueRows)
      }

      // Save diesel stock (overall tank) + diesel purchases
      await supabase.from('diesel_purchases').delete().eq('shift_report_id', report.id)
      await supabase.from('diesel_stock').delete().eq('shift_report_id', report.id)
      const totalAddedToEquipment = (reportData.diesel || []).reduce((sum, eq) => sum + sanitizeNumber(eq.added), 0)
      const ds = reportData.diesel_stock || {}
      const purchases = ds.purchases || []
      const totalPurchased = purchases.reduce((sum, p) => sum + sanitizeNumber(p.litres), 0)
      const totalCost = purchases.reduce((sum, p) => {
        return sum + (sanitizeNumber(p.litres) * sanitizeNumber(p.cost_per_litre))
      }, 0)
      const dsOpening = sanitizeNumber(ds.opening)
      await supabase.from('diesel_stock').insert({
        shift_report_id: report.id,
        opening_litres: dsOpening,
        purchased_litres: totalPurchased,
        purchase_cost: totalCost,
        used_litres: totalAddedToEquipment,
        closing_litres: dsOpening + totalPurchased - totalAddedToEquipment,
      })
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
          await supabase.from('diesel_purchases').insert(purchaseRows)
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

      sessionStorage.removeItem(WIZARD_STORAGE_KEY)
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

  const CurrentStep = STEPS[step - 1].component
  const allErrors = useMemo(() => getValidationErrors(reportData), [ // eslint-disable-line react-hooks/exhaustive-deps
    reportData.date, reportData.shift, reportData.start_time, reportData.end_time,
    reportData.machines, reportData.production, reportData.rawMaterials
  ])
  const stepsWithErrors = useMemo(() => [...new Set(allErrors.map(e => e.step))], [allErrors])
  const currentWarnings = useMemo(() => allErrors.filter(e => e.step === step), [allErrors, step])

  return (
    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', background: '#f5edd6' }}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fefae0', width: '100%', maxWidth: 480, boxShadow: '0 0 40px rgba(0,0,0,0.08)' }}>
      <PageHeader
        title={STEPS[step - 1].title}
        subtitle={`${editId ? 'Editing · ' : ''}Step ${step} of 10 · ${plant?.name || 'Plant'} · Shift ${reportData.shift}`}
        onBack={() => {
          if (step === 1) {
            if (window.confirm('Stop editing? Any unsaved changes will be lost.')) {
              sessionStorage.removeItem(WIZARD_STORAGE_KEY)
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
          <CurrentStep
            data={reportData}
            updateData={updateData}
            plant={plant}
            employee={employee}
            saveWizardState={saveWizardState}
          />
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
        {step < 10 ? (
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
