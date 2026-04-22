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

  // Section: Basic Info
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45, 106, 79)
  doc.text('Basic Info', margin, y)
  doc.setDrawColor(45, 106, 79); doc.setLineWidth(0.4)
  doc.line(margin, y + 2, margin + contentW, y + 2)
  y += 10

  const leftCol = margin
  const rightCol = margin + contentW / 2 + 5
  drawField(leftCol, y, 'Supplier', purchase.suppliers?.name)
  drawField(rightCol, y, 'Raw Material', purchase.raw_material_types?.name)
  y += 14
  drawField(leftCol, y, 'Date', dateStr)
  drawField(rightCol, y, 'Time', purchase.purchase_time?.slice(0,5) || 'N/A')
  y += 14
  drawField(leftCol, y, 'Vehicle Number', purchase.vehicle_number)
  drawField(rightCol, y, 'Payment Status', purchase.payment_status || 'Pending')
  y += 18

  // Section: Weight & Quality
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45, 106, 79)
  doc.text('Weight & Quality', margin, y)
  doc.setDrawColor(45, 106, 79); doc.setLineWidth(0.4)
  doc.line(margin, y + 2, margin + contentW, y + 2)
  y += 10

  drawField(leftCol, y, 'Net Weight', (purchase.net_weight || 0) + ' kg')
  drawField(rightCol, y, 'Moisture', (purchase.moisture_percent != null && purchase.moisture_percent !== '' ? purchase.moisture_percent + '%' : 'N/A'))
  y += 14
  drawField(leftCol, y, 'Deduction', (purchase.deduction_kg || 0) + ' kg')
  drawField(rightCol, y, 'Final Quantity', Math.round(qty).toLocaleString('en-IN') + ' kg')
  y += 18

  // Section: Cost Breakdown — as a table
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45, 106, 79)
  doc.text('Cost Breakdown', margin, y)
  doc.setDrawColor(45, 106, 79); doc.setLineWidth(0.4)
  doc.line(margin, y + 2, margin + contentW, y + 2)
  y += 8

  const costItems = [
    ['Rate per kg', 'Rs. ' + (purchase.rate_per_kg || 0).toFixed(2)],
    ['RM Amount', 'Rs. ' + Math.round(purchase.total_rm_amount || 0).toLocaleString('en-IN')],
    ['Loading', 'Rs. ' + Math.round(purchase.loading_expense || purchase.loading_charges || 0).toLocaleString('en-IN')],
    ['Unloading', 'Rs. ' + Math.round(purchase.unloading_expense || purchase.unloading_charges || 0).toLocaleString('en-IN')],
    ['Transport', 'Rs. ' + Math.round(purchase.transport_expense || purchase.transport_charges || 0).toLocaleString('en-IN')],
  ]

  // Cost rows with alternating background
  costItems.forEach(([label, val], i) => {
    if (i % 2 === 0) { doc.setFillColor(254, 250, 224); doc.rect(margin, y - 1, contentW, 7, 'F') }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(89, 92, 74)
    doc.text(label, margin + 4, y + 4)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(44, 44, 44)
    doc.text(val, margin + contentW - 4 - doc.getTextWidth(val), y + 4)
    y += 7
  })

  // Total row — bold with green background
  doc.setFillColor(45, 106, 79)
  doc.rect(margin, y - 1, contentW, 8, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
  doc.text('Total Amount', margin + 4, y + 5)
  const totalStr = 'Rs. ' + totalAmt.toLocaleString('en-IN')
  doc.text(totalStr, margin + contentW - 4 - doc.getTextWidth(totalStr), y + 5)
  y += 10

  // Avg cost per kg
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(137, 141, 122)
  doc.text('Average cost per kg: Rs. ' + avgRate, margin + 4, y + 3)
  y += 10

  // Remarks
  if (purchase.remarks) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45, 106, 79)
    doc.text('Remarks', margin, y)
    doc.setDrawColor(45, 106, 79); doc.setLineWidth(0.4)
    doc.line(margin, y + 2, margin + contentW, y + 2)
    y += 8
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(44, 44, 44)
    const lines = doc.splitTextToSize(purchase.remarks, contentW - 5)
    lines.forEach(line => { doc.text(line, margin, y); y += 4.5 })
  }

  drawFooter(doc, createdByName, purchase.created_at, purchase.updated_at)
  doc.save('Purchase_' + (purchase.suppliers?.name || '').replace(/\s/g, '_') + '_' + (purchase.date || '') + '.pdf')
}

// SHIFT REPORT PDF — Full format with all sections, multi-page, page numbers
export async function exportShiftReportPDF(report, data, createdByName) {
  const lib = await loadJsPDF()
  const doc = new lib.jsPDF()
  const pw = 210 // page width
  const margin = 15
  const contentW = pw - 2 * margin
  const maxY = 272 // leave room for footer
  let y = margin

  // Format date like "19 Mar"
  function fmtDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  // Check page break
  function needsNewPage(needed) {
    if (y + needed > maxY) {
      doc.addPage()
      y = margin
      return true
    }
    return false
  }

  // Section header — Option A: small uppercase label with light grey underline
  function sectionHeader(title) {
    y += 6 // breathing room before section
    needsNewPage(25)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(80, 80, 80)
    doc.text(title.toUpperCase(), margin, y)
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.4)
    doc.line(margin, y + 2, margin + contentW, y + 2)
    y += 10
  }

  // Draw table that handles page breaks
  function shiftTable(headers, rows, colWidths, opts) {
    const startX = margin
    const rowH = 7
    const totalW = colWidths.reduce((a, b) => a + b, 0)

    // Header row
    needsNewPage(rowH * 2)
    doc.setFillColor(45, 106, 79)
    doc.rect(startX, y, totalW, rowH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    let x = startX + 3
    headers.forEach((h, i) => { doc.text(h, x, y + 5); x += colWidths[i] })
    y += rowH

    // Data rows
    rows.forEach((row, ri) => {
      needsNewPage(rowH)
      if (ri % 2 === 0) {
        doc.setFillColor(254, 250, 224)
        doc.rect(startX, y, totalW, rowH, 'F')
      }
      x = startX + 3
      row.forEach((cell, ci) => {
        const isSpecial = opts?.specialRows?.[ri]
        const isBoldRow = opts?.boldRows?.includes(ri)
        if (isSpecial) {
          // "Did Not Run" or "No production" style
          doc.setFont('helvetica', 'italic')
          doc.setTextColor(137, 141, 122)
          if (ci === 0) {
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(44, 44, 44)
            doc.text(String(cell || ''), x, y + 5)
          } else if (ci === 1) {
            // Span the rest with italic text
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(137, 141, 122)
            doc.text(String(cell || ''), x, y + 5)
          }
          // Skip remaining cells for special rows
        } else {
          if (isBoldRow) {
            doc.setFont('helvetica', 'bold')
          } else {
            doc.setFont('helvetica', 'normal')
          }
          doc.setTextColor(44, 44, 44)
          doc.text(String(cell ?? ''), x, y + 5)
        }
        x += colWidths[ci]
      })
      y += rowH
    })
    y += 4
  }

  // Calculate totals
  const totalProd = parseFloat(report.pellet_production_mt) || 0
  const totalDispMT = (data.dispatches || []).reduce((s, d) =>
    s + (d.dispatch_pellets || []).reduce((ps, p) => ps + (parseFloat(p.quantity_mt) || 0), 0), 0)

  const startDate = report.shift_start_date || report.date
  const endDate = report.shift_end_date || report.date
  const startLabel = fmtDate(startDate) + ', ' + (report.start_time?.slice(0, 5) || '')
  const endLabel = fmtDate(endDate) + ', ' + (report.end_time?.slice(0, 5) || '')

  // ===== CLEAN CORPORATE HEADER (Option A) =====
  // Company name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text('KANOZ BIOMASS', margin, y + 10)

  // Shift badge — black border box, top-right
  const badgeText = 'SHIFT ' + report.shift
  doc.setFontSize(10)
  const badgeW = doc.getTextWidth(badgeText) + 10
  doc.setDrawColor(20, 20, 20)
  doc.setLineWidth(0.8)
  doc.rect(margin + contentW - badgeW, y + 1, badgeW, 11, 'S')
  doc.setTextColor(20, 20, 20)
  doc.text(badgeText, margin + contentW - badgeW + 5, y + 9)

  // Report label
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110, 110, 110)
  doc.text('Shift Production Report', margin, y + 18)
  y += 23

  // Thick horizontal rule
  doc.setDrawColor(20, 20, 20)
  doc.setLineWidth(1.5)
  doc.line(margin, y, margin + contentW, y)
  y += 9

  // Meta info row: 4 columns
  const metaColW = contentW / 4
  const metaItems = [
    { label: 'PLANT', value: report.plants?.name || 'N/A' },
    { label: 'DATE', value: report.date || 'N/A' },
    { label: 'SUPERVISOR', value: report.employees?.name || 'N/A' },
    { label: 'SHIFT TIME', value: startLabel }
  ]
  metaItems.forEach((item, i) => {
    const mx = margin + i * metaColW
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(120, 120, 120)
    doc.text(item.label, mx, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(20, 20, 20)
    doc.text(item.value, mx, y + 5)
  })
  y += 14

  // KPI summary box — light grey fill, 4 metrics
  const totalDiesel = (data.equipmentDiesel || []).reduce((s, e) => s + (parseFloat(e.used_litres) || 0), 0)
  const totalRMkg = (data.rawMaterials || []).reduce((s, m) => s + (parseFloat(m.quantity_kg) || 0), 0)
  const kpis = [
    { label: 'PRODUCED', value: totalProd.toFixed(1) + ' MT' },
    { label: 'DISPATCHED', value: totalDispMT.toFixed(1) + ' MT' },
    { label: 'DIESEL USED', value: Math.round(totalDiesel) + ' L' },
    { label: 'RM USED', value: (totalRMkg / 1000).toFixed(2) + ' MT' }
  ]
  const kpiBoxH = 20
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y, contentW, kpiBoxH, 'F')
  const kpiColW = contentW / 4
  kpis.forEach((kpi, i) => {
    const kx = margin + i * kpiColW + 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(100, 100, 100)
    doc.text(kpi.label, kx, y + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(20, 20, 20)
    doc.text(kpi.value, kx, y + 16)
  })
  y += kpiBoxH + 8

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
      [48, 28, 28, 28, 28]
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
      [38, 22, 22, 22, 22, 18, 22],
      { boldRows }
    )
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(137, 141, 122)
    doc.text('No equipment data', margin, y); y += 8
  }

  // ===== VEHICLE DISPATCHES =====
  sectionHeader('VEHICLE DISPATCHES')
  if (data.dispatches?.length > 0) {
    const dispRows = data.dispatches.map(d => {
      const pelletTypes = (d.dispatch_pellets || []).map(p => p.pellet_types?.name || '').filter(Boolean).join(', ') || 'N/A'
      const qty = (d.dispatch_pellets || []).reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0)
      const time = (d.dispatch_time || d.loading_time || '')?.slice(0, 5) || ''
      return [d.truck_number || '', d.customers?.name || '', pelletTypes, qty.toFixed(1), time]
    })
    shiftTable(
      ['Truck', 'Customer', 'Pellet Type', 'Qty (MT)', 'Time'],
      dispRows,
      [36, 40, 46, 26, 22]
    )
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(137, 141, 122)
    doc.text('No dispatches', margin, y); y += 8
  }

  // ===== PELLET STOCK =====
  sectionHeader('PELLET STOCK')
  if (data.pelletStock?.length > 0) {
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
      [40, 24, 24, 24, 24, 24]
    )
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(137, 141, 122)
    doc.text('No pellet stock data', margin, y); y += 8
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

