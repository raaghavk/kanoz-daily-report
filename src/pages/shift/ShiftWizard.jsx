import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Stepper from '../../components/Stepper'
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle } from 'lucide-react'
import ConfirmDialog from '../../components/ConfirmDialog'
import PageHeader from '../../components/PageHeader'
import { sanitizeText, sanitizeNumber } from '../../lib/sanitize'
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

export default function ShiftWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { employee, plant } = useAuth()
  const { id: editId } = useParams()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [reportId, setReportId] = useState(editId || null)

  // Report data state — shared across all steps
  const [reportData, setReportData] = useState({
    date: new Date().toISOString().split('T')[0],
    shift: 'A',
    start_time: '06:00',
    end_time: '18:00',
    shift_start_date: new Date().toISOString().split('T')[0],
    shift_end_date: new Date().toISOString().split('T')[0],
    weather: '',
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

  // Load machines and raw material types for this plant
  useEffect(() => {
    if (plant?.id) loadPlantData()
  }, [plant])

  useEffect(() => {
    if (editId && plant?.id) loadExistingReport()
  }, [editId, plant])

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
        id: m.id, name: m.name, from_time: '', to_time: '', breakdown_min: 0, production_hours: 0, remarks: '',
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
          closing: opening, hours: 0, avg_per_hr: 0, collapsed: false,
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
      updateData('handover_notes', report.handover_notes || '')
      updateData('remarks', report.remarks || '')

      // Load child data
      const [, rmUsage, diesel, pStock, issuesData, dStock, dPurchases] = await Promise.all([
        supabase.from('machine_production').select('*, machines(name)').eq('shift_report_id', editId),
        supabase.from('raw_material_usage').select('*, raw_material_types(name)').eq('shift_report_id', editId),
        supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', editId),
        supabase.from('pellet_stock').select('*, pellet_types(name)').eq('shift_report_id', editId),
        supabase.from('issues').select('*').eq('shift_report_id', editId),
        supabase.from('diesel_stock').select('*').eq('shift_report_id', editId).maybeSingle(),
        supabase.from('diesel_purchases').select('*').eq('shift_report_id', editId),
      ])

      if (rmUsage.data?.length) {
        updateData('rawMaterials', rmUsage.data.map(rm => ({
          id: rm.raw_material_type_id,
          name: rm.raw_material_types?.name || 'Unknown',
          opening: parseFloat(rm.opening_kg) || 0,
          purchased: 0,
          used: parseFloat(rm.quantity_kg) || 0,
          closing: parseFloat(rm.closing_kg) || 0,
        })))
      }

      if (diesel.data?.length) {
        updateData('diesel', diesel.data.map(d => ({
          id: d.id,
          equipment_name: d.equipment_name,
          opening: parseFloat(d.opening_litres) || 0,
          added: parseFloat(d.added_litres) || 0,
          used: (parseFloat(d.opening_litres) || 0) + (parseFloat(d.added_litres) || 0) - (parseFloat(d.closing_litres) || 0),
          closing: parseFloat(d.closing_litres) || 0,
          hours: parseFloat(d.hours_worked) || 0,
          avg_per_hr: 0,
          collapsed: false,
        })))
      }

      if (pStock.data?.length) {
        updateData('pelletStock', pStock.data.map(ps => ({
          id: ps.pellet_type_id,
          name: ps.pellet_types?.name || 'Unknown',
          opening: parseFloat(ps.opening_mt) || 0,
          production: parseFloat(ps.production_mt) || 0,
          dispatch: parseFloat(ps.dispatch_mt) || 0,
          wastage: parseFloat(ps.wastage_mt) || 0,
          closing: parseFloat(ps.closing_mt) || 0,
        })))
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

  // Validation: returns array of {step, message} for incomplete required fields
  function getValidationErrors() {
    const errors = []
    // Step 1: Header
    if (!reportData.date) errors.push({ step: 1, message: 'Date is required' })
    if (!reportData.shift) errors.push({ step: 1, message: 'Shift is required' })
    if (!reportData.start_time) errors.push({ step: 1, message: 'Start time is required' })
    if (!reportData.end_time) errors.push({ step: 1, message: 'End time is required' })

    // Step 2: Machines — at least one machine should have timing
    const hasAnyMachineTiming = reportData.machines.some(m => m.from_time && m.to_time)
    if (!hasAnyMachineTiming && reportData.machines.length > 0) {
      errors.push({ step: 2, message: 'Enter timing for at least one machine' })
    }

    // Step 3: Production — at least one entry
    const hasProduction = reportData.production && reportData.production.length > 0 &&
      reportData.production.some(p => parseFloat(p.quantity) > 0)
    if (!hasProduction) {
      errors.push({ step: 3, message: 'Add at least one production entry' })
    }

    // Step 4: Raw Materials — used field for at least one
    const hasRMUsage = reportData.rawMaterials.some(rm => parseFloat(rm.used) > 0)
    if (!hasRMUsage && reportData.rawMaterials.length > 0) {
      errors.push({ step: 4, message: 'Enter raw material usage for at least one material' })
    }

    return errors
  }

  async function saveReport() {
    if (saving) return
    const errors = getValidationErrors()
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

      // Save machine production
      if (reportData.machines.length) {
        await supabase.from('machine_production').delete().eq('shift_report_id', report.id)
        const machineRows = reportData.machines
          .filter(m => sanitizeNumber(m.production_hours) > 0)
          .map(m => ({
            shift_report_id: report.id,
            machine_id: m.id,
            hours_run: sanitizeNumber(m.production_hours),
            production_mt: reportData.production
              .filter(p => p.machine_id === m.id)
              .reduce((sum, p) => sum + sanitizeNumber(p.quantity), 0),
          }))
        if (machineRows.length) {
          await supabase.from('machine_production').insert(machineRows)
        }
      }

      // Save raw material usage (with opening/closing for carry-forward)
      if (reportData.rawMaterials.length) {
        await supabase.from('raw_material_usage').delete().eq('shift_report_id', report.id)
        const rmRows = reportData.rawMaterials
          .filter(rm => sanitizeNumber(rm.used) > 0 || sanitizeNumber(rm.opening) > 0)
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
          .filter(d => sanitizeNumber(d.used) > 0 || sanitizeNumber(d.hours) > 0)
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

      // Save pellet stock
      if (reportData.pelletStock && reportData.pelletStock.length) {
        await supabase.from('pellet_stock').delete().eq('shift_report_id', report.id)
        const stockRows = reportData.pelletStock.map(ps => ({
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
      const totalUsed = (reportData.diesel || []).reduce((sum, eq) => sum + sanitizeNumber(eq.used), 0)
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
        used_litres: totalUsed,
        closing_litres: dsOpening + totalPurchased - totalUsed,
      })
      // Save individual purchase entries
      if (purchases.length > 0) {
        const purchaseRows = purchases
          .filter(p => sanitizeNumber(p.litres) > 0)
          .map(p => ({
            shift_report_id: report.id,
            litres: sanitizeNumber(p.litres),
            cost_per_litre: sanitizeNumber(p.cost_per_litre),
            receipt_url: p.receipt_url || null,
          }))
        if (purchaseRows.length > 0) {
          await supabase.from('diesel_purchases').insert(purchaseRows)
        }
      }

      showToast(editId ? 'Report updated!' : 'Report submitted!', 'success')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      navigate('/')
    } catch (err) {
      console.error('Save error:', err)
      showToast(err.message || 'Failed to save report', 'error')
    } finally {
      setSaving(false)
    }
  }

  const CurrentStep = STEPS[step - 1].component
  const allErrors = useMemo(() => getValidationErrors(), [
    reportData.date, reportData.shift, reportData.start_time, reportData.end_time,
    reportData.machines, reportData.production, reportData.rawMaterials
  ])
  const stepsWithErrors = useMemo(() => [...new Set(allErrors.map(e => e.step))], [allErrors])
  const currentWarnings = useMemo(() => allErrors.filter(e => e.step === step), [allErrors, step])

  return (
    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', background: '#E8EBE9' }}>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F5F7F6', width: '100%', maxWidth: 480, boxShadow: '0 0 40px rgba(0,0,0,0.08)' }}>
      <PageHeader
        title={STEPS[step - 1].title}
        subtitle={`${editId ? 'Editing · ' : ''}Step ${step} of 9 · ${plant?.name || 'Plant'} · Shift ${reportData.shift}`}
        onBack={() => step === 1 ? navigate('/') : setStep(step - 1)}
      />

      <Stepper currentStep={step} onStepClick={setStep} stepsWithErrors={stepsWithErrors} />

      {/* Step Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px' }}>
          {/* Validation warnings for this step */}
          {currentWarnings.length > 0 && (
            <div style={{ background: '#FFF8E6', border: '1.5px solid #F0D98C', borderRadius: 12, padding: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={16} color="#D4960A" style={{ flexShrink: 0, marginTop: 1 }} />
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
          />
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 12, background: '#fff', borderTop: '1.5px solid #E2E8E4', padding: '16px 20px' }}>
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', border: '1.5px solid #E2E8E4', borderRadius: 14, fontSize: 14, fontWeight: 600, background: '#fff', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} /> Previous
          </button>
        )}
        {step < 9 ? (
          <button
            onClick={() => setStep(step + 1)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', background: '#1B7A45', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => allErrors.length === 0 ? setShowConfirm(true) : saveReport()}
            disabled={saving}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', background: allErrors.length > 0 ? '#D4960A' : '#1B7A45', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
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
