import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import { AlertTriangle, Eye, Trash2, Edit3, RefreshCw } from 'lucide-react'
import { exportShiftReportPDF } from '../lib/pdfExport'
import PageHeader from '../components/PageHeader'

export default function ReportView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const [report, setReport] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [machineProduction, setMachineProduction] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [equipmentDiesel, setEquipmentDiesel] = useState([])
  const [pelletStock, setPelletStock] = useState([])
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [createdByName, setCreatedByName] = useState(null)
  const [dieselStock, setDieselStock] = useState(null)
  const [syncingReport, setSyncingReport] = useState(false)

  useEffect(() => {
    if (id) { fetchReport() }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteReport() {
    if (!window.confirm('Are you sure you want to delete this report? This cannot be undone.')) return
    try {
      setDeleting(true)
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
    } finally { setDeleting(false) }
  }

  async function syncReport(silent) {
    if (!report) return
    setSyncingReport(true)
    try {
      const normalizeTime = (t) => t ? t.substring(0, 5) : t
      const shiftStartDate = report.shift_start_date || report.date
      const shiftEndDate = report.shift_end_date || report.date
      const startTime = normalizeTime(report.start_time) || '06:00'
      const endTime = normalizeTime(report.end_time) || '18:00'
      const shiftStart = shiftStartDate + 'T' + startTime + ':00'
      const shiftEnd = shiftEndDate + 'T' + endTime + ':00'

      const { data: matchingDispatches, error: dispErr } = await supabase
        .from('vehicle_dispatches').select('id')
        .eq('plant_id', report.plant_id).eq('is_deleted', false)
        .gte('dispatch_datetime', shiftStart).lte('dispatch_datetime', shiftEnd)
      if (dispErr) throw dispErr

      await supabase.from('vehicle_dispatches').update({ shift_report_id: null }).eq('shift_report_id', id)

      if (matchingDispatches && matchingDispatches.length > 0) {
        await supabase.from('vehicle_dispatches').update({ shift_report_id: id }).in('id', matchingDispatches.map(d => d.id))
      }

      const { data: rmUsageRows, error: rmErr } = await supabase
        .from('raw_material_usage').select('id, raw_material_type_id').eq('shift_report_id', id)
      if (rmErr) throw rmErr

      if (rmUsageRows && rmUsageRows.length > 0) {
        const { data: purchases } = await supabase
          .from('raw_material_purchases').select('raw_material_type_id, net_weight')
          .eq('plant_id', report.plant_id).eq('is_deleted', false)
          .gte('purchase_datetime', shiftStart).lte('purchase_datetime', shiftEnd)

        const purchasedByType = {}
        if (purchases) {
          for (const p of purchases) {
            purchasedByType[p.raw_material_type_id] = (purchasedByType[p.raw_material_type_id] || 0) + (parseFloat(p.net_weight) || 0)
          }
        }

        for (const row of rmUsageRows) {
          const newPurchased = purchasedByType[row.raw_material_type_id] || 0
          const { data: currentRow } = await supabase
            .from('raw_material_usage').select('opening_kg, quantity_kg').eq('id', row.id).single()
          if (currentRow) {
            const opening = parseFloat(currentRow.opening_kg) || 0
            const used = parseFloat(currentRow.quantity_kg) || 0
            await supabase.from('raw_material_usage')
              .update({ purchased_kg: newPurchased, closing_kg: opening + newPurchased - used }).eq('id', row.id)
          }
        }
      }

      if (!silent) showToast('Report synced successfully!', 'success')
      await fetchReport()
    } catch (err) {
      console.error('Sync error:', err)
      if (!silent) showToast('Failed to sync report', 'error')
    } finally { setSyncingReport(false) }
  }

  const hasSynced = useRef(false)

  async function fetchReport() {
    try {
      setLoading(true)
      const { data: reportData, error: reportError } = await supabase
        .from('shift_reports').select('*, plants(name), employees!supervisor_id(name)').eq('id', id).single()
      if (reportError) {
        console.error('Report fetch error:', reportError)
        if (reportError.code === 'PGRST116') { showToast('Report not found', 'error'); navigate('/reports'); return }
        throw reportError
      }
      if (!reportData) { showToast('Report not found', 'error'); navigate('/reports'); return }
      setReport(reportData)
      const [machRes, matRes, dispatchRes, dieselRes, stockRes, issuesRes] = await Promise.all([
        supabase.from('machine_production').select('*, machines(name)').eq('shift_report_id', id),
        supabase.from('raw_material_usage').select('*, raw_material_types(name)').eq('shift_report_id', id),
        supabase.from('vehicle_dispatches').select('*, dispatch_pellets(*, pellet_types(name)), customers(name)').eq('shift_report_id', id),
        supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', id),
        supabase.from('pellet_stock').select('*, pellet_types(name)').eq('shift_report_id', id),
        supabase.from('issues').select('*').eq('shift_report_id', id),
      ])
      setMachineProduction(machRes.data || [])
      setRawMaterials(matRes.data || [])
      setDispatches(dispatchRes.data || [])
      setEquipmentDiesel(dieselRes.data || [])
      setPelletStock(stockRes.data || [])
      setIssues(issuesRes.data || [])
    } catch (err) {
      console.error('Error fetching report:', err)
      showToast('Failed to load report', 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (report && !loading && !hasSynced.current) {
      hasSynced.current = true
      syncReport(true)
    }
  }, [report, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (report?.created_by) {
      supabase.from('employees').select('name').eq('auth_user_id', report.created_by).single()
        .then(({ data }) => {
          if (data) setCreatedByName(data.name)
          else if (report.employees?.name) setCreatedByName(report.employees.name)
        })
    } else if (report?.employees?.name) setCreatedByName(report.employees.name)
    if (id) {
      supabase.from('diesel_stock').select('*').eq('shift_report_id', id).single()
        .then(({ data }) => { if (data) setDieselStock(data) })
    }
  }, [report?.created_by, id])

  if (loading) return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ color: '#595c4a', fontSize: 13 }}>Loading report...</div></div>)
  if (!report) return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ color: '#595c4a', fontSize: 13 }}>Report not found</div></div>)

  function formatShortDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  const startDateLabel = formatShortDate(report.shift_start_date || report.date)
  const endDateLabel = formatShortDate(report.shift_end_date || report.date)
  const showBothDates = (report.shift_start_date || report.date) !== (report.shift_end_date || report.date)
  const machineTimings = machineProduction.map(m => ({ name: m.machines?.name || 'Unknown', hours_run: m.hours_run || 0, production_mt: m.production_mt || 0 }))

  const tblWrap = { overflowX: 'auto', WebkitOverflowScrolling: 'touch' }
  const thStyle = (align) => ({ padding: '10px 12px', textAlign: align || 'left', fontWeight: 700, color: '#fff', fontSize: 11 })
  const tdStyle = (align, bold) => ({ padding: '10px 12px', textAlign: align || 'left', fontWeight: bold ? 700 : 500, color: bold ? '#2c2c2c' : '#595c4a', fontSize: 11 })

  return (
    <div style={{ minHeight: '100%', background: '#fefae0', paddingBottom: 80, overflowX: 'hidden', maxWidth: '100vw' }}>
      <PageHeader title="Shift Report" subtitle={'Shift ' + report.shift + ' | ' + report.date} onBack={() => navigate(-1)} />
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>
            <span>{startDateLabel}{showBothDates ? ' - ' + endDateLabel : ''}</span>
            <span style={{ color: '#595c4a' }}>{'Shift ' + report.shift + ' (' + (report.start_time?.slice(0, 5) || '') + ' - ' + (report.end_time?.slice(0, 5) || '') + ')'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#2c2c2c', borderTop: '1px solid #e5ddd0', paddingTop: 12 }}>
            <span>Production: <span style={{ color: '#2d6a4f', fontWeight: 700 }}>{(report.pellet_production_mt || 0).toFixed(1)} MT</span></span>
            <span>Dispatches: <span style={{ color: '#2d6a4f', fontWeight: 700 }}>{(dispatches.reduce((sum, d) => sum + (d.dispatch_pellets?.reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0) || 0), 0)).toFixed(1)} MT</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#595c4a', borderTop: '1px solid #e5ddd0', paddingTop: 12 }}>
            <span>Supervisor: <span style={{ fontWeight: 600, color: '#2c2c2c' }}>{report.employees?.name || 'N/A'}</span></span>
            <span>Plant: <span style={{ fontWeight: 600, color: '#2c2c2c' }}>{report.plants?.name || 'N/A'}</span></span>
          </div>
        </div>
      </div>

      {/* Machine Timings */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Machine Timings</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <div style={tblWrap}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}><tr>
              <th style={thStyle('left')}>Machine</th><th style={thStyle('right')}>Hours Run</th><th style={thStyle('right')}>Production (MT)</th>
            </tr></thead>
            <tbody>{machineTimings.length > 0 ? machineTimings.map((m, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid #e5ddd0' }}>
                <td style={tdStyle('left', true)}>{m.name}</td>
                <td style={tdStyle('right', true)}>{m.hours_run}h</td>
                <td style={tdStyle('right', true)}>{m.production_mt}</td>
              </tr>
            )) : <tr><td colSpan="3" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td></tr>}</tbody>
          </table></div>
        </div>
      </div>

      {/* Production */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Production</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <div style={tblWrap}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}><tr>
              <th style={thStyle('left')}>Machine</th><th style={thStyle('left')}>Pellet Type</th><th style={thStyle('right')}>Quantity (MT)</th>
            </tr></thead>
            <tbody>{machineProduction.length > 0 ? machineProduction.map(m => (
              <tr key={m.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                <td style={tdStyle('left', true)}>{m.machines?.name || 'N/A'}</td>
                <td style={tdStyle('left', false)}>{m.pellet_type_name || '-'}</td>
                <td style={tdStyle('right', true)}>{m.production_mt || 0}</td>
              </tr>
            )) : <tr><td colSpan="3" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td></tr>}</tbody>
          </table></div>
        </div>
      </div>

      {/* Raw Materials */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Raw Materials</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <div style={tblWrap}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}><tr>
              <th style={thStyle('left')}>Material</th><th style={thStyle('right')}>Opening</th><th style={thStyle('right')}>Purchased</th><th style={thStyle('right')}>Used</th><th style={thStyle('right')}>Closing</th>
            </tr></thead>
            <tbody>{rawMaterials.length > 0 ? rawMaterials.map(m => (
              <tr key={m.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                <td style={tdStyle('left', true)}>{m.raw_material_types?.name || 'N/A'}</td>
                <td style={tdStyle('right', false)}>{m.opening_kg || 0}</td>
                <td style={tdStyle('right', false)}>{m.purchased_kg || 0}</td>
                <td style={tdStyle('right', false)}>{m.quantity_kg || 0}</td>
                <td style={tdStyle('right', true)}>{m.closing_kg || 0}</td>
              </tr>
            )) : <tr><td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td></tr>}</tbody>
          </table></div>
        </div>
      </div>

      {/* Equipment & Diesel */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Equipment & Diesel</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <div style={tblWrap}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead style={{ background: '#2d6a4f' }}><tr>
              <th style={thStyle('left')}>Equipment</th><th style={thStyle('right')}>Opening (L)</th><th style={thStyle('right')}>Added (L)</th><th style={thStyle('right')}>Closing (L)</th><th style={thStyle('right')}>Hours</th>
            </tr></thead>
            <tbody>{equipmentDiesel.length > 0 ? equipmentDiesel.map(e => (
              <tr key={e.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                <td style={tdStyle('left', true)}>{e.equipment_name || 'N/A'}</td>
                <td style={tdStyle('right', false)}>{Math.round(e.opening_litres || 0)}</td>
                <td style={tdStyle('right', false)}>{Math.round(e.added_litres || 0)}</td>
                <td style={tdStyle('right', true)}>{Math.round(e.closing_litres || 0)}</td>
                <td style={tdStyle('right', false)}>{e.hours_worked || 0}h</td>
              </tr>
            )) : <tr><td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td></tr>}</tbody>
          </table></div>
        </div>
      </div>

      {dieselStock && (
        <div style={{ padding: '0 20px', marginTop: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Diesel Stock Tank</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
              {[{ label: 'Opening (L)', value: Math.round(dieselStock.opening_litres || 0) },
                { label: 'Purchased (L)', value: Math.round(dieselStock.purchased_litres || 0) },
                { label: 'Used (L)', value: Math.round(dieselStock.used_litres || 0) },
                { label: 'Closing (L)', value: Math.round(dieselStock.closing_litres || 0) }
              ].map((item, idx) => (
                <div key={idx}>
                  <div style={{ fontSize: 10, color: '#8a8d7a', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dispatches */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Vehicle Dispatches</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <div style={tblWrap}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 500 }}>
            <thead style={{ background: '#2d6a4f' }}><tr>
              <th style={thStyle('left')}>Truck</th><th style={thStyle('left')}>Customer</th><th style={thStyle('left')}>Pellet Type</th><th style={thStyle('right')}>Qty (MT)</th><th style={thStyle('right')}>Time</th>
            </tr></thead>
            <tbody>{dispatches.length > 0 ? dispatches.map(d => (
              <tr key={d.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                <td style={tdStyle('left', true)}>{d.truck_number}</td>
                <td style={tdStyle('left', false)}>{d.customers?.name || 'N/A'}</td>
                <td style={tdStyle('left', false)}>{d.dispatch_pellets?.map(p => p.pellet_types?.name).filter(Boolean).join(', ') || 'N/A'}</td>
                <td style={tdStyle('right', true)}>{d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0).toFixed(1) || 0}</td>
                <td style={tdStyle('right', false)}>{d.dispatch_time?.slice(0, 5) || '-'}</td>
              </tr>
            )) : <tr><td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td></tr>}</tbody>
          </table></div>
        </div>
      </div>

      {/* Pellet Stock */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Pellet Stock</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <div style={tblWrap}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 520 }}>
            <thead style={{ background: '#2d6a4f' }}><tr>
              <th style={thStyle('left')}>Type</th><th style={thStyle('right')}>Opening</th><th style={thStyle('right')}>Production</th><th style={thStyle('right')}>Dispatch</th><th style={thStyle('right')}>Wastage</th><th style={thStyle('right')}>Closing</th>
            </tr></thead>
            <tbody>{pelletStock.length > 0 ? pelletStock.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                <td style={tdStyle('left', true)}>{p.pellet_types?.name || 'N/A'}</td>
                <td style={tdStyle('right', false)}>{p.opening_mt || 0}</td>
                <td style={tdStyle('right', false)}>{p.production_mt || 0}</td>
                <td style={tdStyle('right', false)}>{p.dispatch_mt || 0}</td>
                <td style={tdStyle('right', false)}>{p.wastage_mt || 0}</td>
                <td style={tdStyle('right', true)}>{p.closing_mt || 0}</td>
              </tr>
            )) : <tr><td colSpan="6" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11 }}>No data</td></tr>}</tbody>
          </table></div>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div style={{ padding: '0 20px', marginTop: 24 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Issues Reported</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {issues.map(issue => (
              <div key={issue.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ marginTop: 2 }}><AlertTriangle size={16} style={{ color: '#d32f2f' }} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2c', textTransform: 'capitalize' }}>{issue.issue_type}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 4,
                        ...(issue.severity === 'High' ? { background: '#FEE2E2', color: '#B91C1C' } : issue.severity === 'Medium' ? { background: '#FEF3C7', color: '#B45309' } : { background: '#DBEAFE', color: '#1E40AF' })
                      }}>{issue.severity}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#595c4a', marginTop: 4 }}>{issue.description}</p>
                    {issue.photo_url && (<div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, color: '#1E3A5F', fontSize: 10, fontWeight: 500 }}><Eye size={12} /> Photo attached</div>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.handover_notes && (
        <div style={{ padding: '0 20px', marginTop: 24 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Handover Notes</h2>
          <div style={{ background: '#fefae0', border: '1.5px solid #e9c46a', borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>{report.handover_notes}</p>
          </div>
        </div>
      )}

      {(createdByName || report.created_at) && (
        <div style={{ padding: '0 20px', marginTop: 24 }}>
          <div style={{ background: '#f5f0e1', borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#595c4a' }}>
              {createdByName ? 'Created by ' + createdByName : 'Created'}{report.created_at ? ' at ' + new Date(report.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
            </span>
            {can(employee?.role, 'export') && (
              <button onClick={() => exportShiftReportPDF(report, { machineProduction, rawMaterials, equipmentDiesel, pelletStock, dispatches, issues, dieselStock }, createdByName)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#2d6a4f', color: 'white', border: 'none', cursor: 'pointer' }}>
                <Download size={12} /> PDF
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: '0 20px', marginTop: 24, paddingBottom: 16, display: 'flex', gap: 12 }}>
        {can(employee?.role, 'create_report') && (
          <button onClick={() => navigate('/shift/edit/' + id)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 0', borderRadius: 14, fontSize: 14, fontWeight: 700, background: '#2d6a4f', color: 'white', border: 'none', cursor: 'pointer' }}>
            <Edit3 size={16} /> Edit Report
          </button>
        )}
        {can(employee?.role, 'create_report') && (
          <button onClick={() => syncReport(false)} disabled={syncingReport}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px', borderRadius: 14, fontSize: 13, fontWeight: 700, background: '#FEF3C7', color: '#92400E', border: '1.5px solid #FDE68A', cursor: syncingReport ? 'not-allowed' : 'pointer', opacity: syncingReport ? 0.6 : 1 }}>
            <RefreshCw size={14} style={syncingReport ? { animation: 'spin 1s linear infinite' } : {}} /> {syncingReport ? 'Syncing...' : 'Sync'}
          </button>
        )}
        {can(employee?.role, 'create_report') && (
          <button onClick={deleteReport} disabled={deleting}
            style={{ padding: '14px 20px', borderRadius: 14, fontSize: 14, fontWeight: 700, background: '#FEE2E2', color: '#B91C1C', border: '1.5px solid #FECACA', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.5 : 1 }}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
