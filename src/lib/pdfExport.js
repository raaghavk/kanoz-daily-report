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
  const qty = purchase.quantity_kg || 0
  const avgRate = qty > 0 ? (purchase.total_amount / qty).toFixed(2) : '0.00'
  const info = [
    ['Supplier', purchase.suppliers?.name || 'N/A'], ['Raw Material', purchase.raw_material_types?.name || 'N/A'],
    ['Date', dateStr], ['Time', purchase.purchase_time?.slice(0,5) || 'N/A'],
    ['Vehicle', purchase.vehicle_number || 'N/A'], ['Net Weight', (purchase.net_weight || 0) + ' kg'],
    ['Moisture', (purchase.moisture_percent || 'N/A') + '%'], ['Deduction', (purchase.deduction_kg || 0) + ' kg'],
    ['Final Quantity', Math.round(qty).toLocaleString('en-IN') + ' kg'],
    ['Rate/kg', '\u20B9' + (purchase.rate_per_kg || 0).toFixed(2)],
    ['RM Amount', '\u20B9' + Math.round(purchase.total_rm_amount || 0).toLocaleString('en-IN')],
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

  // Section header with green text and underline
  function sectionHeader(title) {
    y += 6 // breathing room before section
    needsNewPage(25)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(45, 106, 79)
    doc.text(title, margin, y)
    doc.setDrawColor(45, 106, 79)
    doc.setLineWidth(0.5)
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

  // ===== GREEN HEADER CARD =====
  const cardH = 80
  doc.setFillColor(45, 106, 79)
  doc.roundedRect(margin, y, contentW, cardH, 6, 6, 'F')

  // Title
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Shift ' + report.shift + ' Report', margin + 12, y + 18)

  // Subtitle
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(220, 235, 220)
  doc.text((report.plants?.name || 'Plant') + '  \u00B7  ' + report.date, margin + 12, y + 27)

  // Inner panel
  const panelY = y + 34
  const panelH = 40
  doc.setFillColor(255, 255, 255, 0.15)
  doc.setFillColor(38, 90, 67) // slightly lighter green
  doc.roundedRect(margin + 8, panelY, contentW - 16, panelH, 4, 4, 'F')

  const col1 = margin + 16
  const col2 = margin + contentW / 2 + 4
  let py = panelY + 10

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 210, 190)
  doc.text('START', col1, py)
  doc.text('END', col2, py)
  py += 5
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(startLabel, col1, py)
  doc.text(endLabel, col2, py)

  py += 8
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 210, 190)
  doc.text('PRODUCTION', col1, py)
  doc.text('DISPATCHES', col2, py)
  py += 5
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(totalProd.toFixed(1) + ' MT', col1, py)
  doc.text(totalDispMT.toFixed(1) + ' MT', col2, py)

  // Separator line
  py += 5
  doc.setDrawColor(70, 140, 100)
  doc.setLineWidth(0.3)
  doc.line(col1 - 4, py, margin + contentW - 12, py)

  py += 6
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 210, 190)
  doc.text('SUPERVISOR', col1, py)
  doc.text('PLANT', col2, py)
  py += 5
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(report.employees?.name || 'N/A', col1, py)
  doc.text(report.plants?.name || 'N/A', col2, py)

  y += cardH + 12

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
        prodRows.push([name, 'Sample', String(prod), avg])
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
      const used = (e.opening_litres || 0) + (e.added_litres || 0) - (e.closing_litres || 0)
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
