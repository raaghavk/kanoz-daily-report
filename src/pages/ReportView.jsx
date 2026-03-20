import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import { exportDetailedReportToCSV } from '../lib/exportUtils'
import { AlertTriangle, Eye, Edit3, Download, FileSpreadsheet, Printer } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import DeleteRequestButton from '../components/DeleteRequestButton'

export default function ReportView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const [report, setReport] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [machineProduction, setMachineProduction] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [dispatches, setDispatches] = useState([])
  const [equipmentDiesel, setEquipmentDiesel] = useState([])
  const [pelletStock, setPelletStock] = useState([])
  const [issues, setIssues] = useState([])
  const [dieselStock, setDieselStock] = useState(null)
  const [allMachines, setAllMachines] = useState([])
  const [allRawMaterialTypes, setAllRawMaterialTypes] = useState([])
  const [allEquipment, setAllEquipment] = useState([])
  const [allPelletTypes, setAllPelletTypes] = useState([])
  const [rmPurchases, setRmPurchases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchReport()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function fetchReport() {
    try {
      setLoading(true)

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

      const startDate = reportData.shift_start_date || reportData.date
      const endDate = reportData.shift_end_date || reportData.date

      const [
        machRes, matRes, dispatchRes, dieselRes, stockRes, issuesRes, dsRes,
        machinesRes, rmTypesRes, equipmentRes, pelletTypesRes, rmPurchasesRes,
      ] = await Promise.all([
        supabase.from('machine_production').select('*, machines(name)').eq('shift_report_id', id),
        supabase.from('raw_material_usage').select('*, raw_material_types(name)').eq('shift_report_id', id),
        supabase.from('vehicle_dispatches').select('*, dispatch_pellets(*, pellet_types(name)), customers(name)').eq('shift_report_id', id),
        supabase.from('equipment_diesel_log').select('*').eq('shift_report_id', id),
        supabase.from('pellet_stock').select('*, pellet_types(name)').eq('shift_report_id', id),
        supabase.from('issues').select('*, machines(name)').eq('shift_report_id', id),
        supabase.from('diesel_stock').select('*').eq('shift_report_id', id).maybeSingle(),
        supabase.from('machines').select('id, name, sort_order').eq('plant_id', reportData.plant_id).eq('is_active', true).order('sort_order'),
        supabase.from('raw_material_types').select('id, name').eq('plant_id', reportData.plant_id).eq('is_active', true).order('name'),
        supabase.from('equipment').select('id, name, sort_order').eq('plant_id', reportData.plant_id).eq('is_active', true).order('sort_order'),
        supabase.from('pellet_types').select('id, name').eq('plant_id', reportData.plant_id).eq('is_active', true).order('name'),
        supabase.from('raw_material_purchases').select('raw_material_type_id, quantity_kg').eq('plant_id', reportData.plant_id).gte('date', startDate).lte('date', endDate).neq('is_deleted', true),
      ])

      if (machRes.error) console.error('machine_production:', machRes.error)
      if (matRes.error) console.error('raw_material_usage:', matRes.error)
      if (dispatchRes.error) console.error('vehicle_dispatches:', dispatchRes.error)
      if (dieselRes.error) console.error('equipment_diesel_log:', dieselRes.error)
      if (stockRes.error) console.error('pellet_stock:', stockRes.error)
      if (issuesRes.error) console.error('issues:', issuesRes.error)
      if (dsRes.error) console.error('diesel_stock:', dsRes.error)
      if (machinesRes.error) console.error('machines:', machinesRes.error)
      if (rmTypesRes.error) console.error('raw_material_types:', rmTypesRes.error)
      if (equipmentRes.error) console.error('equipment:', equipmentRes.error)
      if (pelletTypesRes.error) console.error('pellet_types:', pelletTypesRes.error)
      if (rmPurchasesRes.error) console.error('raw_material_purchases:', rmPurchasesRes.error)

      setMachineProduction(machRes.data || [])
      setRawMaterials(matRes.data || [])
      setDispatches(dispatchRes.data || [])
      setEquipmentDiesel(dieselRes.data || [])
      setPelletStock(stockRes.data || [])
      setIssues(issuesRes.data || [])
      setDieselStock(dsRes.data || null)
      setAllMachines(machinesRes.data || [])
      setAllRawMaterialTypes(rmTypesRes.data || [])
      setAllEquipment(equipmentRes.data || [])
      setAllPelletTypes(pelletTypesRes.data || [])
      setRmPurchases(rmPurchasesRes.data || [])
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

  const startDate = report.shift_start_date || report.date
  const endDate = report.shift_end_date || report.date
  const startDateLabel = formatShortDate(startDate)
  const endDateLabel = formatShortDate(endDate)
  const startTime = report.start_time?.slice(0, 5) || '—'
  const endTime = report.end_time?.slice(0, 5) || '—'

  // Build lookups for machine production
  // machTimingByMachineId: first row per machine (for timing data in Machine Timings section)
  const machTimingByMachineId = {}
  // machProdRowsByMachineId: all rows per machine (for Production section)
  const machProdRowsByMachineId = {}
  for (const row of machineProduction) {
    if (!machTimingByMachineId[row.machine_id]) {
      machTimingByMachineId[row.machine_id] = row
    }
    if (!machProdRowsByMachineId[row.machine_id]) machProdRowsByMachineId[row.machine_id] = []
    machProdRowsByMachineId[row.machine_id].push(row)
  }

  // Total dispatched MT
  const totalDispatchedMt = dispatches.reduce(
    (sum, d) => sum + (d.dispatch_pellets?.reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0) || 0),
    0
  )

  function generatePrintHTML() {
    const machineTimingRows = displayMachines.map(m => {
      const timing = machTimingByMachineId[m.id]
      if (!timing) return `<tr><td>${m.name}</td><td colspan="5" style="text-align:center;color:#888;font-style:italic">Did Not Run</td></tr>`
      const allRows = machProdRowsByMachineId[m.id] || []
      const totalProdMt = allRows.reduce((sum, r) => sum + (parseFloat(r.production_mt) || 0), 0)
      const prdHrs = parseFloat(timing.hours_run) || 0
      const totalHrs = parseFloat(timing.total_hours) || prdHrs
      const avgPerHr = prdHrs > 0 ? (totalProdMt / prdHrs).toFixed(2) : '—'
      return `<tr><td>${m.name}</td><td>${prdHrs}h</td><td>${totalHrs}h</td><td>${totalProdMt}</td><td>${avgPerHr}</td><td>${timing.remarks || '—'}</td></tr>`
    }).join('')

    const prodRows = displayMachines.map(m => {
      const rows = machProdRowsByMachineId[m.id] || []
      const timing = machTimingByMachineId[m.id]
      const prdHrs = parseFloat(timing?.hours_run) || 0
      if (rows.length === 0) return `<tr><td>${m.name}</td><td colspan="3" style="text-align:center;color:#888;font-style:italic">No production this shift</td></tr>`
      const filtered = rows.filter(r => parseFloat(r.production_mt) > 0 || r.pellet_type_name)
      if (filtered.length === 0) return `<tr><td>${m.name}</td><td colspan="3" style="text-align:center;color:#888;font-style:italic">No production this shift</td></tr>`
      return filtered.map((row, idx) => {
        const qty = parseFloat(row.production_mt) || 0
        const avg = prdHrs > 0 ? (qty / prdHrs).toFixed(2) : '—'
        return `<tr><td>${idx === 0 ? m.name : ''}</td><td>${row.pellet_type_name || '—'}</td><td style="text-align:right">${qty}</td><td style="text-align:right">${avg}</td></tr>`
      }).join('')
    }).join('')

    const rmSource = allRawMaterialTypes.length > 0 ? allRawMaterialTypes : rawMaterials.map(m => ({ id: m.raw_material_type_id, name: m.raw_material_types?.name || 'N/A' }))
    const rmRows = rmSource.map(type => {
      const usage = rawMaterials.find(m => m.raw_material_type_id === type.id)
      const livePurchased = rmPurchases.filter(p => p.raw_material_type_id === type.id).reduce((sum, p) => sum + (parseFloat(p.quantity_kg) || 0), 0)
      const purchased = livePurchased > 0 ? livePurchased : (usage?.purchased_kg ?? 0)
      return `<tr><td>${type.name}</td><td style="text-align:right">${usage?.opening_kg ?? 0}</td><td style="text-align:right">${purchased}</td><td style="text-align:right">${usage?.quantity_kg ?? 0}</td><td style="text-align:right">${usage?.closing_kg ?? 0}</td></tr>`
    }).join('')

    const eqSource = allEquipment.length > 0 ? allEquipment : equipmentDiesel.map(e => ({ id: e.id, name: e.equipment_name }))
    const eqRows = eqSource.map(eq => {
      const log = equipmentDiesel.find(e => e.equipment_name === eq.name)
      if (!log) return `<tr><td>${eq.name}</td><td colspan="6" style="text-align:center;color:#888;font-style:italic">Not recorded</td></tr>`
      const used = (log.opening_litres || 0) + (log.added_litres || 0) - (log.closing_litres || 0)
      const avg = log.hours_worked > 0 ? (used / log.hours_worked).toFixed(2) : '—'
      return `<tr><td>${eq.name}</td><td style="text-align:right">${log.opening_litres || 0}</td><td style="text-align:right">${log.added_litres || 0}</td><td style="text-align:right">${used}</td><td style="text-align:right">${log.closing_litres || 0}</td><td style="text-align:right">${log.hours_worked || 0}h</td><td style="text-align:right">${avg}</td></tr>`
    }).join('')

    const dispatchRows = dispatches.length > 0
      ? dispatches.map(d => {
          const pelletNames = d.dispatch_pellets?.map(p => p.pellet_types?.name).filter(Boolean).join(', ') || 'N/A'
          const qty = d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0).toFixed(1) || '0'
          return `<tr><td>${d.truck_number}</td><td>${d.customers?.name || 'N/A'}</td><td>${pelletNames}</td><td style="text-align:right">${qty}</td><td style="text-align:right">${d.dispatch_time?.slice(0, 5) || '—'}</td></tr>`
        }).join('')
      : '<tr><td colspan="5" style="text-align:center;color:#888;font-style:italic">No dispatches this shift</td></tr>'

    const pelletSource = allPelletTypes.length > 0 ? allPelletTypes : pelletStock.map(p => ({ id: p.pellet_type_id, name: p.pellet_types?.name || 'N/A' }))
    const pelletRows = pelletSource.map(type => {
      const stock = pelletStock.find(p => p.pellet_type_id === type.id)
      return `<tr><td>${type.name}</td><td style="text-align:right">${stock?.opening_mt ?? 0}</td><td style="text-align:right">${stock?.production_mt ?? 0}</td><td style="text-align:right">${stock?.dispatch_mt ?? 0}</td><td style="text-align:right">${stock?.wastage_mt ?? 0}</td><td style="text-align:right">${stock?.closing_mt ?? 0}</td></tr>`
    }).join('')

    const issuesHTML = issues.length > 0
      ? issues.map(i => `<div class="issue"><strong>${i.issue_type}${i.machines?.name ? ` — ${i.machines.name}` : ''}</strong> [${i.severity}]<p>${i.description}</p></div>`).join('')
      : ''

    const dieselHTML = dieselStock
      ? `<div class="diesel-grid">
          <div><div class="dlabel">Opening (L)</div><div class="dval">${dieselStock.opening_litres ?? '—'}</div></div>
          <div><div class="dlabel">Purchased (L)</div><div class="dval">${dieselStock.purchased_litres ?? '—'}</div></div>
          <div><div class="dlabel">Used (L)</div><div class="dval">${dieselStock.used_litres ?? '—'}</div></div>
          <div><div class="dlabel">Closing (L)</div><div class="dval">${dieselStock.closing_litres ?? '—'}</div></div>
        </div>`
      : '<p style="color:#888;font-style:italic">No diesel stock recorded</p>'

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Shift ${report.shift} Report — ${report.date}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #2c2c2c; margin: 0; padding: 16px; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  .meta { font-size: 10pt; color: #595c4a; margin-bottom: 16px; }
  .section { margin-bottom: 20px; }
  h2 { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #8a8d7a; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  thead tr { background: #2d6a4f; color: white; }
  th { padding: 8px; text-align: left; font-size: 9pt; }
  td { padding: 7px 8px; border-bottom: 1px solid #e5ddd0; }
  .header-card { border: 1.5px solid #e5ddd0; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .header-card .row { display: flex; justify-content: space-between; }
  .diesel-box { background: #fefae0; border: 1.5px solid #e9c46a; border-radius: 8px; padding: 12px; margin-top: 12px; }
  .diesel-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; }
  .dlabel { font-size: 8pt; color: #595c4a; font-weight: bold; margin-bottom: 2px; }
  .dval { font-size: 14pt; font-weight: bold; }
  .issue { padding: 8px; border-left: 3px solid #d32f2f; margin-bottom: 8px; }
  @media print { body { padding: 0; } @page { margin: 1cm; size: A4; } }
</style></head><body>
<h1>Shift ${report.shift} Report</h1>
<div class="meta">
  Date: ${startDateLabel} &nbsp;|&nbsp; Start: ${startDateLabel}, ${startTime} &nbsp;|&nbsp; End: ${endDateLabel}, ${endTime}<br>
  Production: ${(report.pellet_production_mt || 0).toFixed(1)} MT &nbsp;|&nbsp; Dispatches: ${totalDispatchedMt.toFixed(1)} MT<br>
  Supervisor: ${report.employees?.name || 'N/A'} &nbsp;|&nbsp; Plant: ${report.plants?.name || 'N/A'}
</div>

<div class="section">
  <h2>Machine Timings</h2>
  <table><thead><tr><th>Machine</th><th>Prd Hrs</th><th>Total Hrs</th><th>Prd (MT)</th><th>Avg/Hr</th><th>Remarks</th></tr></thead>
  <tbody>${machineTimingRows}</tbody></table>
</div>

<div class="section">
  <h2>Production</h2>
  <table><thead><tr><th>Machine</th><th>Pellet Type</th><th style="text-align:right">Qty (MT)</th><th style="text-align:right">Avg/Hr</th></tr></thead>
  <tbody>${prodRows}</tbody></table>
</div>

<div class="section">
  <h2>Raw Materials</h2>
  <table><thead><tr><th>Material</th><th style="text-align:right">Open</th><th style="text-align:right">Purch</th><th style="text-align:right">Used</th><th style="text-align:right">Close</th></tr></thead>
  <tbody>${rmRows || '<tr><td colspan="5" style="text-align:center;color:#888;font-style:italic">No data</td></tr>'}</tbody></table>
</div>

<div class="section">
  <h2>Equipment &amp; Diesel</h2>
  <table><thead><tr><th>Equipment</th><th style="text-align:right">Opening (L)</th><th style="text-align:right">Added (L)</th><th style="text-align:right">Used (L)</th><th style="text-align:right">Closing (L)</th><th style="text-align:right">Hrs</th><th style="text-align:right">Avg L/Hr</th></tr></thead>
  <tbody>${eqRows || '<tr><td colspan="7" style="text-align:center;color:#888;font-style:italic">No data</td></tr>'}</tbody></table>
  <div class="diesel-box"><h2 style="margin-bottom:8px">Diesel Stock Tank</h2>${dieselHTML}</div>
</div>

<div class="section">
  <h2>Vehicle Dispatches</h2>
  <table><thead><tr><th>Truck</th><th>Customer</th><th>Pellet Type</th><th style="text-align:right">Qty (MT)</th><th style="text-align:right">Time</th></tr></thead>
  <tbody>${dispatchRows}</tbody></table>
</div>

<div class="section">
  <h2>Pellet Stock</h2>
  <table><thead><tr><th>Type</th><th style="text-align:right">Open</th><th style="text-align:right">Prd</th><th style="text-align:right">Disp</th><th style="text-align:right">Waste</th><th style="text-align:right">Close</th></tr></thead>
  <tbody>${pelletRows || '<tr><td colspan="6" style="text-align:center;color:#888;font-style:italic">No data</td></tr>'}</tbody></table>
</div>

${issuesHTML ? `<div class="section"><h2>Issues Reported</h2>${issuesHTML}</div>` : ''}
${report.handover_notes ? `<div class="section"><h2>Handover Notes</h2><p>${report.handover_notes}</p></div>` : ''}
</body></html>`
  }

  function handlePrint() {
    const html = generatePrintHTML()
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      showToast('Please allow popups to export PDF', 'error')
      return
    }
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 400)
  }

  // The display machines list (all active machines, or fallback to production rows)
  const displayMachines = allMachines.length > 0
    ? allMachines
    : [...new Set(machineProduction.map(m => m.machine_id))].map(mid => ({
        id: mid,
        name: machineProduction.find(m => m.machine_id === mid)?.machines?.name || 'N/A',
      }))

  return (
    <div style={{ minHeight: '100%', background: '#fefae0', paddingBottom: 80 }}>
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 1cm; size: A4; }
        }
      ` }} />

      {/* Nav header — hidden on print */}
      <div className="no-print">
        <PageHeader
          title="Shift Report"
          subtitle={`Shift ${report.shift} · ${report.date}`}
          onBack={() => navigate(-1)}
          rightAction={
            can(employee?.role, 'create_report') ? (
              <button
                onClick={() => navigate(`/shift/edit/${id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'rgba(255,255,255,0.15)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
                }}
              >
                <Edit3 size={14} /> Edit
              </button>
            ) : null
          }
        />
      </div>

      {/* Report Header Card */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>

          {/* Row 1: Date | Shift */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>
            <span>Date: {startDateLabel}</span>
            <span>Shift: {report.shift}</span>
          </div>

          {/* Row 2: Start | End */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#595c4a', marginTop: 8 }}>
            <span>Start: {startDateLabel}, {startTime}</span>
            <span>End: {endDateLabel}, {endTime}</span>
          </div>

          {/* Row 3: Production | Dispatches */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, fontSize: 13, fontWeight: 600, color: '#2c2c2c', borderTop: '1px solid #e5ddd0' }}>
            <span>Production: <span style={{ color: '#2d6a4f', fontWeight: 700 }}>{(report.pellet_production_mt || 0).toFixed(1)} MT</span></span>
            <span>Dispatches: <span style={{ color: '#2d6a4f', fontWeight: 700 }}>{totalDispatchedMt.toFixed(1)} MT</span></span>
          </div>

          {/* Row 4: Supervisor | Plant */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, fontSize: 12, color: '#595c4a', borderTop: '1px solid #e5ddd0' }}>
            <span>Supervisor: <span style={{ fontWeight: 600, color: '#2c2c2c' }}>{report.employees?.name || 'N/A'}</span></span>
            <span>Plant: <span style={{ fontWeight: 600, color: '#2c2c2c' }}>{report.plants?.name || 'N/A'}</span></span>
          </div>
        </div>
      </div>

      {/* Machine Timings Section */}
      <div style={{ padding: '0 20px', marginTop: 8 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Machine Timings</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 11, minWidth: 460 }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 10 }}>Machine</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Prd Hrs</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Total Hrs</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Prd (MT)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Avg/Hr</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 10 }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {displayMachines.map(m => {
                const timing = machTimingByMachineId[m.id]
                if (!timing) {
                  return (
                    <tr key={m.id} style={{ borderTop: '1px solid #e5ddd0', background: '#fafaf8' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{m.name}</td>
                      <td colSpan="5" style={{ padding: '10px 8px', textAlign: 'center', color: '#b5b8a8', fontSize: 10, fontStyle: 'italic' }}>Did Not Run</td>
                    </tr>
                  )
                }
                const allRows = machProdRowsByMachineId[m.id] || []
                const totalProdMt = allRows.reduce((sum, r) => sum + (parseFloat(r.production_mt) || 0), 0)
                const prdHrs = parseFloat(timing.hours_run) || 0
                const totalHrs = parseFloat(timing.total_hours) || prdHrs
                const avgPerHr = prdHrs > 0 ? (totalProdMt / prdHrs).toFixed(2) : '—'
                return (
                  <tr key={m.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 10px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{m.name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{prdHrs}h</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{totalHrs}h</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{totalProdMt}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{avgPerHr}</td>
                    <td style={{ padding: '10px 8px', color: '#595c4a', fontSize: 11 }}>{timing.remarks || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Production</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 11 }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 10 }}>Machine</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 10 }}>Pellet Type</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Qty (MT)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Avg/Hr</th>
              </tr>
            </thead>
            <tbody>
              {displayMachines.map(m => {
                const rows = machProdRowsByMachineId[m.id] || []
                const timing = machTimingByMachineId[m.id]
                const prdHrs = parseFloat(timing?.hours_run) || 0

                if (rows.length === 0) {
                  return (
                    <tr key={m.id} style={{ borderTop: '1px solid #e5ddd0', background: '#fafaf8' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{m.name}</td>
                      <td colSpan="3" style={{ padding: '10px 8px', textAlign: 'center', color: '#b5b8a8', fontSize: 10, fontStyle: 'italic' }}>No production this shift</td>
                    </tr>
                  )
                }

                // Filter out rows with 0 production (timing-only rows)
                const prodRows = rows.filter(r => parseFloat(r.production_mt) > 0 || r.pellet_type_name)
                if (prodRows.length === 0) {
                  return (
                    <tr key={m.id} style={{ borderTop: '1px solid #e5ddd0', background: '#fafaf8' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{m.name}</td>
                      <td colSpan="3" style={{ padding: '10px 8px', textAlign: 'center', color: '#b5b8a8', fontSize: 10, fontStyle: 'italic' }}>No production this shift</td>
                    </tr>
                  )
                }

                return prodRows.map((row, idx) => {
                  const qty = parseFloat(row.production_mt) || 0
                  const avgPerHr = prdHrs > 0 ? (qty / prdHrs).toFixed(2) : '—'
                  return (
                    <tr key={`${m.id}-${idx}`} style={{ borderTop: '1px solid #e5ddd0' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>
                        {idx === 0 ? m.name : ''}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#595c4a', fontSize: 11 }}>{row.pellet_type_name || '—'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{qty}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{avgPerHr}</td>
                    </tr>
                  )
                })
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Materials Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Raw Materials</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 11 }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 10 }}>Material</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Open</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Purch</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Used</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Close</th>
              </tr>
            </thead>
            <tbody>
              {(allRawMaterialTypes.length > 0 ? allRawMaterialTypes : rawMaterials.map(m => ({ id: m.raw_material_type_id, name: m.raw_material_types?.name || 'N/A' }))).map(type => {
                const usage = rawMaterials.find(m => m.raw_material_type_id === type.id)
                // Live purchased amount from raw_material_purchases for this shift's date range
                const livePurchased = rmPurchases
                  .filter(p => p.raw_material_type_id === type.id)
                  .reduce((sum, p) => sum + (parseFloat(p.quantity_kg) || 0), 0)
                const purchased = livePurchased > 0 ? livePurchased : (usage?.purchased_kg ?? 0)
                const opening = usage?.opening_kg ?? 0
                const used = usage?.quantity_kg ?? 0
                const closing = usage?.closing_kg ?? 0
                return (
                  <tr key={type.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 10px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{type.name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{opening}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{purchased}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{used}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{closing}</td>
                  </tr>
                )
              })}
              {allRawMaterialTypes.length === 0 && rawMaterials.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11, fontStyle: 'italic' }}>No raw material data recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipment & Diesel Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Equipment & Diesel</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 11, minWidth: 480 }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 10, whiteSpace: 'nowrap' }}>Equipment</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10, whiteSpace: 'nowrap' }}>Opening (L)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10, whiteSpace: 'nowrap' }}>Added (L)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10, whiteSpace: 'nowrap' }}>Used (L)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10, whiteSpace: 'nowrap' }}>Closing (L)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10, whiteSpace: 'nowrap' }}>Hrs</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10, whiteSpace: 'nowrap' }}>Avg L/Hr</th>
              </tr>
            </thead>
            <tbody>
              {(allEquipment.length > 0 ? allEquipment : equipmentDiesel.map(e => ({ id: e.id, name: e.equipment_name }))).map(eq => {
                const log = equipmentDiesel.find(e => e.equipment_name === eq.name)
                if (!log) {
                  return (
                    <tr key={eq.id} style={{ borderTop: '1px solid #e5ddd0', background: '#fafaf8' }}>
                      <td style={{ padding: '10px 10px', fontWeight: 500, color: '#2c2c2c', fontSize: 11, whiteSpace: 'nowrap' }}>{eq.name}</td>
                      <td colSpan="6" style={{ padding: '10px 8px', textAlign: 'center', color: '#b5b8a8', fontSize: 10, fontStyle: 'italic' }}>Not recorded this shift</td>
                    </tr>
                  )
                }
                const used = (log.opening_litres || 0) + (log.added_litres || 0) - (log.closing_litres || 0)
                const avgPerHr = log.hours_worked > 0 ? (used / log.hours_worked).toFixed(2) : '—'
                return (
                  <tr key={eq.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 10px', fontWeight: 500, color: '#2c2c2c', fontSize: 11, whiteSpace: 'nowrap' }}>{eq.name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{log.opening_litres || 0}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{log.added_litres || 0}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{used}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{log.closing_litres || 0}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{log.hours_worked || 0}h</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{avgPerHr}</td>
                  </tr>
                )
              })}
              {allEquipment.length === 0 && equipmentDiesel.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11, fontStyle: 'italic' }}>No equipment data recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Diesel Stock Tank Summary — always shown */}
        <div style={{ marginTop: 12, background: '#fefae0', borderRadius: 12, border: '1.5px solid #e9c46a', padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Diesel Stock Tank</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
            {[
              { label: 'Opening (L)', value: dieselStock?.opening_litres ?? '—' },
              { label: 'Purchased (L)', value: dieselStock?.purchased_litres ?? '—' },
              { label: 'Used (L)', value: dieselStock?.used_litres ?? '—' },
              { label: 'Closing (L)', value: dieselStock?.closing_litres ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: '#595c4a', fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#2c2c2c' }}>{value}</div>
              </div>
            ))}
          </div>
          {dieselStock?.purchase_cost > 0 && (
            <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#92400E' }}>
              Purchase Cost: ₹{Number(dieselStock.purchase_cost).toLocaleString('en-IN')}
            </div>
          )}
        </div>
      </div>

      {/* Dispatches Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Vehicle Dispatches</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 12 }}>
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
                  <td colSpan="5" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11, fontStyle: 'italic' }}>No dispatches this shift</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pellet Stock Section */}
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Pellet Stock</h2>
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 11 }}>
            <thead style={{ background: '#2d6a4f' }}>
              <tr>
                <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 10 }}>Type</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Open</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Prd</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Disp</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Waste</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#fff', fontSize: 10 }}>Close</th>
              </tr>
            </thead>
            <tbody>
              {(allPelletTypes.length > 0 ? allPelletTypes : pelletStock.map(p => ({ id: p.pellet_type_id, name: p.pellet_types?.name || 'N/A' }))).map(type => {
                const stock = pelletStock.find(p => p.pellet_type_id === type.id)
                return (
                  <tr key={type.id} style={{ borderTop: '1px solid #e5ddd0' }}>
                    <td style={{ padding: '10px 10px', fontWeight: 500, color: '#2c2c2c', fontSize: 11 }}>{type.name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{stock?.opening_mt ?? 0}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{stock?.production_mt ?? 0}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{stock?.dispatch_mt ?? 0}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#595c4a', fontSize: 11 }}>{stock?.wastage_mt ?? 0}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>{stock?.closing_mt ?? 0}</td>
                  </tr>
                )
              })}
              {allPelletTypes.length === 0 && pelletStock.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '16px 12px', textAlign: 'center', color: '#b5b8a8', fontSize: 11, fontStyle: 'italic' }}>No pellet stock recorded for this shift</td>
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
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2c', textTransform: 'capitalize' }}>
                        {issue.issue_type}{issue.machines?.name ? ` — ${issue.machines.name}` : ''}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 4,
                        ...(issue.severity === 'High' ? { background: '#FEE2E2', color: '#B91C1C' } :
                           issue.severity === 'Medium' ? { background: '#FEF3C7', color: '#B45309' } :
                           { background: '#DBEAFE', color: '#1E40AF' })
                      }}>
                        {issue.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#595c4a', marginTop: 4 }}>{issue.description}</p>
                    {issue.photo_url && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, color: '#1E3A5F', fontSize: 10, fontWeight: 500 }}>
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

      {/* Action Buttons — hidden on print */}
      <div className="no-print" style={{ padding: '0 20px', marginTop: 24, paddingBottom: 16 }}>
        {/* PDF Export — full-width primary */}
        {can(employee?.role, 'export') && (
          <button
            onClick={handlePrint}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: '#2d6a4f', color: 'white', border: 'none', cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            <Printer size={16} /> Export PDF
          </button>
        )}

        {/* Secondary buttons row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* CSV Export */}
          {can(employee?.role, 'export') && (
            <button
              onClick={() => exportDetailedReportToCSV({ report, machineProduction, rawMaterials, equipmentDiesel, pelletStock, dispatches, issues })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: '#e8f0ec', color: '#2d6a4f', border: '1.5px solid #b8d4c4',
                cursor: 'pointer',
              }}
            >
              <Download size={14} /> CSV
            </button>
          )}

          {/* Sheets Sync */}
          {can(employee?.role, 'export') && (
            <button
              onClick={syncToSheets}
              disabled={syncing}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: '#EDE9FE', color: '#6D28D9', border: '1.5px solid #DDD6FE',
                cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1,
              }}
            >
              <FileSpreadsheet size={14} /> {syncing ? 'Syncing...' : 'Sheets'}
            </button>
          )}

          {/* Request Delete */}
          {can(employee?.role, 'create_report') && (
            <DeleteRequestButton
              entityType="shift_report"
              entityId={id}
              entityLabel={`Shift ${report.shift} Report · ${report.date}`}
            />
          )}
        </div>
      </div>
    </div>
  )
}
