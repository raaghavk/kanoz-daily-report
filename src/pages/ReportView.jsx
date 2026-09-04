import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { kgToMtStr, equipCode } from '../lib/units'
import { showToast } from '../components/Toast'
import { resyncShiftReport } from '../lib/resyncReport'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import { Calendar, Clock, AlertTriangle, Eye, Trash2, Edit3, FileText, RefreshCw, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import RecordNav from '../components/RecordNav'
import { useAdjacentRecord } from '../hooks/useAdjacentRecord'

export default function ReportView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employee, plant } = useAuth()
  const [report, setReport] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [machineProduction, setMachineProduction] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [equipmentDiesel, setEquipmentDiesel] = useState([])
  const [pelletStock, setPelletStock] = useState([])
  const [issues, setIssues] = useState([])
  const [mixes, setMixes] = useState([])
  const [loading, setLoading] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState(null)

  const plantId = report?.plant_id || plant?.id
  const adj = useAdjacentRecord({
    table: 'shift_reports',
    plantId,
    currentId: id,
    orderBy: [
      { column: 'date', ascending: false },
      { column: 'shift', ascending: false },
    ],
  })

  useEffect(() => {
    if (id) {
      fetchReport()
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteReport() {
    if (!window.confirm('Are you sure you want to delete this report? This cannot be undone.')) return
    try {
      setDeleting(true)
      // Soft delete — keeps data integrity and audit trail.
      // Child tables remain intact (accessible via shift_report_id if needed).
      const { error } = await supabase.from('shift_reports').update({ is_deleted: true, deleted_by: employee?.id || null, deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      showToast('Report deleted', 'success')
      navigate('/reports')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete report', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const [syncingReport, setSyncingReport] = useState(false)

  async function syncReport() {
    if (!report) return
    setSyncingReport(true)
    try {
      const normalizeTime = (t) => t ? t.substring(0, 5) : t
      const shiftStartDate = report.shift_start_date || report.date
      const shiftEndDate = report.shift_end_date || report.date
      const startTime = normalizeTime(report.start_time) || '06:00'
      const endTime = normalizeTime(report.end_time) || '18:00'
      const shiftStartDt = new Date(`${shiftStartDate}T${startTime}:00`)
      const shiftEndDt = new Date(`${shiftEndDate}T${endTime}:00`)

      // Re-link dispatches that fall inside this shift's time window to this report,
      // so newly-added dispatches show up (and ones moved out of the window drop off).
      const { data: candidateDispatches, error: dispErr } = await supabase
        .from('vehicle_dispatches')
        .select('id, date, dispatch_date, dispatch_time')
        .eq('plant_id', report.plant_id)
        .eq('is_deleted', false)
        .gte('date', shiftStartDate)
        .lte('date', shiftEndDate)
      if (dispErr) throw dispErr
      const matchingIds = (candidateDispatches || []).filter(d => {
        const dDate = d.dispatch_date || d.date
        const dTime = d.dispatch_time || '00:00:00'
        const dt = new Date(`${dDate}T${dTime}`)
        return dt >= shiftStartDt && dt < shiftEndDt
      }).map(d => d.id)
      await supabase.from('vehicle_dispatches').update({ shift_report_id: null }).eq('shift_report_id', id)
      if (matchingIds.length > 0) {
        await supabase.from('vehicle_dispatches').update({ shift_report_id: id }).in('id', matchingIds)
      }

      // Recompute every derived number the wizard would: raw-material purchased/opening/closing
      // (with processing folded in), pellet dispatch/opening, and diesel opening — all carried
      // from the previous shift and windowed to this shift. Hand-entered values are preserved.
      await resyncShiftReport(id)

      showToast('Report updated', 'success')
      await fetchReport()
    } catch (err) {
      console.error('Sync error:', err)
      showToast('Failed to update report', 'error')
    } finally {
      setSyncingReport(false)
    }
  }

  async function fetchReport() {
    try {
      setLoading(true)

      // Use !supervisor_id hint to disambiguate — shift_reports has 2 FKs to employees
      const { data: reportData, error: reportError } = await supabase
        .from('shift_reports')
        .select('*, plants(name), employees!supervisor_id(name), creator:employees!created_by(name), editor:employees!last_edited_by(name)')
        .eq('id', id)
        .eq('is_deleted', false)
        .single()

      if (reportError) {
        console.error('Report fetch error:', reportError)
        if (reportError.code === 'PGRST116') {
          showToast('Report not found', 'error')
          navigate('/reports')
          return
        }
        throw reportError
      }
      if (!reportData) {
        showToast('Report not found', 'error')
        navigate('/reports')
        return
      }

      setReport(reportData)

      // Fetch all child data in parallel
      const [machRes, matRes, dispatchRes, dieselRes, stockRes, issuesRes, mixesRes] = await Promise.all([
        supabase.from('machine_production').select('*, machines(name)').eq('shift_report_id', id),
        supabase.from('raw_material_usage').select('*, raw_material_types(name)').eq('shift_report_id', id),
        supabase.from('vehicle_dispatches').select('*, dispatch_pellets(*, pellet_types(name)), customers(name)').eq('shift_report_id', id).eq('is_deleted', false),
        supabase.from('equipment_diesel_log').select('*, equipment:equipment_id(name, equipment_type, owner, company, identifier)').eq('shift_report_id', id),
        supabase.from('pellet_stock').select('*, pellet_types(name)').eq('shift_report_id', id),
        supabase.from('issues').select('*').eq('shift_report_id', id),
        supabase.from('shift_mixes').select('*').eq('shift_report_id', id),
      ])

      if (machRes.error) console.error('Failed to load machine data:', machRes.error)
      if (matRes.error) console.error('Failed to load raw materials:', matRes.error)
      if (dispatchRes.error) console.error('Failed to load dispatches:', dispatchRes.error)
      if (dieselRes.error) console.error('Failed to load diesel data:', dieselRes.error)
      if (stockRes.error) console.error('Failed to load pellet stock:', stockRes.error)
      if (issuesRes.error) console.error('Failed to load issues:', issuesRes.error)
      if (mixesRes.error) console.error('Failed to load mixes:', mixesRes.error)

      setMachineProduction(machRes.data || [])
      setRawMaterials((matRes.data || []).slice().sort((a,b)=>(a.raw_material_types?.name||'').localeCompare(b.raw_material_types?.name||'')))
      setDispatches(dispatchRes.data || [])
      setEquipmentDiesel((dieselRes.data || []).slice().sort((a,b)=>(((a.equipment?.equipment_type||a.equipment_type||'zzz').localeCompare(b.equipment?.equipment_type||b.equipment_type||'zzz'))||((a.equipment?.name||a.equipment_name||'').localeCompare(b.equipment?.name||b.equipment_name||'')))))
      setPelletStock((stockRes.data || []).slice().sort((a,b)=>(a.pellet_types?.name||'').localeCompare(b.pellet_types?.name||'')))
      setIssues(issuesRes.data || [])
      setMixes(mixesRes.data || [])
    } catch (err) {
      console.error('Error fetching report:', err)
      showToast('Failed to load report', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: '#595c4a', fontSize: 13 }}>Loading report...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: '#595c4a', fontSize: 13 }}>Report not found</div>
      </div>
    )
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const startDateLabel = formatShortDate(report.shift_start_date || report.date)
  const endDateLabel = formatShortDate(report.shift_end_date || report.date)
  const showBothDates = (report.shift_start_date || report.date) !== (report.shift_end_date || report.date)

  // Only show machines that actually ran (exclude did_not_run machines)
  const machineTimings = machineProduction
    .filter(m => !m.did_not_run)
    .map(m => ({
      name: m.machines?.name || 'Unknown',
      hours_run: m.hours_run || 0,
      production_mt: m.production_mt || 0,
    }))

  // Calculate live dispatch totals from actual dispatch_pellets (overrides stale DB snapshot).
  // This handles the case where dispatches are added after the report was saved.
  function normPellet(s) { return (s || '').toLowerCase().replace(/[\s\-_]/g, '') }
  function isNonSampleVariant(s) { const n = normPellet(s); return n.includes('non') || (n.startsWith('n') && n.includes('sample')) }
  function pelletTypeMatches(a, b) {
    if (!a || !b) return false
    if (a === b) return true
    if (normPellet(a) === normPellet(b)) return true
    if (isNonSampleVariant(a) && isNonSampleVariant(b)) return true
    return false
  }
  const liveDispatchByPellet = {}
  dispatches.forEach(d => {
    ;(d.dispatch_pellets || []).forEach(dp => {
      const name = dp.pellet_type_name || dp.pellet_types?.name || ''
      if (name) liveDispatchByPellet[name] = (liveDispatchByPellet[name] || 0) + (parseFloat(dp.quantity_mt) || 0)
    })
  })
  const pelletStockWithLiveDispatch = pelletStock.map(p => {
    const typeName = p.pellet_types?.name || ''
    const liveDispatch = Object.entries(liveDispatchByPellet).reduce((sum, [key, val]) =>
      pelletTypeMatches(key, typeName) ? sum + val : sum, 0)
    const dispatchVal = liveDispatch > 0 ? liveDispatch : (parseFloat(p.dispatch_mt) || 0)
    const closing = (parseFloat(p.opening_mt) || 0) + (parseFloat(p.production_mt) || 0) - dispatchVal - (parseFloat(p.wastage_mt) || 0) + (parseFloat(p.adjustment_mt) || 0)
    return { ...p, live_dispatch_mt: dispatchVal, live_closing_mt: closing }
  })

  // Hide fully-empty rows (all quantities zero) from the report display.
  const nz = (...vals) => vals.some(v => (parseFloat(v) || 0) !== 0)
  const visibleRawMaterials = rawMaterials.filter(m => nz(m.opening_kg, m.purchased_kg, m.quantity_kg, m.closing_kg))
  const visiblePelletStock = pelletStockWithLiveDispatch.filter(p => nz(p.opening_mt, p.production_mt, p.live_dispatch_mt, p.wastage_mt, p.adjustment_mt, p.live_closing_mt))

  return (
    <div style={{ minHeight: '100%', background: '#fefae0', paddingBottom: 80 }}>
      {/* Sticky Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader
          title="Shift Report"
          subtitle={`Shift ${report.shift} · ${startDateLabel}${showBothDates ? ` – ${endDateLabel}` : ''}`}
          rightAction={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RecordNav
                newerId={adj.newerId}
                olderId={adj.olderId}
                basePath="/reports"
                position={adj.position}
                total={adj.total}
              />
              {can(employee?.role, 'create_report') ? (
                <button
                  onClick={() => navigate(`/shift/edit/${id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Edit3 size={14} /> Edit
                </button>
              ) : null}
            </div>
          }
        />
      </div>

      {/* Report Header Card — green-header style consistent with all tables */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>

          {/* Green top bar */}
          <div style={{ background: '#2d6a4f', padding: '10px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              Shift {report.shift} · {startDateLabel}{showBothDates ? ` – ${endDateLabel}` : ''}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              {report.plants?.name || 'Plant'}
            </div>
          </div>

          {/* Start | End row */}
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, padding: '11px 14px', borderBottom: '1px solid #f0ebe0' }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 }}>Start</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>{startDateLabel}, {report.start_time?.slice(0, 5)}</div>
            </div>
            <div style={{ flex: 1, padding: '11px 14px', borderLeft: '1px solid #f0ebe0', borderBottom: '1px solid #f0ebe0' }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 }}>End</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>{endDateLabel}, {report.end_time?.slice(0, 5)}</div>
            </div>
          </div>

          {/* Production | Dispatches row */}
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, padding: '11px 14px', borderBottom: '1px solid #f0ebe0' }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 }}>Production</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2d6a4f' }}>{(report.pellet_production_mt || 0).toFixed(1)} MT</div>
            </div>
            <div style={{ flex: 1, padding: '11px 14px', borderLeft: '1px solid #f0ebe0', borderBottom: '1px solid #f0ebe0' }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 }}>Dispatches</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2d6a4f' }}>
                {(dispatches.reduce((sum, d) => sum + (d.dispatch_pellets?.reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0) || 0), 0)).toFixed(1)} MT
              </div>
            </div>
          </div>

          {/* Supervisor bottom row */}
          <div style={{ padding: '9px 14px', background: '#faf8f2', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.7 }}>Supervisor:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#2c2c2c' }}>{report.employees?.name || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Machine Timings Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Machine Timings</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 11 }}>Machine</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Hours Run</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Production (MT)</th>
              </tr>
            </thead>
            <tbody>
              {machineTimings.length > 0 ? (
                machineTimings.map((m, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{m.name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{m.hours_run}h</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{m.production_mt}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Production</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 11 }}>Machine</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 11 }}>Pellet Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Quantity (MT)</th>
              </tr>
            </thead>
            <tbody>
              {machineProduction.filter(m => !m.did_not_run).length > 0 ? (
                machineProduction.filter(m => !m.did_not_run).map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{m.machines?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', color: '#595c4a', fontSize: 11 }}>{m.pellet_type_name || '-'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{m.production_mt || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Materials Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Raw Materials</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 11 }}>Material</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Opening</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Purchased</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Used</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Closing</th>
              </tr>
            </thead>
            <tbody>
              {visibleRawMaterials.length > 0 ? (
                visibleRawMaterials.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{m.raw_material_types?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{kgToMtStr(m.opening_kg)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{kgToMtStr(m.purchased_kg)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{kgToMtStr(m.quantity_kg)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{kgToMtStr(m.closing_kg)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td>
                </tr>
              )}
              {/* Mix stock rows — show all mixes regardless of closing */}
              {mixes.length > 0 && (
                <tr style={{ background: '#2d6a4f' }}>
                  <td colSpan={5} style={{ padding: '5px 12px', fontSize: 9, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Mix Stock (kg)
                  </td>
                </tr>
              )}
              {mixes.map(mx => (
                <tr key={'mix-' + mx.id} style={{ borderTop: '1px solid #e5ddd0', background: '#f5f9f7' }}>
                  <td style={{ padding: '10px 12px', fontSize: 11 }}>
                    <span style={{ fontWeight: 500, color: '#2c2c2c' }}>{mx.name || 'Mix'}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#2d6a4f', background: '#e8f5ee', borderRadius: 3, padding: '1px 5px', marginLeft: 6 }}>{mx.type || 'MIX'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{Math.round(parseFloat(mx.opening_kg) || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{Math.round(parseFloat(mx.prepared_kg) || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{Math.round(parseFloat(mx.used_kg) || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: parseFloat(mx.closing_kg) > 0 ? '#2d6a4f' : '#595c4a', fontSize: 11 }}>{Math.round(parseFloat(mx.closing_kg) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '6px 12px', fontSize: 9, color: '#b5b8a8', borderTop: '1px solid #f0ebe0' }}>All quantities in MT</div>
        </div>
      </div>

      {/* Equipment & Diesel Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Equipment & Diesel</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 11 }}>Equipment</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Opening (L)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Added (L)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Used (L)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Closing (L)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {equipmentDiesel.length > 0 ? (
                equipmentDiesel.map(e => {
                  const used = e.used_litres != null
                    ? (parseFloat(e.used_litres) || 0)
                    : (parseFloat(e.opening_litres) || 0) + (parseFloat(e.added_litres) || 0) - (parseFloat(e.closing_litres) || 0)
                  return (
                  <tr key={e.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>
                      <div>{(e.equipment?.name || e.equipment_name || 'N/A')}{equipCode(e.equipment?.identifier) ? ` · ${equipCode(e.equipment?.identifier)}` : ''}</div>
                      {((e.equipment?.equipment_type) || (e.equipment?.owner) || (e.equipment?.company)) && (
                        <div style={{ fontSize: 9, color: '#a0a396', marginTop: 2 }}>
                          {[e.equipment?.equipment_type, e.equipment?.owner || e.equipment?.company].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{e.opening_litres || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{e.added_litres || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2d6a4f', fontSize: 11 }}>{used.toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{e.closing_litres || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{e.hours_worked || 0}h</td>
                  </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatches Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Vehicle Dispatches</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 11 }}>Truck</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 11 }}>Customer</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 11 }}>Pellet Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Qty (MT)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.length > 0 ? (
                dispatches.map(d => (
                  <tr key={d.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{d.truck_number}</td>
                    <td style={{ padding: '10px 12px', color: '#595c4a', fontSize: 11 }}>{d.customers?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', color: '#595c4a', fontSize: 11 }}>
                      {d.dispatch_pellets?.map(p => p.pellet_types?.name || p.pellet_type_name).filter(Boolean).join(', ') || 'N/A'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>
                      {d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0).toFixed(1) || 0}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{d.dispatch_time?.slice(0, 5) || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pellet Stock Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Pellet Stock</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 11 }}>Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Opening</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Production</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Dispatch</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Wastage</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Adjust</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Closing</th>
              </tr>
            </thead>
            <tbody>
              {visiblePelletStock.length > 0 ? (
                visiblePelletStock.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{p.pellet_types?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{parseFloat(p.opening_mt || 0).toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{parseFloat(p.production_mt || 0).toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{p.live_dispatch_mt.toFixed(1)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: (parseFloat(p.adjustment_mt)||0) !== 0 ? '#b45309' : '#595c4a', fontSize: 11 }} title={p.adjustment_note || ''}>{(parseFloat(p.adjustment_mt)||0) === 0 ? '—' : ((parseFloat(p.adjustment_mt)>0?'+':'') + parseFloat(p.adjustment_mt).toFixed(1))}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{p.live_closing_mt.toFixed(1)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issues Section */}
      {issues.length > 0 && (
        <div style={{ padding: '0 20px', marginTop: 24 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Issues Reported</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {issues.map(issue => (
              <div key={issue.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ marginTop: 2 }}>
                    <AlertTriangle size={16} style={{ color: '#d32f2f' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2c', textTransform: 'capitalize' }}>{issue.issue_type}</span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: 4,
                        ...(issue.severity === 'High' ? { background: '#FEE2E2', color: '#B91C1C' } :
                           issue.severity === 'Medium' ? { background: '#FEF3C7', color: '#B45309' } :
                           { background: '#DBEAFE', color: '#1E40AF' })
                      }}>
                        {issue.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#595c4a', marginTop: 4 }}>{issue.description}</p>
                    {issue.photo_url && (
                      <div style={{ marginTop: 8 }}>
                        <img
                          src={issue.photo_url}
                          alt="Issue photo"
                          onClick={() => setLightboxUrl(issue.photo_url)}
                          style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1.5px solid #e5ddd0' }}
                        />
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, color: '#595c4a', fontSize: 10 }}>
                          <Eye size={10} /> Tap to view full photo
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Handover Notes Section */}
      {report.handover_notes && (
        <div style={{ padding: '0 20px', marginTop: 24 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Handover Notes</h2>
          <div style={{ background: '#fefae0', border: '1.5px solid #e9c46a', borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>{report.handover_notes}</p>
          </div>
        </div>
      )}

      {/* Record info — creation, last edit, supervisor (all distinct) */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <div style={{ background: '#f5f0e1', borderRadius: 14, padding: '10px 14px', fontSize: 11, color: '#595c4a', lineHeight: 1.6 }}>
          <div>Created by <b>{report.creator?.name || report.employees?.name || 'N/A'}</b>{report.created_at ? ' on ' + new Date(report.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</div>
          {report.updated_at && report.created_at && new Date(report.updated_at).getTime() - new Date(report.created_at).getTime() > 1000 && (
            <div>Last edited{report.editor?.name ? <> by <b>{report.editor.name}</b></> : ''} on {new Date(report.updated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
          )}
          <div>Supervisor: <b>{report.employees?.name || 'N/A'}</b></div>
        </div>
      </div>

      {/* Action Button — PDF Export */}
      {can(employee?.role, 'export') && (
      <div style={{ padding: '0 20px', marginTop: 12 }}>
        <button
          onClick={async () => { const { exportShiftReportPDF } = await import('../lib/pdfExport'); exportShiftReportPDF(report, { machineProduction, rawMaterials, equipmentDiesel, pelletStock: pelletStockWithLiveDispatch.map(p => ({ ...p, dispatch_mt: p.live_dispatch_mt, closing_mt: p.live_closing_mt })), dispatches, issues, mixes }, report.employees?.name); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: '#e8f0ec', color: '#2d6a4f', border: '1.5px solid #b8d4c4', cursor: 'pointer'
          }}
        >
          <FileText size={14} /> Download PDF
        </button>
      </div>
      )}

      {/* Action Buttons — Row 2: Sync + Delete (equal width) */}
      {can(employee?.role, 'create_report') && (
      <div style={{ padding: '0 20px', marginTop: 10, paddingBottom: 16, display: 'flex', gap: 10 }}>
        <button
          onClick={syncReport}
          disabled={syncingReport}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: '#FEF3C7', color: '#92400E', border: '1.5px solid #FDE68A',
            cursor: syncingReport ? 'not-allowed' : 'pointer', opacity: syncingReport ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={syncingReport ? { animation: 'spin 1s linear infinite' } : {}} /> {syncingReport ? 'Updating...' : 'Update'}
        </button>
        <button
          onClick={deleteReport}
          disabled={deleting}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: '#FEE2E2', color: '#B91C1C', border: '1.5px solid #FECACA',
            cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.5 : 1
          }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
      )}

      {/* Photo Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 10000,
            }}
          >
            <X size={22} color="white" />
          </button>
          <img
            src={lightboxUrl}
            alt="Issue photo"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  )
}
