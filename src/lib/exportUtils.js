/**
 * CSV export utilities for shift reports
 */

function escapeCSV(value) {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCSVRow(values) {
  return values.map(escapeCSV).join(',')
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export a single detailed report to CSV (with all child data sections).
 * Uses the full report data already fetched by ReportView.
 */
export function exportDetailedReportToCSV({
  report,
  machineProduction = [],
  rawMaterials = [],
  equipmentDiesel = [],
  pelletStock = [],
  dispatches = [],
  issues = [],
}) {
  const lines = []

  // Report header
  lines.push('SHIFT REPORT')
  lines.push(buildCSVRow(['Date', report.date]))
  lines.push(buildCSVRow(['Shift', report.shift]))
  lines.push(buildCSVRow(['Time', `${report.start_time?.slice(0, 5)} - ${report.end_time?.slice(0, 5)}`]))
  lines.push(buildCSVRow(['Supervisor', report.employees?.name || 'N/A']))
  lines.push(buildCSVRow(['Plant', report.plants?.name || 'N/A']))
  lines.push(buildCSVRow(['Total Production (MT)', report.pellet_production_mt || 0]))
  lines.push('')

  // Machine timings
  lines.push('MACHINE TIMINGS')
  lines.push(buildCSVRow(['Machine', 'From', 'To', 'Hours', 'Breakdown Hours']))
  machineProduction.forEach(m => {
    lines.push(buildCSVRow([
      m.machines?.name || 'N/A',
      m.from_time || '-',
      m.to_time || '-',
      m.hours || 0,
      m.breakdown_hours || 0,
    ]))
  })
  lines.push('')

  // Production
  lines.push('PRODUCTION')
  lines.push(buildCSVRow(['Machine', 'Pellet Type', 'Quantity (MT)']))
  machineProduction.forEach(m => {
    lines.push(buildCSVRow([
      m.machines?.name || 'N/A',
      m.pellet_type || 'N/A',
      m.quantity_mt || 0,
    ]))
  })
  lines.push('')

  // Raw materials
  lines.push('RAW MATERIALS')
  lines.push(buildCSVRow(['Material', 'Opening', 'Purchased', 'Used', 'Closing']))
  rawMaterials.forEach(m => {
    lines.push(buildCSVRow([
      m.raw_materials?.name || m.name || 'N/A',
      m.opening_qty || 0,
      m.purchased_qty || 0,
      m.used_qty || 0,
      m.closing_qty || 0,
    ]))
  })
  lines.push('')

  // Equipment & diesel
  lines.push('EQUIPMENT & DIESEL')
  lines.push(buildCSVRow(['Equipment', 'Opening (L)', 'Added (L)', 'Closing (L)', 'Hours']))
  equipmentDiesel.forEach(e => {
    lines.push(buildCSVRow([
      e.equipment_name || 'N/A',
      e.opening_litres || 0,
      e.added_litres || 0,
      e.closing_litres || 0,
      e.hours_operated || 0,
    ]))
  })
  lines.push('')

  // Dispatches
  lines.push('VEHICLE DISPATCHES')
  lines.push(buildCSVRow(['Truck', 'Customer', 'Pellet Type', 'Qty (MT)', 'Time']))
  dispatches.forEach(d => {
    const pelletTypes = d.dispatch_pellets?.map(p => p.pellet_types?.name).join('; ') || 'N/A'
    const totalQty = d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0) || 0
    lines.push(buildCSVRow([
      d.truck_number,
      d.customers?.name || 'N/A',
      pelletTypes,
      totalQty.toFixed(1),
      d.dispatch_time?.slice(0, 5) || '-',
    ]))
  })
  lines.push('')

  // Pellet stock
  lines.push('PELLET STOCK')
  lines.push(buildCSVRow(['Type', 'Opening', 'Production', 'Dispatch', 'Wastage', 'Closing']))
  pelletStock.forEach(p => {
    lines.push(buildCSVRow([
      p.pellet_types?.name || 'N/A',
      p.opening_mt || 0,
      p.production_mt || 0,
      p.dispatch_mt || 0,
      p.wastage_mt || 0,
      p.closing_mt || 0,
    ]))
  })
  lines.push('')

  // Issues
  if (issues.length > 0) {
    lines.push('ISSUES')
    lines.push(buildCSVRow(['Type', 'Description', 'Severity']))
    issues.forEach(i => {
      lines.push(buildCSVRow([i.issue_type, i.description, i.severity]))
    })
    lines.push('')
  }

  // Handover notes
  if (report.handover_notes) {
    lines.push('HANDOVER NOTES')
    lines.push(escapeCSV(report.handover_notes))
  }

  const csv = lines.join('\n')
  const filename = `shift-report-${report.date}-shift${report.shift}.csv`
  downloadCSV(csv, filename)
}

/**
 * Export a list of reports as a summary CSV (one row per report).
 * Used from ReportList.
 */
export function exportReportListToCSV(reports) {
  const headers = ['Date', 'Shift', 'Supervisor', 'Start Time', 'End Time', 'Production (MT)', 'Status']
  const lines = [buildCSVRow(headers)]

  reports.forEach(r => {
    lines.push(buildCSVRow([
      r.date,
      r.shift,
      r.employees?.name || 'N/A',
      r.start_time?.slice(0, 5) || '',
      r.end_time?.slice(0, 5) || '',
      r.total_mt?.toFixed(1) || r.pellet_production_mt || 0,
      r.status || 'submitted',
    ]))
  })

  const csv = lines.join('\n')
  const filename = `shift-reports-export-${new Date().toISOString().split('T')[0]}.csv`
  downloadCSV(csv, filename)
}
