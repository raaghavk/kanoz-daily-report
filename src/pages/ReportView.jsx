import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import { exportShiftReportPDF } from '../lib/pdfExport'
import { Calendar, Clock, AlertTriangle, Eye, Trash2, Edit3, FileText, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function ReportView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const [report, setReport] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [machineProduction, setMachineProduction] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [equipmentDiesel, setEquipmentDiesel] = useState([])
  const [pelletStock, setPelletStock] = useState([])
  const [issues, setIssues] = useState([])
  const [mixes, setMixes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchReport()
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteReport() {
    if (!window.confirm('Are you sure you want to delete this report? This cannot be undone.')) return
    try {
      setDeleting(true)
      // Delete child records first — check for errors
      const childDeletes = await Promise.all([
        supabase.from('machine_production').delete().eq('shift_report_id', id),
        supabase.from('raw_material_usage').delete().eq('shift_report_id', id),
        supabase.from('equipment_diesel_log').delete().eq('shift_report_id', id),
        supabase.from('pellet_stock').delete().eq('shift_report_id', id),
        supabase.from('diesel_stock').delete().eq('shift_report_id', id),
        supabase.from('issues').delete().eq('shift_report_id', id),
      ])
      const childError = childDeletes.find(r => r.error)
      if (childError) throw childError.error

      const { error: parentError } = await supabase.from('shift_reports').delete().eq('id', id)
      if (parentError) throw parentError
      showToast('Report deleted', 'success')
      navigate('/reports')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete report', 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function syncToSheets() {
    setSyncing(true)
    try {
      const { data, error } = await supabase.functions.invoke('sync-to-sheets', {
        body: { report_id: id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      showToast('Synced to Google Sheets!', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to sync to Sheets', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const [syncingReport, setSyncingReport] = useState(false)

  async function syncReport() {
    if (!report) return
    setSyncingReport(true)
    try {
      // Build shift time window
      // Normalize time: DB returns HH:MM:SS, we need HH:MM to avoid invalid dates like HH:MM:SS:00
      const normalizeTime = (t) => t ? t.substring(0, 5) : t
      const shiftStartDate = report.shift_start_date || report.date
      const shiftEndDate = report.shift_end_date || report.date
      const startTime = normalizeTime(report.start_time) || '06:00'
      const endTime = normalizeTime(report.end_time) || '18:00'
      const shiftStart = `${shiftStartDate}T${startTime}:00`
      const shiftEnd = `${shiftEndDate}T${endTime}:00`

      // 1. Re-link dispatches: find dispatches in shift time window for this plant
      // dispatch_datetime doesn't exist — filter by date range then check time in JS
      const { data: candidateDispatches, error: dispErr } = await supabase
        .from('vehicle_dispatches')
        .select('id, date, dispatch_date, dispatch_time')
        .eq('plant_id', report.plant_id)
        .eq('is_deleted', false)
        .gte('date', shiftStartDate)
        .lte('date', shiftEndDate)

      if (dispErr) throw dispErr

      // Filter to those within the exact shift time window
      const shiftStartDt = new Date(shiftStart)
      const shiftEndDt   = new Date(shiftEnd)
      const matchingIds  = (candidateDispatches || []).filter(d => {
        const dDate = d.dispatch_date || d.date
        const dTime = d.dispatch_time || '00:00:00'
        const dt = new Date(`${dDate}T${dTime}`)
        return dt >= shiftStartDt && dt <= shiftEndDt
      }).map(d => d.id)

      // Unlink old dispatches from this report
      await supabase
        .from('vehicle_dispatches')
        .update({ shift_report_id: null })
        .eq('shift_report_id', id)

      // Link matching dispatches to this report
      if (matchingIds.length > 0) {
        await supabase
          .from('vehicle_dispatches')
          .update({ shift_report_id: id })
          .in('id', matchingIds)
      }

      // 2. Update raw material purchased amounts from live purchases
      const { data: rmUsageRows, error: rmErr } = await supabase
        .from('raw_material_usage')
        .select('id, raw_material_type_id')
        .eq('shift_report_id', id)

      if (rmErr) throw rmErr

      if (rmUsageRows && rmUsageRows.length > 0) {
        // Get purchases in the shift window
        const { data: purchases } = await supabase
          .from('raw_material_purchases')
          .select('raw_material_type_id, net_weight')
          .eq('plant_id', report.plant_id)
          .eq('is_deleted', false)
          .gte('purchase_datetime', shiftStart)
          .lte('purchase_datetime', shiftEnd)

        // Sum purchases by material type
        const purchasedByType = {}
        if (purchases) {
          for (const p of purchases) {
            const typeId = p.raw_material_type_id
            purchasedByType[typeId] = (purchasedByType[typeId] || 0) + (parseFloat(p.net_weight) || 0)
          }
        }

        // Update each raw_material_usage row with fresh purchased_kg and recalculate closing
        for (const row of rmUsageRows) {
          const newPurchased = purchasedByType[row.raw_material_type_id] || 0
          // Fetch current row to recalculate closing
          const { data: currentRow } = await supabase
            .from('raw_material_usage')
            .select('opening_kg, quantity_kg')
            .eq('id', row.id)
            .single()

          if (currentRow) {
            const opening = parseFloat(currentRow.opening_kg) || 0
            const used = parseFloat(currentRow.quantity_kg) || 0
            const newClosing = opening + newPurchased - used
            await supabase
              .from('raw_material_usage')
              .update({ purchased_kg: newPurchased, closing_kg: newClosing })
              .eq('id', row.id)
          }
        }
      }

      showToast('Report synced successfully!', 'success')
      // Refresh the view
      await fetchReport()
    } catch (err) {
      console.error('Sync error:', err)
      showToast('Failed to sync report', 'error')
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
        .select('*, plants(name), employees!supervisor_id(name)')
        .eq('id', id)
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
        supabase.from('vehicle_dispatches').select('*, dispatch_pellets(*, pellet_types(name)), customers(name)').eq('shift_report_id', id),
        supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', id),
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
      setRawMaterials(matRes.data || [])
      setDispatches(dispatchRes.data || [])
      setEquipmentDiesel(dieselRes.data || [])
      setPelletStock(stockRes.data || [])
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

  const machineTimings = machineProduction.map(m => ({
    name: m.machines?.name || 'Unknown',
    hours_run: m.hours_run || 0,
    production_mt: m.production_mt || 0,
  }))

  return (
    <div style={{ minHeight: '100%', background: '#fefae0', paddingBottom: 80 }}>
      {/* Sticky Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader
          title="Shift Report"
          subtitle={`Shift ${report.shift} · ${startDateLabel}${showBothDates ? ` – ${endDateLabel}` : ''}`}
          onBack={() => navigate(-1)}
          rightAction={
            can(employee?.role, 'create_report') ? (
              <button
                onClick={() => navigate(`/shift/edit/${id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <Edit3 size={14} /> Edit
              </button>
            ) : null
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
              {machineProduction.length > 0 ? (
                machineProduction.map(m => (
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
              {rawMaterials.length > 0 ? (
                rawMaterials.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{m.raw_material_types?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{m.opening_kg || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{m.purchased_kg || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{m.quantity_kg || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{m.closing_kg || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td>
                </tr>
              )}
              {/* Mixes with closing stock > 0 appear here as carry-forward inventory */}
              {mixes.filter(mx => parseFloat(mx.closing_kg) > 0).map(mx => (
                <tr key={'mix-' + mx.id} style={{ borderTop: '1px solid #e5ddd0', background: '#f5f9f7' }}>
                  <td style={{ padding: '10px 12px', fontSize: 11 }}>
                    <span style={{ fontWeight: 500, color: '#2c2c2c' }}>{mx.name || 'Mix'}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#2d6a4f', background: '#e8f5ee', borderRadius: 3, padding: '1px 5px', marginLeft: 6 }}>MIX</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{Math.round(parseFloat(mx.opening_kg) || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{Math.round(parseFloat(mx.prepared_kg) || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{Math.round(parseFloat(mx.used_kg) || 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2d6a4f', fontSize: 11 }}>{Math.round(parseFloat(mx.closing_kg) || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '6px 12px', fontSize: 9, color: '#b5b8a8', borderTop: '1px solid #f0ebe0' }}>All quantities in kg</div>
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
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Closing (L)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {equipmentDiesel.length > 0 ? (
                equipmentDiesel.map(e => (
                  <tr key={e.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{e.equipment_name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{e.opening_litres || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{e.added_litres || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{e.closing_litres || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{e.hours_worked || 0}h</td>
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
                      {d.dispatch_pellets?.map(p => p.pellet_types?.name).filter(Boolean).join(', ') || 'N/A'}
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
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 11 }}>Closing</th>
              </tr>
            </thead>
            <tbody>
              {pelletStock.length > 0 ? (
                pelletStock.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{p.pellet_types?.name || 'N/A'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{p.opening_mt || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{p.production_mt || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{p.dispatch_mt || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{p.wastage_mt || 0}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{p.closing_mt || 0}</td>
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
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, color: "#1E3A5F", fontSize: 10, fontWeight: 500 }}>
                        <Eye size={12} /> Photo attached
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

      {/* Created By + Supervisor info */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <div style={{ background: '#f5f0e1', borderRadius: 14, padding: '10px 14px', fontSize: 11, color: '#595c4a' }}>
          Created by {report.employees?.name || 'N/A'}{report.created_at ? ' on ' + new Date(report.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
        </div>
      </div>

      {/* Action Button — PDF Export */}
      {can(employee?.role, 'export') && (
      <div style={{ padding: '0 20px', marginTop: 12 }}>
        <button
          onClick={() => exportShiftReportPDF(report, { machineProduction, rawMaterials, equipmentDiesel, pelletStock, dispatches, issues, mixes }, report.employees?.name)}
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
          <RefreshCw size={14} style={syncingReport ? { animation: 'spin 1s linear infinite' } : {}} /> {syncingReport ? 'Syncing...' : 'Sync'}
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
    </div>
  )
}
