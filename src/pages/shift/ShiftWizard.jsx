import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Stepper from '../../components/Stepper'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
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
  { num: 6, title: 'Dispatch', component: Step6Dispatch },
  { num: 7, title: 'Pellet Stock', component: Step7PelletStock },
  { num: 8, title: 'Issues', component: Step8Issues },
  { num: 9, title: 'Submit', component: Step9Submit },
]

export default function ShiftWizard() {
  const navigate = useNavigate()
  const { employee, plant } = useAuth()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [reportId, setReportId] = useState(null)

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
    diesel_stock: { opening: 0, purchased: 0, purchase_cost: 0, used: 0, closing: 0 },
    dispatches: [],
    pelletStock: [],
    issues: [],
    handover_notes: '',
    remarks: '',
  })

  function updateData(key, value) {
    setReportData(prev => ({ ...prev, [key]: value }))
  }

  // Load machines and raw material types for this plant
  useEffect(() => {
    if (plant?.id) loadPlantData()
  }, [plant])

  async function loadPlantData() {
    const [machinesRes, materialsRes, pelletTypesRes] = await Promise.all([
      supabase.from('machines').select('*').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
      supabase.from('raw_material_types').select('*').eq('plant_id', plant.id).eq('is_active', true),
      supabase.from('pellet_types').select('*').eq('plant_id', plant.id).eq('is_active', true),
    ])

    if (machinesRes.data) {
      updateData('machines', machinesRes.data.map(m => ({
        id: m.id, name: m.name, from_time: '', to_time: '', breakdown_min: 0, production_hours: 0, remarks: '',
      })))
    }
    if (materialsRes.data) {
      updateData('rawMaterials', materialsRes.data.map(m => ({
        id: m.id, name: m.name, opening: 0, purchased: 0, used: 0, closing: 0,
      })))
    }
    if (pelletTypesRes.data) {
      updateData('pelletStock', pelletTypesRes.data.map(p => ({
        id: p.id, name: p.name, opening: 0, production: 0, dispatch: 0, wastage: 0, closing: 0,
      })))
    }
  }

  async function saveReport() {
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
        pellet_production_mt: reportData.production.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0),
        supervisor_id: employee?.id,
        created_by: employee?.id,
        handover_notes: reportData.handover_notes,
        remarks: reportData.remarks,
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
          .filter(m => m.production_hours > 0)
          .map(m => ({
            shift_report_id: report.id,
            machine_id: m.id,
            hours_run: m.production_hours,
            production_mt: reportData.production
              .filter(p => p.machine_id === m.id)
              .reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0),
          }))
        if (machineRows.length) {
          await supabase.from('machine_production').insert(machineRows)
        }
      }

      // Save issues
      if (reportData.issues.length) {
        await supabase.from('issues').delete().eq('shift_report_id', report.id)
        const issueRows = reportData.issues.map(i => ({
          shift_report_id: report.id,
          issue_type: i.type,
          description: i.description,
          severity: i.severity,
          photo_url: i.photo_url,
        }))
        await supabase.from('issues').insert(issueRows)
      }

      showToast('Report submitted successfully!', 'success')
      navigate('/')
    } catch (err) {
      console.error('Save error:', err)
      showToast(err.message || 'Failed to save report', 'error')
    } finally {
      setSaving(false)
    }
  }

  const CurrentStep = STEPS[step - 1].component

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F5F7F6' }}>
      <PageHeader
        title={STEPS[step - 1].title}
        subtitle={`Step ${step} of 9 · ${plant?.name || 'Plant'} · Shift ${reportData.shift}`}
        onBack={() => step === 1 ? navigate('/') : setStep(step - 1)}
      />

      <Stepper currentStep={step} onStepClick={setStep} />

      {/* Step Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px' }}>
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
            onClick={saveReport}
            disabled={saving}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', background: '#1B7A45', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            Submit Report
          </button>
        )}
      </div>
    </div>
  )
}
