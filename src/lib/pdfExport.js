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

  const dContentW = 180  // 210 - 2*15
  // Section helper for dispatch
  function dSec(text) {
    doc.setFillColor(45, 106, 79)
    doc.rect(15, y, dContentW, 7, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
    doc.text(text.toUpperCase(), 19, y + 5)
    y += 9
  }

  dSec('Summary')
  // 2-column grid layout for summary
  const leftD = 15, rightD = 15 + dContentW / 2 + 5
  const summaryPairs = [
    ['Customer', dispatch.customers?.name || 'N/A'], ['Destination', dispatch.destination || 'N/A'],
    ['Transporter', dispatch.transporter || 'N/A'], ['Invoice No', dispatch.invoice_no || 'N/A'],
    ['Loading Time', dispatch.loading_time?.slice(0,5) || 'N/A'], ['Dispatch Time', dispatch.dispatch_time?.slice(0,5) || 'N/A'],
    ['Driver', dispatch.driver_name || 'N/A'], ['Driver Phone', dispatch.driver_phone || 'N/A'],
  ]
  for (let i = 0; i < summaryPairs.length; i += 2) {
    const [la, va] = summaryPairs[i]; const [lb, vb] = summaryPairs[i + 1] || ['', '']
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(137, 141, 122)
    doc.text(la.toUpperCase(), leftD, y); doc.text(lb.toUpperCase(), rightD, y)
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(44, 44, 44)
    doc.text(va, leftD, y + 5); doc.text(vb, rightD, y + 5)
    y += 12
  }
  // Total qty row
  doc.setFillColor(236, 248, 242); doc.rect(15, y, dContentW, 8, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(45, 106, 79)
  doc.text('Total Quantity', leftD + 3, y + 5.5)
  doc.text(totalMT.toFixed(1) + ' MT', rightD, y + 5.5)
  y += 12

  // Pellet details table
  if (dispatch.dispatch_pellets?.length > 0) {
    dSec('Pellet Details')
    y += 2
    const rows = dispatch.dispatch_pellets.map(p => [p.pellet_types?.name || p.pellet_type_name || 'N/A', parseFloat(p.quantity_mt || 0).toFixed(1) + ' MT'])
    rows.push(['TOTAL', totalMT.toFixed(1) + ' MT'])
    y = drawTable(doc, y, ['Pellet Type', 'Quantity'], rows, [130, 50])
  }

  if (dispatch.remarks) { y += 4; doc.setFontSize(9); doc.setTextColor(44,44,44); doc.setFont('helvetica','bold'); doc.text('Remarks:', 15, y); y += 5; doc.setFont('helvetica','normal'); doc.text(dispatch.remarks.substring(0, 150), 15, y) }

  drawFooter(doc, createdByName, dispatch.created_at, dispatch.updated_at)
  doc.save('Dispatch_' + (dispatch.truck_number || '').replace(/\s/g, '_') + '_' + (dispatch.date || '') + '.pdf')
}

// PURCHASE PDF — Card-based layout
export async function exportPurchasePDF(purchase, createdByName) {
  const lib = await loadJsPDF()
  const doc = new lib.jsPDF()
  const margin = 15
  const pw = 210
  const contentW = pw - 2 * margin
  const dateStr = purchase.date ? new Date(purchase.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'
  const qty = purchase.quantity_kg || 0
  const avgRate = qty > 0 ? (purchase.total_amount / qty).toFixed(2) : '0.00'
  const totalAmt = Math.round(purchase.total_amount || 0)

  // ===== GREEN HEADER CARD =====
  let y = margin
  const cardH = 52
  doc.setFillColor(45, 106, 79)
  doc.roundedRect(margin, y, contentW, cardH, 6, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Purchase Report', margin + 12, y + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(220, 235, 220)
  doc.text((purchase.suppliers?.name || 'Supplier') + '  |  ' + dateStr, margin + 12, y + 25)

  // Inner summary panel
  const panelY = y + 32
  doc.setFillColor(38, 90, 67)
  doc.roundedRect(margin + 8, panelY, contentW - 16, 14, 3, 3, 'F')
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 210, 190)
  const col1 = margin + 16; const col2 = margin + 70; const col3 = margin + 124
  doc.text('NET WEIGHT', col1, panelY + 5)
  doc.text('FINAL QTY', col2, panelY + 5)
  doc.text('TOTAL AMOUNT', col3, panelY + 5)
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
  doc.text((purchase.net_weight || 0) + ' kg', col1, panelY + 11)
  doc.text(Math.round(qty).toLocaleString('en-IN') + ' kg', col2, panelY + 11)
  doc.text('Rs. ' + totalAmt.toLocaleString('en-IN'), col3, panelY + 11)

  y += cardH + 10

  // ===== PURCHASE INFO SECTION =====
  // Helper to draw a labeled row pair in 2-column grid
  function drawField(x, yPos, label, value) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(137, 141, 122)
    doc.text(label.toUpperCase(), x, yPos)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(44, 44, 44)
    doc.text(String(value || 'N/A'), x, yPos + 5.5)
  }

  // Section header helper — green strip with white text (print-safe, branded)
  function pSec(text) {
    doc.setFillColor(45, 106, 79)
    doc.rect(margin, y, contentW, 7, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255)
    doc.text(text.toUpperCase(), margin + 4, y + 5)
    y += 10
  }

  // ===== PURCHASE INFO SECTION =====
  const leftCol = margin
  const rightCol = margin + contentW / 2 + 5

  pSec('Basic Info')
  drawField(leftCol, y, 'Supplier', purchase.suppliers?.name)
  drawField(rightCol, y, 'Raw Material', purchase.raw_material_types?.name)
  y += 14
  drawField(leftCol, y, 'Date', dateStr)
  drawField(rightCol, y, 'Time', purchase.purchase_time?.slice(0,5) || 'N/A')
  y += 14
  drawField(leftCol, y, 'Vehicle Number', purchase.vehicle_number)
  drawField(rightCol, y, 'Payment Status', purchase.payment_status || 'Pending')
  y += 16

  pSec('Weight & Quality')
  drawField(leftCol, y, 'Net Weight', (purchase.net_weight || 0) + ' kg')
  drawField(rightCol, y, 'Moisture', (purchase.moisture_percent != null && purchase.moisture_percent !== '' ? purchase.moisture_percent + '%' : 'N/A'))
  y += 14
  drawField(leftCol, y, 'Deduction', (purchase.deduction_kg || 0) + ' kg')
  drawField(rightCol, y, 'Final Quantity', Math.round(qty).toLocaleString('en-IN') + ' kg')
  y += 16

  pSec('Cost Breakdown')

  const costItems = [
    ['Rate per kg', 'Rs. ' + (purchase.rate_per_kg || 0).toFixed(2)],
    ['RM Amount', 'Rs. ' + Math.round(purchase.total_rm_amount || 0).toLocaleString('en-IN')],
    ['Loading', 'Rs. ' + Math.round(purchase.loading_expense || purchase.loading_charges || 0).toLocaleString('en-IN')],
    ['Unloading', 'Rs. ' + Math.round(purchase.unloading_expense || purchase.unloading_charges || 0).toLocaleString('en-IN')],
    ['Transport', 'Rs. ' + Math.round(purchase.transport_expense || purchase.transport_charges || 0).toLocaleString('en-IN')],
  ]

  costItems.forEach(([label, val], i) => {
    if (i % 2 === 0) { doc.setFillColor(236, 248, 242); doc.rect(margin, y - 1, contentW, 7, 'F') }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(89, 92, 74)
    doc.text(label, margin + 4, y + 4)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(44, 44, 44)
    doc.text(val, margin + contentW - 4 - doc.getTextWidth(val), y + 4)
    y += 7
  })

  // Total row — bold green background
  doc.setFillColor(45, 106, 79)
  doc.rect(margin, y - 1, contentW, 8, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
  doc.text('Total Amount', margin + 4, y + 5)
  const totalStr = 'Rs. ' + totalAmt.toLocaleString('en-IN')
  doc.text(totalStr, margin + contentW - 4 - doc.getTextWidth(totalStr), y + 5)
  y += 10

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(137, 141, 122)
  doc.text('Average cost per kg: Rs. ' + avgRate, margin + 4, y + 3)
  y += 10

  if (purchase.remarks) {
    pSec('Remarks')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(44, 44, 44)
    const lines = doc.splitTextToSize(purchase.remarks, contentW - 5)
    lines.forEach(line => { doc.text(line, margin, y); y += 4.5 })
  }

  drawFooter(doc, createdByName, purchase.created_at, purchase.updated_at)
  doc.save('Purchase_' + (purchase.suppliers?.name || '').replace(/\s/g, '_') + '_' + (purchase.date || '') + '.pdf')
}

// SHIFT REPORT PDF — Clean green-branded layout, single-page optimised
export async function exportShiftReportPDF(report, data, createdByName) {
  const lib = await loadJsPDF()
  const doc = new lib.jsPDF()
  const pw = 210
  const margin = 15
  const contentW = pw - 2 * margin  // 180
  const maxY = 272
  let y = margin

  function fmtDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  function needsNewPage(needed) {
    if (y + needed > maxY) { doc.addPage(); y = margin; return true }
    return false
  }

  // Section header — green strip with white text (consistent across all PDFs)
  function sectionHeader(title) {
    y += 4
    needsNewPage(20)
    doc.setFillColor(45, 106, 79)
    doc.rect(margin, y, contentW, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    doc.text(title.toUpperCase(), margin + 3, y + 5)
    y += 10
  }

  // Table — rowH reduced to 6, all tables span full contentW
  function shiftTable(headers, rows, colWidths, opts) {
    const startX = margin
    const rowH = 6
    const totalW = colWidths.reduce((a, b) => a + b, 0)

    needsNewPage(rowH * 2)
    doc.setFillColor(45, 106, 79)
    doc.rect(startX, y, totalW, rowH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    let x = startX + 2
    headers.forEach((h, i) => { doc.text(h, x, y + 4.2); x += colWidths[i] })
    y += rowH

    rows.forEach((row, ri) => {
      needsNewPage(rowH)
      if (ri % 2 === 0) { doc.setFillColor(251, 248, 235); doc.rect(startX, y, totalW, rowH, 'F') }
      x = startX + 2
      row.forEach((cell, ci) => {
        const isSpecial = opts?.specialRows?.[ri]
        const isBoldRow = opts?.boldRows?.includes(ri)
        if (isSpecial) {
          if (ci === 0) { doc.setFont('helvetica', 'normal'); doc.setTextColor(44, 44, 44); doc.text(String(cell || ''), x, y + 4.2) }
          else if (ci === 1) { doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 150); doc.text(String(cell || ''), x, y + 4.2) }
        } else {
          doc.setFont('helvetica', isBoldRow ? 'bold' : 'normal')
          doc.setTextColor(44, 44, 44)
          doc.text(String(cell ?? ''), x, y + 4.2)
        }
        x += colWidths[ci]
      })
      y += rowH
    })
    y += 3
  }

  // Totals
  const totalProd = parseFloat(report.pellet_production_mt) || 0
  const totalDispMT = (data.dispatches || []).reduce((s, d) =>
    s + (d.dispatch_pellets || []).reduce((ps, p) => ps + (parseFloat(p.quantity_mt) || 0), 0), 0)
  const totalDiesel = (data.equipmentDiesel || []).reduce((s, e) => s + (parseFloat(e.used_litres) || 0), 0)
  const totalRMkg = (data.rawMaterials || []).reduce((s, m) => s + (parseFloat(m.quantity_kg) || 0), 0)

  const startDate = report.shift_start_date || report.date
  const endDate = report.shift_end_date || startDate
  const startLabel = fmtDate(startDate) + ', ' + (report.start_time?.slice(0, 5) || '')
  const shiftTimeLabel = startLabel + (fmtDate(endDate) !== fmtDate(startDate) ? ' – ' + fmtDate(endDate) + ', ' + (report.end_time?.slice(0, 5) || '') : ' – ' + (report.end_time?.slice(0, 5) || ''))

  // ===== GREEN HEADER CARD =====
  const cardH = 44
  doc.setFillColor(45, 106, 79)
  doc.roundedRect(margin, y, contentW, cardH, 4, 4, 'F')

  // Company + shift badge
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('KANOZ BIOMASS', margin + 8, y + 13)

  // Shift badge — white pill in top-right
  const badgeText = 'SHIFT ' + (report.shift || '')
  doc.setFontSize(8)
  const bW = doc.getTextWidth(badgeText) + 8
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(margin + contentW - bW - 6, y + 5, bW + 2, 10, 2, 2, 'F')
  doc.setTextColor(45, 106, 79)
  doc.setFont('helvetica', 'bold')
  doc.text(badgeText, margin + contentW - bW - 4, y + 11.5)

  // Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(190, 225, 210)
  doc.text('Shift Production Report', margin + 8, y + 21)

  // Thin divider inside card
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.2)
  doc.line(margin + 8, y + 25, margin + contentW - 8, y + 25)

  // 4-column meta inside card
  const metaColW = contentW / 4
  const metaItems = [
    { label: 'PLANT', value: report.plants?.name || 'N/A' },
    { label: 'DATE', value: report.date || 'N/A' },
    { label: 'SUPERVISOR', value: report.employees?.name || 'N/A' },
    { label: 'SHIFT TIME', value: shiftTimeLabel },
  ]
  metaItems.forEach((item, i) => {
    const mx = margin + 8 + i * metaColW
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(180, 220, 200)
    doc.text(item.label, mx, y + 30)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255)
    doc.text(item.value, mx, y + 37)
  })
  y += cardH + 3

  // KPI bar — light green tint
  const kpiBoxH = 14
  doc.setFillColor(236, 248, 242)
  doc.rect(margin, y, contentW, kpiBoxH, 'F')
  const kpis = [
    { label: 'PRODUCED', value: totalProd.toFixed(1) + ' MT' },
    { label: 'DISPATCHED', value: totalDispMT.toFixed(1) + ' MT' },
    { label: 'DIESEL USED', value: Math.round(totalDiesel) + ' L' },
    { label: 'RM USED', value: (totalRMkg / 1000).toFixed(2) + ' MT' },
  ]
  const kpiColW = contentW / 4
  kpis.forEach((kpi, i) => {
    const kx = margin + i * kpiColW + 4
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(100, 140, 120)
    doc.text(kpi.label, kx, y + 4.5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(45, 106, 79)
    doc.text(kpi.value, kx, y + 11.5)
  })
  y += kpiBoxH + 5

  // ===== MACHINE TIMINGS =====
  sectionHeader('MACHINE TIMINGS')
  if (data.machineProduction?.length > 0) {
    const machRows = []
    const specialRows = {}
    data.machineProduction.forEach((m, i) => {
      const name = m.machines?.name || 'Unknown'
      const hrs = m.hours_run || 0
      const totalHrs = m.total_hours || hrs
      const prod = m.production_mt || 0
      if (prod === 0 && hrs === 0) {
        machRows.push([name, 'Did Not Run', '', '', '', ''])
        specialRows[i] = true
      } else {
        const avg = hrs > 0 ? (prod / hrs).toFixed(2) : '\u2014'
        machRows.push([name, hrs + 'h', totalHrs + 'h', String(prod), avg, m.remarks || '\u2014'])
      }
    })
    shiftTable(
      ['Machine', 'Prd Hrs', 'Total Hrs', 'Prd (MT)', 'Avg/Hr', 'Remarks'],
      machRows,
      [35, 22, 22, 22, 22, 57],
      { specialRows }
    )
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(137, 141, 122)
    doc.text('No machine data', margin, y); y += 8
  }

  // ===== PRODUCTION =====
  sectionHeader('PRODUCTION')
  if (data.machineProduction?.length > 0) {
    const prodRows = []
    const specialRows = {}
    data.machineProduction.forEach((m, i) => {
      const name = m.machines?.name || 'Unknown'
      const prod = m.production_mt || 0
      const hrs = m.hours_run || 0
      if (prod === 0) {
        prodRows.push([name, 'No production this shift', '', ''])
        specialRows[i] = true
      } else {
        const avg = hrs > 0 ? (prod / hrs).toFixed(2) : '\u2014'
        prodRows.push([name, m.pellet_type_name || '—', String(prod), avg])
      }
    })
    shiftTable(
      ['Machine', 'Pellet Type', 'Qty (MT)', 'Avg/Hr'],
      prodRows,
      [45, 55, 40, 40],
      { specialRows }
    )
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(137, 141, 122)
    doc.text('No production data', margin, y); y += 8
  }

  // ===== RAW MATERIALS =====
  sectionHeader('RAW MATERIALS')
  if (data.rawMaterials?.length > 0) {
    const matRows = data.rawMaterials.map(m => [
      m.raw_material_types?.name || 'Unknown',
      String(m.opening_kg || 0),
      String(m.purchased_kg || 0),
      String(m.quantity_kg || 0),
      String(m.closing_kg || 0)
    ])
    shiftTable(
      ['Material', 'Open (kg)', 'Purch (kg)', 'Used (kg)', 'Close (kg)'],
      matRows,
      [60, 30, 30, 30, 30]
    )
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(137, 141, 122)
    doc.text('No raw material data', margin, y); y += 8
  }

  // ===== EQUIPMENT & DIESEL =====
  sectionHeader('EQUIPMENT & DIESEL')
  if (data.equipmentDiesel?.length > 0 || data.dieselStock) {
    const eqRows = (data.equipmentDiesel || []).map(e => {
      const hrs = e.hours_worked || 0
      const used = e.used_litres || 0
      const avg = hrs > 0 ? (used / hrs).toFixed(1) : '\u2014'
      return [
        e.equipment_name || 'Unknown',
        String(Math.round(e.opening_litres || 0)),
        String(Math.round(e.added_litres || 0)),
        String(Math.round(used)),
        String(Math.round(e.closing_litres || 0)),
        hrs + 'h',
        avg
      ]
    })
    const boldRows = []
    // Add diesel stock tank row
    if (data.dieselStock) {
      boldRows.push(eqRows.length)
      eqRows.push([
        'DIESEL STOCK TANK',
        String(Math.round(data.dieselStock.opening_litres || 0)),
        String(Math.round(data.dieselStock.purchased_litres || 0)),
        String(Math.round(data.dieselStock.used_litres || 0)),
        String(Math.round(data.dieselStock.closing_litres || 0)),
        '\u2014',
        '\u2014'
      ])
    }
    shiftTable(
      ['Equipment', 'Open (L)', 'Added (L)', 'Used (L)', 'Close (L)', 'Hrs', 'Avg L/Hr'],
      eqRows,
      [44, 23, 23, 23, 23, 20, 24],
      { boldRows }
    )
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(137, 141, 122)
    doc.text('No equipment data', margin, y); y += 8
  }

  // ===== VEHICLE DISPATCHES =====
  if (data.dispatches?.length > 0) {
    sectionHeader('VEHICLE DISPATCHES')
    const dispRows = data.dispatches.map(d => {
      const pelletTypes = (d.dispatch_pellets || []).map(p => p.pellet_types?.name || '').filter(Boolean).join(', ') || '—'
      const qty = (d.dispatch_pellets || []).reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0)
      const time = (d.dispatch_time || d.loading_time || '')?.slice(0, 5) || '—'
      return [d.truck_number || '', d.customers?.name || '', pelletTypes, qty.toFixed(1), time]
    })
    shiftTable(
      ['Truck', 'Customer', 'Pellet Type', 'Qty (MT)', 'Time'],
      dispRows,
      [40, 44, 48, 26, 22]
    )
  }

  // ===== PELLET STOCK =====
  if (data.pelletStock?.length > 0) {
    sectionHeader('PELLET STOCK')
    const psRows = data.pelletStock.map(p => [
      p.pellet_types?.name || 'Unknown',
      String(p.opening_mt || 0),
      String(p.production_mt || 0),
      String(p.dispatch_mt || 0),
      String(p.wastage_mt || 0),
      String(p.closing_mt || 0)
    ])
    shiftTable(
      ['Type', 'Open', 'Prd', 'Disp', 'Waste', 'Close'],
      psRows,
      [52, 26, 26, 26, 26, 24]
    )
  }

  // ===== ISSUES =====
  if (data.issues?.length > 0) {
    sectionHeader('ISSUES')
    data.issues.forEach(issue => {
      needsNewPage(18)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(44, 44, 44)
      const sevLabel = issue.severity === 'High' ? ' [HIGH]' : issue.severity === 'Medium' ? ' [MEDIUM]' : ' [LOW]'
      doc.text((issue.issue_type || 'Issue') + sevLabel, margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(89, 92, 74)
      const lines = doc.splitTextToSize(issue.description || '', contentW - 5)
      lines.forEach(line => {
        needsNewPage(5)
        doc.text(line, margin + 4, y)
        y += 4
      })
      y += 3
    })
  }

  // ===== HANDOVER NOTES =====
  if (report.handover_notes) {
    sectionHeader('HANDOVER NOTES')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(44, 44, 44)
    const lines = doc.splitTextToSize(report.handover_notes, contentW - 5)
    lines.forEach(line => {
      needsNewPage(5)
      doc.text(line, margin, y)
      y += 4.5
    })
    y += 4
  }

  // ===== PAGE FOOTERS (all pages) =====
  const totalPages = doc.getNumberOfPages()
  const reportUrl = 'https://app.kanoz.in/reports/' + report.id
  const genTime = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(137, 141, 122)
    doc.text(reportUrl, margin, 288)
    const pageLabel = genTime + '    Page ' + i + ' of ' + totalPages
    doc.text(pageLabel, pw - margin - doc.getTextWidth(pageLabel), 288)
  }

  doc.save('Shift ' + report.shift + ' Report \u2014 ' + report.date + '.pdf')
}

