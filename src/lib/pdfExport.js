// Load jsPDF from CDN dynamically
let jsPDFLoaded = null
async function loadJsPDF() {
  if (jsPDFLoaded) return jsPDFLoaded
  return new Promise((resolve, reject) => {
    if (window.jspdf) { jsPDFLoaded = window.jspdf; resolve(jsPDFLoaded); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    script.onload = () => { jsPDFLoaded = window.jspdf; resolve(jsPDFLoaded) }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function formatTimestamp(ts) {
  if (!ts) return 'N/A'
  const d = new Date(ts)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

// Shared PDF header
function drawHeader(doc, title, subtitle) {
  doc.setFillColor(45, 106, 79)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 15, 15)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitle, 15, 23)
  return 40
}

// Shared footer with created_by
function drawFooter(doc, createdBy, createdAt, updatedAt) {
  const y = 275
  doc.setDrawColor(45, 106, 79)
  doc.setLineWidth(0.3)
  doc.line(15, y, 195, y)
  doc.setFontSize(8)
  doc.setTextColor(89, 92, 74)
  doc.text('Created by: ' + (createdBy || 'Unknown') + ' at ' + formatTimestamp(createdAt), 15, y + 6)
  if (updatedAt && updatedAt !== createdAt) {
    doc.text('Last updated: ' + formatTimestamp(updatedAt), 15, y + 11)
  }
  doc.text('Kanoz Daily Report | app.kanoz.in | Generated: ' + new Date().toLocaleString('en-IN'), 15, y + 17)
}

// Table helper
function drawTable(doc, y, headers, rows, colWidths) {
  const startX = 15
  const rowH = 7
  // Header
  doc.setFillColor(45, 106, 79)
  doc.rect(startX, y, colWidths.reduce((a,b) => a+b, 0), rowH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  let x = startX + 3
  headers.forEach((h, i) => { doc.text(h, x, y + 5); x += colWidths[i] })
  y += rowH
  // Rows
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(44, 44, 44)
  rows.forEach((row, ri) => {
    if (ri % 2 === 0) { doc.setFillColor(254, 250, 224); doc.rect(startX, y, colWidths.reduce((a,b) => a+b, 0), rowH, 'F') }
    x = startX + 3
    doc.setTextColor(44, 44, 44)
    row.forEach((cell, ci) => { doc.text(String(cell || ''), x, y + 5); x += colWidths[ci] })
    y += rowH
  })
  return y + 4
}

// DISPATCH PDF
export async function exportDispatchPDF(dispatch, createdByName) {
  const lib = await loadJsPDF()
  const doc = new lib.jsPDF()
  const totalMT = dispatch.dispatch_pellets?.reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0) || 0
  const dateStr = dispatch.date ? new Date(dispatch.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'
  let y = drawHeader(doc, 'Dispatch Report', dispatch.truck_number + ' | ' + dateStr)

  // Summary
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(45, 106, 79)
  doc.text('Summary', 15, y); y += 8
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(44, 44, 44)
  const info = [
    ['Customer', dispatch.customers?.name || 'N/A'], ['Destination', dispatch.destination || 'N/A'],
    ['Transporter', dispatch.transporter || 'N/A'], ['Invoice No', dispatch.invoice_no || 'N/A'],
    ['Loading Time', dispatch.loading_time?.slice(0,5) || 'N/A'], ['Dispatch Time', dispatch.dispatch_time?.slice(0,5) || 'N/A'],
    ['Driver', dispatch.driver_name || 'N/A'], ['Driver Phone', dispatch.driver_phone || 'N/A'],
    ['Total Quantity', totalMT.toFixed(1) + ' MT']
  ]
  info.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold'); doc.text(label + ':', 15, y)
    doc.setFont('helvetica', 'normal'); doc.text(val, 60, y); y += 6
  })
  y += 4

  // Pellet details table
  if (dispatch.dispatch_pellets?.length > 0) {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(45, 106, 79)
    doc.text('Pellet Details', 15, y); y += 6
    const rows = dispatch.dispatch_pellets.map(p => [p.pellet_types?.name || p.pellet_type_name || 'N/A', parseFloat(p.quantity_mt || 0).toFixed(1) + ' MT'])
    rows.push(['TOTAL', totalMT.toFixed(1) + ' MT'])
    y = drawTable(doc, y, ['Pellet Type', 'Quantity'], rows, [100, 80])
  }

  if (dispatch.remarks) { y += 4; doc.setFontSize(9); doc.setTextColor(44,44,44); doc.setFont('helvetica','bold'); doc.text('Remarks:', 15, y); y += 5; doc.setFont('helvetica','normal'); doc.text(dispatch.remarks.substring(0, 150), 15, y) }

  drawFooter(doc, createdByName, dispatch.created_at, dispatch.updated_at)
  doc.save('Dispatch_' + (dispatch.truck_number || '').replace(/\s/g, '_') + '_' + (dispatch.date || '') + '.pdf')
}

// PURCHASE PDF
export async function exportPurchasePDF(purchase, createdByName) {
  const lib = await loadJsPDF()
  const doc = new lib.jsPDF()
  const dateStr = purchase.date ? new Date(purchase.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'
  let y = drawHeader(doc, 'Purchase Report', (purchase.suppliers?.name || 'Purchase') + ' | ' + dateStr)

  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(45, 106, 79)
  doc.text('Purchase Details', 15, y); y += 8
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(44, 44, 44)
  const qty = purchase.quantity_kg || purchase.final_quantity || 0
  const avgRate = qty > 0 ? (purchase.total_amount / qty).toFixed(2) : '0.00'
  const info = [
    ['Supplier', purchase.suppliers?.name || 'N/A'], ['Raw Material', purchase.raw_material_types?.name || 'N/A'],
    ['Date', dateStr], ['Time', purchase.purchase_time?.slice(0,5) || 'N/A'],
    ['Vehicle', purchase.vehicle_number || 'N/A'], ['Net Weight', (purchase.net_weight || 0) + ' kg'],
    ['Moisture', (purchase.moisture_percent || 'N/A') + '%'], ['Deduction', (purchase.deduction_kg || 0) + ' kg'],
    ['Final Quantity', Math.round(qty).toLocaleString('en-IN') + ' kg'],
    ['Rate/kg', '\u20B9' + (purchase.rate_per_kg || 0).toFixed(2)],
    ['RM Amount', '\u20B9' + Math.round(purchase.rm_amount || 0).toLocaleString('en-IN')],
    ['Loading', '\u20B9' + Math.round(purchase.loading_expense || purchase.loading_charges || 0).toLocaleString('en-IN')],
    ['Unloading', '\u20B9' + Math.round(purchase.unloading_expense || purchase.unloading_charges || 0).toLocaleString('en-IN')],
    ['Transport', '\u20B9' + Math.round(purchase.transport_expense || purchase.transport_charges || 0).toLocaleString('en-IN')],
    ['Total Amount', '\u20B9' + Math.round(purchase.total_amount || 0).toLocaleString('en-IN')],
    ['Avg Cost/kg', '\u20B9' + avgRate + '/kg'],
    ['Payment Status', purchase.payment_status || 'Pending']
  ]
  info.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold'); doc.text(label + ':', 15, y)
    doc.setFont('helvetica', 'normal'); doc.text(String(val), 60, y); y += 6
  })

  if (purchase.remarks) { y += 4; doc.setFont('helvetica','bold'); doc.text('Remarks:', 15, y); y += 5; doc.setFont('helvetica','normal'); doc.text(purchase.remarks.substring(0, 150), 15, y) }

  drawFooter(doc, createdByName, purchase.created_at, purchase.updated_at)
  doc.save('Purchase_' + (purchase.suppliers?.name || '').replace(/\s/g, '_') + '_' + (purchase.date || '') + '.pdf')
}

// SHIFT REPORT PDF
export async function exportShiftReportPDF(report, data, createdByName) {
  const lib = await loadJsPDF()
  const doc = new lib.jsPDF()
  const dateStr = report.date || 'N/A'
  let y = drawHeader(doc, 'Shift Report', 'Shift ' + report.shift + ' | ' + dateStr + ' | ' + (report.employees?.name || 'N/A'))

  // Summary
  doc.setFontSize(9); doc.setTextColor(44, 44, 44)
  const items = [
    ['Date', dateStr], ['Shift', report.shift],
    ['Time', (report.start_time?.slice(0,5) || '') + ' - ' + (report.end_time?.slice(0,5) || '')],
    ['Supervisor', report.employees?.name || 'N/A'], ['Plant', report.plants?.name || 'N/A'],
    ['Total Production', (report.pellet_production_mt || 0).toFixed(1) + ' MT']
  ]
  items.forEach(([l, v]) => {
    doc.setFont('helvetica', 'bold'); doc.text(l + ':', 15, y)
    doc.setFont('helvetica', 'normal'); doc.text(String(v), 60, y); y += 6
  })
  y += 4

  // Machine Production
  if (data.machineProduction?.length > 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(45, 106, 79)
    doc.text('Machine Production', 15, y); y += 6
    const rows = data.machineProduction.map(m => [m.machines?.name || 'N/A', (m.hours_run || 0) + 'h', String(m.production_mt || 0)])
    y = drawTable(doc, y, ['Machine', 'Hours', 'Production (MT)'], rows, [80, 50, 50])
  }

  // Raw Materials
  if (data.rawMaterials?.length > 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(45, 106, 79)
    doc.text('Raw Materials', 15, y); y += 6
    const rows = data.rawMaterials.map(m => [m.raw_material_types?.name || 'N/A', String(m.opening_kg||0), String(m.purchased_kg||0), String(m.quantity_kg||0), String(m.closing_kg||0)])
    y = drawTable(doc, y, ['Material', 'Opening', 'Purchased', 'Used', 'Closing'], rows, [48, 28, 28, 28, 28])
  }

  // Dispatches
  if (data.dispatches?.length > 0 && y < 220) {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(45, 106, 79)
    doc.text('Dispatches', 15, y); y += 6
    const rows = data.dispatches.map(d => [d.truck_number, d.customers?.name || 'N/A', d.dispatch_pellets?.reduce((s, p) => s + (parseFloat(p.quantity_mt)||0), 0).toFixed(1) + ' MT'])
    y = drawTable(doc, y, ['Truck', 'Customer', 'Quantity'], rows, [60, 60, 60])
  }

  drawFooter(doc, createdByName, report.created_at, report.updated_at)
  doc.save('ShiftReport_' + report.shift + '_' + (report.date || '') + '.pdf')
}
