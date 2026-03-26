import { useState, useEffect, useMemo, useCallback } from 'react'
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
import Step3Production from './Step3Production'
import Step4RawMaterial from './Step4RawMaterial'
import Step5Diesel from './Step5Diesel'
import Step6Dispatch from './Step6Dispatch'
import Step7PelletStock from './Step7PelletStock'
import Step8Issues from './Step8Issues'
import Step9Submit from './Step9Submit'

const STEPS = [
  { num: 1, title: 'Report Header', component: Step1Header },
  { num: 2, title: 'Machine Timings', component: Step2Machines },
  { num: 3, title: 'Production', component: Step3Production },
  { num: 4, title: 'Raw Material', component: Step4RawMaterial },
  { num: 5, title: 'Equipment & Diesel', component: Step5Diesel },
  { num: 6, title: 'Dispatch Summary', component: Step6Dispatch },
  { num: 7, title: 'Pellet Stock', component: Step7PelletStock },
  { num: 8, title: 'Issues', component: Step8Issues },
  { num: 9, title: 'Submit', component: Step9Submit },
]

const WIZARD_STORAGE_KEY = 'kanoz_shift_wizard_state'

// Save to both sessionStorage and localStorage for maximum persistence on mobile
function saveWizardStateToStorage(state) {
  const serialized = JSON.stringify(state)
  try { sessionStorage.setItem(WIZARD_STORAGE_KEY, serialized) } catch { /* ignore */ }
  try { localStorage.setItem(WIZARD_STORAGE_KEY, serialized) } catch { /* ignore */ }
}

function clearWizardStateFromStorage() {
  try { sessionStorage.removeItem(WIZARD_STORAGE_KEY) } catch { /* ignore */ }
  try { localStorage.removeItem(WIZARD_STORAGE_KEY) } catch { /* ignore */ }
}

function loadWizardStateFromStorage() {
  // Try sessionStorage first (same session), fall back to localStorage (survives tab kills)
  try {
    const s = sessionStorage.getItem(WIZARD_STORAGE_KEY)
    if (s) return JSON.parse(s)
  } catch { /* ignore */ }
  try {
    const l = localStorage.getItem(WIZARD_STORAGE_KEY)
    if (l) return JSON.parse(l)
  } catch { /* ignore */ }
  return null
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

  // Save wizard state to both sessionStorage and localStorage
  const saveWizardState = useCallback(() => {
    saveWizardStateToStorage({ reportData, step, reportId })
  }, [reportData, step, reportId])

  // Restore from sessionStorage if returning from dispatch
  const [initDone, setInitDone] = useState(false)
  useEffect(() => {
    if (editId) { setInitDone(true); return }
    const returnToStep = location.state?.returnToStep
    try {
      const saved = loadWizardStateFromStorage()
      if (saved) {
        const { reportData: savedData, step: savedStep, reportId: savedId } = saved
        if (savedData && (savedData.date || savedData.machines?.length > 0)) {
          setReportData(savedData)
          setStep(returnToStep || savedStep || 1)
          if (savedId) setReportId(savedId)
          setRestoredFromStorage(true)
          setInitDone(true)
          return
        }
      }
    } catch (e) {
      console.error('Failed to restore wizard state:', e)
    }
    setInitDone(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load machines and raw material types for this plant
  useEffect(() => {
    if (plant?.id && initDone && !restoredFromStorage && !editId) loadPlantData()
  }, [plant, initDone, restoredFromStorage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save wizard state on every change (survives navigation and tab kills)
  useEffect(() => {
    if (!initDone || editId) return
    saveWizardStateToStorage({ reportData, step, reportId })
  }, [reportData, step, reportId, initDone, editId])

  // Also save when app goes to background (mobile app switch) or page unloads
  useEffect(() => {
    if (!initDone || editId) return
    function saveOnHide() {
      saveWizardStateToStorage({ reportData, step, reportId })
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveOnHide() })
    window.addEventListener('beforeunload', saveOnHide)
    window.addEventListener('pagehide', saveOnHide)
    return () => {
      document.removeEventListener('visibilitychange', saveOnHide)
      window.removeEventListener('beforeunload', saveOnHide)
      window.removeEventListener('pagehide', saveOnHide)
    }
  }, [reportData, step, reportId, initDone, editId])

  // For edit mode: load everything in one shot to avoid race conditions
  useEffect(() => {
    if (editId && plant?.id) {
      loadExistingReportFull()
    }
  }, [editId, plant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPlantData() {
    const [machinesRes, materialsRes, pelletTypesRes, equipmentRes] = await Promise.all([
      supabase.from('machines').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
      supabase.from('raw_material_types').select('*').eq('plant_id', plant.id).eq('is_active', true).order('name', { ascending: true }),
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

    if (prevReport) {
      const [psRes, dlRes, rmRes, dsRes] = await Promise.all([
        supabase.from('pellet_stock').select('*').eq('shift_report_id', prevReport.id),
        supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', prevReport.id),
        supabase.from('raw_material_usage').select('*').eq('shift_report_id', prevReport.id),
        supabase.from('diesel_stock').select('*').eq('shift_report_id', prevReport.id).maybeSingle(),
      ])
      prevPelletStock = psRes.data || []
      prevDieselLog = dlRes.data || []
      prevRawMaterials = rmRes.data || []
      prevDieselStock = dsRes.data
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

  async function loadExistingReportFull() {
    try {
      const { data: report } = await supabase
        .from('shift_reports')
        .select('*')
        .eq('id', editId)
        .single()

      if (!report) { showToast('Report not found', 'error'); navigate('/'); return }
      setReportId(editId)

      // Fetch all reference data AND saved data in one shot
      const [machinesRes, materialsRes, pelletTypesRes, equipmentRes, machProd, rmUsage, diesel, pStock, issuesData, dStock, dPurchases] = await Promise.all([
        supabase.from('machines').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
        supabase.from('raw_material_types').select('*').eq('plant_id', plant.id).eq('is_active', true).order('name', { ascending: true }),
        supabase.from('pellet_types').select('*').eq('plant_id', plant.id).eq('is_active', true),
        supabase.from('equipment').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
        supabase.from('machine_production').select('*, machines(name)').eq('shift_report_id', editId),
        supabase.from('raw_material_usage').select('*, raw_material_types(name)').eq('shift_report_id', editId),
        supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', editId),
        supabase.from('pellet_stock').select('*, pellet_types(name)').eq('shift_report_id', editId),
        supabase.from('issues').select('*').eq('shift_report_id', editId),
        supabase.from('diesel_stock').select('*').eq('shift_report_id', editId).maybeSingle(),
        supabase.from('diesel_purchases').select('*').eq('shift_report_id', editId),
      ])

      // Build machines array
      let machines = []
      if (machinesRes.data) {
        const initialMachines = machinesRes.data.map(m => ({
          id: m.id, name: m.name, from_time: '', to_time: '',
          breakdown_hrs: 0, total_hours: 0, production_hours: 0, remarks: '',
        }))
        if (machProd.data?.length) {
          machines = initialMachines.map(m => {
            const prod = machProd.data.find(mp => mp.machine_id === m.id)
            if (prod) {
              return { ...m,
                production_hours: parseFloat(prod.hours_run) || 0,
                total_hours: parseFloat(prod.total_hours) || 0,
                from_time: prod.from_time || '',
                to_time: prod.to_time || '',
                breakdown_hrs: parseFloat(prod.breakdown_hours) || 0,
                remarks: prod.remarks || '',
              }
            }
            return m
          })
        } else {
          machines = initialMachines
        }
      }

      // Build raw materials array
      let rawMaterials = []
      if (materialsRes.data) {
        rawMaterials = materialsRes.data.map(m => {
          const rmData = rmUsage.data?.find(r => r.raw_material_type_id === m.id)
          return {
            id: m.id, name: m.name,
            opening: rmData ? parseFloat(rmData.opening_kg) || 0 : 0,
            purchased: rmData ? parseFloat(rmData.purchased_kg) || 0 : 0,
            used: rmData ? parseFloat(rmData.quantity_kg) || 0 : 0,
            closing: rmData ? parseFloat(rmData.closing_kg) || 0 : 0,
          }
        })
      }

      // Build pellet stock array
      let pelletStock = []
      if (pelletTypesRes.data) {
        pelletStock = pelletTypesRes.data.map(p => {
          const psData = pStock.data?.find(ps => ps.pellet_type_id === p.id)
          return {
            id: p.id, name: p.name,
            opening: psData ? parseFloat(psData.opening_mt) || 0 : 0,
            production: psData ? parseFloat(psData.production_mt) || 0 : 0,
            dispatch: psData ? parseFloat(psData.dispatch_mt) || 0 : 0,
            wastage: psData ? parseFloat(psData.wastage_mt) || 0 : 0,
            closing: psData ? parseFloat(psData.closing_mt) || 0 : 0,
          }
        })
      }

      // Build diesel equipment array
      let dieselEquipment = []
      if (equipmentRes.data) {
        dieselEquipment = equipmentRes.data.map(eq => {
          const dieselData = diesel.data?.find(d => d.equipment_name === eq.name)
          return {
            id: eq.id, equipment_name: eq.name,
            opening: dieselData ? parseFloat(dieselData.opening_litres) || 0 : 0,
            added: dieselData ? parseFloat(dieselData.added_litres) || 0 : 0,
            used: dieselData ? (parseFloat(dieselData.opening_litres) || 0) + (parseFloat(dieselData.added_litres) || 0) - (parseFloat(dieselData.closing_litres) || 0) : 0,
            closing: dieselData ? parseFloat(dieselData.closing_litres) || 0 : 0,
            hours: dieselData ? parseFloat(dieselData.hours_worked) || 0 : 0,
            avg_per_hr: 0, collapsed: true,
          }
        })
      }

      // Build production entries (Step 3)
      let production = []
      if (machProd.data?.length) {
        production = machProd.data
          .filter(mp => parseFloat(mp.production_mt) > 0)
          .map(mp => ({
            id: mp.id, machine_id: mp.machine_id,
            machine_name: mp.machines?.name || 'Unknown',
            pellet_type: mp.pellet_type_name || '',
            quantity: parseFloat(mp.production_mt) || 0,
            ingredients: '',
          }))
      }

      // Build issues
      let issues = []
      if (issuesData.data?.length) {
        issues = issuesData.data.map(i => ({
          id: i.id, type: i.issue_type, description: i.description,
          severity: i.severity, photo_url: i.photo_url, machine_id: i.machine_id || null,
        }))
      }

      // Build diesel stock
      let diesel_stock = { opening: 0, purchases: [], closing: 0 }
      if (dStock.data) {
        let purchases = (dPurchases.data || []).map(dp => ({
          litres: parseFloat(dp.litres) || 0,
          cost_per_litre: parseFloat(dp.cost_per_litre) || 0,
          receipt_url: dp.receipt_url || null,
        }))
        // If no purchase rows but diesel_stock shows purchased amount, create synthetic entry
        const stockPurchased = parseFloat(dStock.data.purchased_litres) || 0
        if (purchases.length === 0 && stockPurchased > 0) {
          const stockCost = parseFloat(dStock.data.purchase_cost) || 0
          purchases = [{ litres: stockPurchased, cost_per_litre: stockPurchased > 0 ? stockCost / stockPurchased : 0, receipt_url: null }]
        }
        diesel_stock = {
          opening: parseFloat(dStock.data.opening_litres) || 0,
          purchases,
          closing: parseFloat(dStock.data.closing_litres) || 0,
        }
      }

      // ONE single state update — no race conditions
      setReportData({
        date: report.date,
        shift: report.shift,
        start_time: report.start_time,
        end_time: report.end_time,
        shift_start_date: report.shift_start_date || report.date,
        shift_end_date: report.shift_end_date || report.date,
        start_power_reading: report.start_power_reading || 0,
        end_power_reading: report.end_power_reading || 0,
        handover_notes: report.handover_notes || '',
        remarks: report.remarks || '',
        machines,
        production,
        rawMaterials,
        diesel: dieselEquipment,
        diesel_stock,
        dispatches: [],
        dispatchTotals: {},
        pelletStock,
        issues,
      })
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

      // Save machine production — one row per (machine, pellet_type) with timing fields
      if (reportData.machines.length) {
        await supabase.from('machine_production').delete().eq('shift_report_id', report.id)
        const allMachineRows = []
        const runningMachines = reportData.machines.filter(m =>
          sanitizeNumber(m.production_hours) > 0 || sanitizeNumber(m.total_hours) > 0 || m.from_time || m.to_time
        )
        for (const m of runningMachines) {
          const machineProds = reportData.production.filter(p => p.machine_id === m.id)
          const timingBase = {
            shift_report_id: report.id,
            machine_id: m.id,
            from_time: sanitizeText(m.from_time, 10) || null,
            to_time: sanitizeText(m.to_time, 10) || null,
            breakdown_hours: sanitizeNumber(m.breakdown_hrs) || 0,
            total_hours: sanitizeNumber(m.total_hours) || 0,
            hours_run: sanitizeNumber(m.production_hours) || sanitizeNumber(m.total_hours) || 0,
            remarks: sanitizeText(m.remarks, 500),
          }
          if (machineProds.length > 0) {
            // One row per pellet type produced by this machine
            for (const prod of machineProds) {
              allMachineRows.push({
                ...timingBase,
                production_mt: sanitizeNumber(prod.quantity),
                pellet_type_name: sanitizeText(prod.pellet_type, 100) || null,
              })
            }
          } else {
            // Machine ran but no production entries — save timing row with 0 production
            allMachineRows.push({ ...timingBase, production_mt: 0, pellet_type_name: null })
          }
        }
        if (allMachineRows.length) {
          await supabase.from('machine_production').insert(allMachineRows)
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
          .map(d => ({
            shift_report_id: report.id,
            equipment_name: sanitizeText(d.equipment_name, 100),
            opening_litres: sanitizeNumber(d.opening),
            added_litres: sanitizeNumber(d.added),
            closing_litres: sanitizeNumber(d.closing),
            hours_worked: sanitizeNumber(d.hours),
          }))
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
          machine_id: i.machine_id || null,
        }))
        await supabase.from('issues').insert(issueRows)
      }

      // Link dispatches that fall within this shift's time window to this shift report
      {
        const shiftStart = `${reportData.shift_start_date}T${reportData.start_time}:00`
        const shiftEnd = `${reportData.shift_end_date}T${reportData.end_time}:00`
        const startDate = reportData.shift_start_date
        const endDate = reportData.shift_end_date

        // First, unlink any dispatches previously linked to this report (in case of edit/re-submit)
        await supabase.from('vehicle_dispatches')
          .update({ shift_report_id: null })
          .eq('shift_report_id', report.id)
          .eq('plant_id', plant.id)

        // Fetch dispatches in the date range for this plant
        const { data: dispatchCandidates } = await supabase
          .from('vehicle_dispatches')
          .select('id, dispatch_date, dispatch_time, date')
          .eq('plant_id', plant.id)
          .eq('is_deleted', false)
          .gte('date', startDate)
          .lte('date', endDate)

        if (dispatchCandidates?.length) {
          // Filter client-side by exact time window (same logic as Step6Dispatch)
          const matchingIds = dispatchCandidates
            .filter(d => {
              const dDate = d.dispatch_date || d.date
              const dTime = d.dispatch_time || '00:00:00'
              const dt = new Date(`${dDate}T${dTime}`)
              return dt >= new Date(shiftStart) && dt <= new Date(shiftEnd)
            })
            .map(d => d.id)

          if (matchingIds.length) {
            await supabase.from('vehicle_dispatches')
              .update({ shift_report_id: report.id })
              .in('id', matchingIds)
          }
        }
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

      clearWizardStateFromStorage()
      showToast(editId ? 'Report updated!' : 'Report submitted!', 'success')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })

      // Send push notification to admins (non-blocking)
      if (!editId) {
        const totalMT = reportData.production.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
        import('../../lib/notifications').then(({ sendNotification }) => {
          sendNotification('report_submitted', {
            shift: reportData.shift,
            supervisor: employee?.name,
            production_mt: totalMT.toFixed(1),
            plant: plant?.name,
            date: reportData.date,
          })
        }).catch(() => {})

        // Auto-sync to Google Sheets (non-blocking)
        supabase.functions.invoke('sync-to-sheets', {
          body: { report_id: report.id },
        }).catch(() => {})
      }

      navigate('/')
    } catch (err) {
      console.error('Save error:', err)
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
        subtitle={`${editId ? 'Editing · ' : ''}Step ${step} of 9 · ${plant?.name || 'Plant'} · Shift ${reportData.shift}`}
        onBack={() => {
          if (step === 1) {
            if (window.confirm('Stop editing? Any unsaved changes will be lost.')) {
              clearWizardStateFromStorage()
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
        {step < 9 ? (
          <button
            onClick={() => setStep(step + 1)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => allErrors.length === 0 ? setShowConfirm(true) : saveReport()}
            disabled={saving}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', background: allErrors.length > 0 ? '#d4a373' : '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {allErrors.length > 0 ? `Fix ${allErrors.length} Issue${allErrors.length > 1 ? 's' : ''} to Submit` : (editId ? 'Update Report' : 'Submit Report')}
          </button>
        )}
      </div>
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
