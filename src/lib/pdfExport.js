// pdfExport.js — Kanoz Biomass · Template-matched PDF reports

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

// ── Palette ──────────────────────────────────────────────────────────────────
const GREEN       = [45, 106, 79]
const GREEN_LABEL = [162, 208, 185]
const TEXT        = [44, 44, 44]
const MUTED       = [89, 92, 74]
const LIGHT       = [148, 151, 138]
const BORDER      = [220, 215, 205]
const BG_ROW      = [249, 247, 241]
const BG_HEAD     = [243, 241, 235]
const WHITE       = [255, 255, 255]

// ── Tiny helpers ─────────────────────────────────────────────────────────────
const setC  = (doc, rgb) => doc.setTextColor(...rgb)
const fillC = (doc, rgb) => doc.setFillColor(...rgb)
const lineC = (doc, rgb) => doc.setDrawColor(...rgb)

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, dy] = d.split('-')
  return `${dy}-${m}-${y}`
}
function fmtTime(t) { return t ? t.substring(0, 5) : '—' }
function fmtNow() {
  return new Date().toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

// ── Page header: company name left · identifier right · subtitle · rule ──────
function pageHeader(doc, reportType, location, identRight, dateRight) {
  const pw = 210, m = 15
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); setC(doc, TEXT)
  doc.text('KANOZ BIOMASS', m, 18)
  const irW = doc.getTextWidth(identRight)
  doc.text(identRight, pw - m - irW, 18)

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setC(doc, MUTED)
  doc.text(reportType + (location ? ' · ' + location : ''), m, 24)
  if (dateRight) {
    const drW = doc.getTextWidth(dateRight)
    doc.text(dateRight, pw - m - drW, 24)
  }

  lineC(doc, BORDER); doc.setLineWidth(0.3)
  doc.line(m, 27, pw - m, 27)
  return 30
}

// ── 4-cell dark-green info row ────────────────────────────────────────────────
function infoRow(doc, y, cells) {
  const pw = 210, m = 15
  const cw = (pw - 2 * m) / cells.length
  const h  = 20
  cells.forEach((c, i) => {
    const x = m + i * cw
    fillC(doc, GREEN); doc.rect(x, y, cw, h, 'F')
    if (i < cells.length - 1) {
      lineC(doc, [255, 255, 255]); doc.setLineWidth(0.2)
      doc.line(x + cw, y + 3, x + cw, y + h - 3)
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); setC(doc, GREEN_LABEL)
    doc.text((c.label || '').toUpperCase(), x + 4, y + 7)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(c.vs || 9.5); setC(doc, WHITE)
    const val = String(c.value || '—')
    // Truncate if too wide
    const maxW = cw - 8
    let display = val
    while (doc.getTextWidth(display) > maxW && display.length > 4) display = display.slice(0, -1)
    if (display !== val) display = display.slice(0, -1) + '…'
    doc.text(display, x + 4, y + 15.5)
  })
  return y + h
}

// ── 4-cell KPI row (large numbers, light bg) ──────────────────────────────────
function kpiRow(doc, y, kpis) {
  const pw = 210, m = 15
  const cw = (pw - 2 * m) / kpis.length
  const h  = 22
  kpis.forEach((k, i) => {
    const x = m + i * cw
    fillC(doc, [250, 248, 242]); doc.rect(x, y, cw, h, 'F')
    if (i < kpis.length - 1) {
      lineC(doc, BORDER); doc.setLineWidth(0.2)
      doc.line(x + cw, y + 3, x + cw, y + h - 3)
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); setC(doc, LIGHT)
    doc.text((k.label || '').toUpperCase(), x + 4, y + 7)

    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); setC(doc, TEXT)
    const mainStr = String(k.main ?? '0')
    doc.text(mainStr, x + 4, y + 18)
    if (k.unit) {
      const nw = doc.getTextWidth(mainStr)
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); setC(doc, MUTED)
      doc.text(k.unit, x + 5 + nw, y + 18)
    }
  })
  lineC(doc, BORDER); doc.setLineWidth(0.3)
  doc.line(m, y + h, pw - m, y + h)
  return y + h + 6
}

// ── Section heading: bold green text + green rule ─────────────────────────────
function secHead(doc, y, title, x1, x2) {
  x1 = x1 ?? 15; x2 = x2 ?? 195
  y += 3
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setC(doc, GREEN)
  doc.text(title.toUpperCase(), x1, y + 5)
  lineC(doc, GREEN); doc.setLineWidth(0.5)
  doc.line(x1, y + 7, x2, y + 7)
  return y + 12
}

// ── Standard data table ───────────────────────────────────────────────────────
function stdTable(doc, y, headers, colWidths, rows, opts = {}) {
  const sx    = opts.sx ?? 15
  const rowH  = 7
  const totalW = colWidths.reduce((a, b) => a + b, 0)
  const aligns = opts.aligns || []
  const MAX_Y  = 272

  if (y + rowH * 2 > MAX_Y) { doc.addPage(); y = 20 }

  // Header
  fillC(doc, BG_HEAD); doc.rect(sx, y, totalW, rowH, 'F')
  lineC(doc, BORDER); doc.setLineWidth(0.15)
  doc.line(sx, y + rowH, sx + totalW, y + rowH)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); setC(doc, MUTED)
  let x = sx
  headers.forEach((h, i) => {
    const a = aligns[i] || 'left'
    if (a === 'right') { const tw = doc.getTextWidth(h); doc.text(h, x + colWidths[i] - tw - 2, y + 4.8) }
    else doc.text(h, x + 3, y + 4.8)
    x += colWidths[i]
  })
  y += rowH

  if (!rows || rows.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); setC(doc, LIGHT)
    doc.text(opts.noData || 'No data', sx + 3, y + 5)
    return y + 10
  }

  rows.forEach((row, ri) => {
    if (y + rowH > MAX_Y) { doc.addPage(); y = 20 }
    if (ri % 2 === 1) { fillC(doc, BG_ROW); doc.rect(sx, y, totalW, rowH, 'F') }
    lineC(doc, [232, 228, 218]); doc.setLineWidth(0.12)
    doc.line(sx, y + rowH, sx + totalW, y + rowH)
    x = sx
    row.forEach((cell, ci) => {
      const a  = aligns[ci] || 'left'
      const bold = (opts.boldCols || []).includes(ci)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(7.5); setC(doc, bold ? TEXT : [65, 68, 55])
      const s = String(cell ?? '—')
      if (a === 'right') { const tw = doc.getTextWidth(s); doc.text(s, x + colWidths[ci] - tw - 2, y + 4.8) }
      else doc.text(s, x + 3, y + 4.8)
      x += colWidths[ci]
    })
    y += rowH
  })
  return y + 3
}

// ── Key-value detail rows (right-aligned bold value) ─────────────────────────
function detailRows(doc, y, rows, x1, x2) {
  x1 = x1 ?? 15; x2 = x2 ?? 195
  const rowH = 8
  rows.forEach(([label, value], i) => {
    if (i > 0) { lineC(doc, [232, 228, 218]); doc.setLineWidth(0.12); doc.line(x1, y, x2, y) }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setC(doc, MUTED)
    doc.text(label, x1 + 2, y + 5.5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); setC(doc, TEXT)
    const vw = doc.getTextWidth(String(value ?? ''))
    doc.text(String(value ?? ''), x2 - vw - 2, y + 5.5)
    y += rowH
  })
  return y + 3
}

// ── Bordered remarks box ──────────────────────────────────────────────────────
function remarksBox(doc, y, text, x1, x2) {
  x1 = x1 ?? 15; x2 = x2 ?? 195
  const w = x2 - x1, minH = 32
  lineC(doc, BORDER); doc.setLineWidth(0.3)
  doc.rect(x1, y, w, minH, 'S')
  if (text) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setC(doc, TEXT)
    const lines = doc.splitTextToSize(text, w - 8)
    lines.slice(0, 5).forEach((line, i) => doc.text(line, x1 + 4, y + 7 + i * 5))
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); setC(doc, LIGHT)
    doc.text('No remarks', x1 + 4, y + 9)
  }
  return y + minH + 4
}

// ── 3-column signature line ───────────────────────────────────────────────────
function signatureLine(doc, y, labels) {
  const m = 15, pw = 210
  const segW = (pw - 2 * m) / labels.length
  labels.forEach((lbl, i) => {
    const x = m + i * segW
    lineC(doc, [180, 177, 168]); doc.setLineWidth(0.4)
    doc.line(x + 6, y, x + segW - 6, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); setC(doc, MUTED)
    const tw = doc.getTextWidth(lbl)
    doc.text(lbl, x + segW / 2 - tw / 2, y + 5)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCH PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function exportDispatchPDF(dispatch, createdByName) {
  const lib = await loadJsPDF()
  const doc = new lib.jsPDF()
  const pw = 210, m = 15, cw = pw - 2 * m

  const totalMT = (dispatch.dispatch_pellets || []).reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0)
  const dateStr  = fmtDate(dispatch.date)

  let durationStr = '—'
  if (dispatch.loading_time && dispatch.dispatch_time) {
    const [lh, lmin] = dispatch.loading_time.split(':').map(Number)
    const [dh, dmin] = dispatch.dispatch_time.split(':').map(Number)
    const diff = (dh * 60 + dmin) - (lh * 60 + lmin)
    if (diff > 0) durationStr = Math.floor(diff / 60) + 'h ' + (diff % 60) + 'm'
  }

  let y = pageHeader(doc, 'DISPATCH REPORT', null, dispatch.truck_number || '—', dateStr)

  y = infoRow(doc, y, [
    { label: 'CUSTOMER',     value: dispatch.customers?.name || '—' },
    { label: 'DESTINATION',  value: dispatch.destination    || '—' },
    { label: 'TRANSPORTER',  value: dispatch.transporter    || '—' },
    { label: 'INVOICE NO.',  value: dispatch.invoice_no     || '—' },
  ])

  y = kpiRow(doc, y, [
    { label: 'TOTAL QUANTITY', main: totalMT.toFixed(1),                     unit: 'MT' },
    { label: 'LOADING TIME',   main: fmtTime(dispatch.loading_time),          unit: ''   },
    { label: 'DISPATCH TIME',  main: fmtTime(dispatch.dispatch_time),         unit: ''   },
    { label: 'DURATION',       main: durationStr,                             unit: ''   },
  ])

  y = secHead(doc, y, 'DRIVER & VEHICLE')
  y = detailRows(doc, y, [
    ['Vehicle No.',   dispatch.truck_number  || '—'],
    ['Driver',        dispatch.driver_name   || '—'],
    ['Driver Phone',  dispatch.driver_phone  || '—'],
  ])

  y = secHead(doc, y, 'PELLET DETAILS')
  const pelletRows = (dispatch.dispatch_pellets || []).map(p => [
    p.pellet_types?.name || p.pellet_type_name || '—',
    parseFloat(p.quantity_mt || 0).toFixed(1) + ' MT',
  ])
  y = stdTable(doc, y, ['PELLET TYPE', 'QUANTITY'], [130, 50], pelletRows,
    { aligns: ['left', 'right'] })

  // Total row
  fillC(doc, BG_HEAD); doc.rect(m, y, cw, 7, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setC(doc, TEXT)
  doc.text('Total', m + 3, y + 4.8)
  const totStr = totalMT.toFixed(1) + ' MT'
  const totW = doc.getTextWidth(totStr)
  doc.text(totStr, m + cw - totW - 2, y + 4.8)
  y += 10

  y = secHead(doc, y, 'NOTES / REMARKS')
  y = remarksBox(doc, y, dispatch.remarks)

  // Signature — push to at least y=245
  const sigY = Math.max(y + 8, 245)
  signatureLine(doc, sigY, ['Driver Signature', 'Loaded By', 'Authorised By'])

  // Per-page footer
  const createdAt = dispatch.created_at
    ? new Date(dispatch.created_at).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    : dateStr
  const createdStr = 'Created by ' + (createdByName || 'Unknown') + ' · ' + dateStr + ' at ' + (createdAt.split(', ')[1] || createdAt)
  const genStr     = 'app.kanoz.in · Generated ' + fmtNow()
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    lineC(doc, BORDER); doc.setLineWidth(0.2); doc.line(m, 284, pw - m, 284)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setC(doc, MUTED)
    doc.text(createdStr, m, 289)
    const gW = doc.getTextWidth(genStr)
    doc.text(genStr, pw - m - gW, 289)
  }

  doc.save('Dispatch_' + (dispatch.truck_number || '').replace(/\s/g, '_') + '_' + (dispatch.date || '') + '.pdf')
}

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPurchasePDF(purchase, createdByName) {
  const lib = await loadJsPDF()
  const doc = new lib.jsPDF()
  const pw = 210, m = 15, cw = pw - 2 * m

  const qty      = Math.round(purchase.quantity_kg || 0)
  const netWt    = Math.round(purchase.net_weight  || purchase.quantity_kg || 0)
  const totalAmt = Math.round(purchase.total_amount || 0)
  const avgRate  = qty > 0 ? (totalAmt / qty).toFixed(2) : '0.00'
  const dateStr  = fmtDate(purchase.date)
  const timeStr  = fmtTime(purchase.purchase_time)
  const supplier = purchase.suppliers?.name || '—'
  const payment  = (purchase.payment_status || 'PENDING').toUpperCase()

  let y = pageHeader(doc, 'PURCHASE REPORT', null, supplier, dateStr + ' · ' + timeStr)

  y = infoRow(doc, y, [
    { label: 'SUPPLIER',      value: supplier },
    { label: 'RAW MATERIAL',  value: purchase.raw_material_types?.name || '—' },
    { label: 'VEHICLE NO.',   value: purchase.vehicle_number || '—' },
    { label: 'PAYMENT',       value: payment, vs: 8 },
  ])

  y = kpiRow(doc, y, [
    { label: 'NET WEIGHT',    main: netWt.toLocaleString('en-IN'), unit: 'kg' },
    { label: 'FINAL QUANTITY',main: qty.toLocaleString('en-IN'),   unit: 'kg' },
    { label: 'TOTAL AMOUNT',  main: '₹' + totalAmt.toLocaleString('en-IN'), unit: '' },
    { label: 'AVG COST / KG', main: '₹' + avgRate,                unit: '' },
  ])

  y = secHead(doc, y, 'WEIGHT & QUALITY')
  y = detailRows(doc, y, [
    ['Net Weight',     netWt.toLocaleString('en-IN') + ' kg'],
    ['Moisture',       (purchase.moisture_percent != null ? purchase.moisture_percent : 0) + '%'],
    ['Deduction',      (purchase.deduction_kg || 0) + ' kg'],
    ['Final Quantity', qty.toLocaleString('en-IN') + ' kg'],
  ])

  y = secHead(doc, y, 'COST BREAKDOWN')
  const costRows = [
    ['Rate per kg', '₹' + parseFloat(purchase.rate_per_kg || 0).toFixed(2)],
    ['RM Amount',   '₹' + Math.round(purchase.total_rm_amount || 0).toLocaleString('en-IN')],
    ['Loading',     '₹' + Math.round(purchase.loading_expense   || purchase.loading_charges   || 0).toLocaleString('en-IN')],
    ['Unloading',   '₹' + Math.round(purchase.unloading_expense || purchase.unloading_charges || 0).toLocaleString('en-IN')],
    ['Transport',   '₹' + Math.round(purchase.transport_expense || purchase.transport_charges  || 0).toLocaleString('en-IN')],
  ]
  y = stdTable(doc, y, ['ITEM', 'AMOUNT'], [130, 50], costRows, { aligns: ['left', 'right'] })

  // Total row — green
  fillC(doc, GREEN); doc.rect(m, y, cw, 8, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setC(doc, WHITE)
  doc.text('Total Amount', m + 3, y + 5.5)
  const totAmtStr = '₹' + totalAmt.toLocaleString('en-IN')
  const taw = doc.getTextWidth(totAmtStr)
  doc.text(totAmtStr, m + cw - taw - 2, y + 5.5)
  y += 12

  y = secHead(doc, y, 'NOTES / REMARKS')
  y = remarksBox(doc, y, purchase.remarks)

  const sigY = Math.max(y + 8, 245)
  signatureLine(doc, sigY, ['Supplier Signature', 'Received By', 'Authorised By'])

  const createdTime = purchase.created_at
    ? new Date(purchase.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : timeStr
  const createdStr = 'Created by ' + (createdByName || 'Unknown') + ' · ' + dateStr + ' at ' + createdTime
  const genStr     = 'app.kanoz.in · Generated ' + fmtNow()
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    lineC(doc, BORDER); doc.setLineWidth(0.2); doc.line(m, 284, pw - m, 284)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setC(doc, MUTED)
    doc.text(createdStr, m, 289)
    const gW = doc.getTextWidth(genStr)
    doc.text(genStr, pw - m - gW, 289)
  }

  doc.save('Purchase_' + (purchase.suppliers?.name || '').replace(/\s/g, '_') + '_' + (purchase.date || '') + '.pdf')
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT REPORT PDF
// ─────────────────────────────────────────────────────────────────────────────
export async function exportShiftReportPDF(report, data) {
  const lib = await loadJsPDF()
  const doc = new lib.jsPDF()
  const pw = 210, m = 15, cw = pw - 2 * m

  const startDate = report.shift_start_date || report.date
  const endDate   = report.shift_end_date   || startDate
  const startStr  = fmtDate(startDate) + ' · ' + fmtTime(report.start_time)
  const endStr    = fmtDate(endDate)   + ' · ' + fmtTime(report.end_time)

  const totalProd   = parseFloat(report.pellet_production_mt) || 0
  const totalDisp   = (data.dispatches || []).reduce((s, d) =>
    s + (d.dispatch_pellets || []).reduce((ps, p) => ps + (parseFloat(p.quantity_mt) || 0), 0), 0)
  const totalDiesel = (data.equipmentDiesel || []).reduce((s, e) => s + (parseFloat(e.used_litres) || 0), 0)
  const totalRM     = (data.rawMaterials   || []).reduce((s, r) => s + (parseFloat(r.quantity_kg)  || 0), 0)

  let y = pageHeader(doc,
    'SHIFT PRODUCTION REPORT',
    report.plants?.name || '',
    'SHIFT ' + (report.shift || 'A') + ' · ' + fmtDate(report.date || startDate),
    null
  )

  y = infoRow(doc, y, [
    { label: 'SHIFT START', value: startStr, vs: 8.5 },
    { label: 'SHIFT END',   value: endStr,   vs: 8.5 },
    { label: 'SUPERVISOR',  value: report.employees?.name || '—' },
    { label: 'SHIFT',       value: report.shift || 'A' },
  ])

  y = kpiRow(doc, y, [
    { label: 'PRODUCED',    main: totalProd.toFixed(1),              unit: 'MT' },
    { label: 'DISPATCHED',  main: totalDisp.toFixed(1),              unit: 'MT' },
    { label: 'RM USED',     main: (totalRM / 1000).toFixed(2),       unit: 'MT' },
    { label: 'DIESEL USED', main: Math.round(totalDiesel).toString(), unit: 'L'  },
  ])

  // ── MACHINE TIMINGS ──────────────────────────────────────────────────────
  y = secHead(doc, y, 'MACHINE TIMINGS')
  const machRows = (data.machineProduction || []).map(mp => {
    const hrs  = parseFloat(mp.hours_run)      || 0
    const tot  = parseFloat(mp.total_hours)    || hrs
    const prod = parseFloat(mp.production_mt)  || 0
    const avg  = hrs > 0 ? (prod / hrs).toFixed(2) : '—'
    return [mp.machines?.name || '—', hrs + ' h', tot + ' h', prod > 0 ? String(prod) : '—', avg, mp.remarks || '—']
  })
  y = stdTable(doc, y,
    ['MACHINE', 'PRD HRS', 'TOTAL HRS', 'PRD (MT)', 'AVG / HR', 'REMARKS'],
    [42, 22, 24, 22, 22, 48],
    machRows.length ? machRows : null,
    { aligns: ['left','right','right','right','right','left'], noData: 'No machine data' }
  )

  // ── PRODUCTION ───────────────────────────────────────────────────────────
  y = secHead(doc, y, 'PRODUCTION')
  const prodRows = (data.machineProduction || []).map(mp => {
    const prod = parseFloat(mp.production_mt) || 0
    const hrs  = parseFloat(mp.hours_run)     || 0
    const avg  = hrs > 0 ? (prod / hrs).toFixed(2) : '—'
    return [mp.machines?.name || '—', mp.pellet_type_name || '—', prod > 0 ? String(prod) : '—', avg]
  })
  y = stdTable(doc, y,
    ['MACHINE', 'PELLET TYPE', 'QTY (MT)', 'AVG / HR'],
    [52, 76, 32, 20],
    prodRows.length ? prodRows : null,
    { aligns: ['left','left','right','right'], noData: 'No production data' }
  )

  // ── RAW MATERIALS (left 88mm) + PELLET STOCK (right 88mm) ───────────────
  const lW = 88, rW = 88, gap = 4
  const lX = m, rX = m + lW + gap

  y += 4
  const blockY = y

  // Both headings at same y
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setC(doc, GREEN)
  doc.text('RAW MATERIALS', lX, blockY + 5)
  doc.text('PELLET STOCK',  rX, blockY + 5)
  lineC(doc, GREEN); doc.setLineWidth(0.5)
  doc.line(lX, blockY + 7, lX + lW, blockY + 7)
  doc.line(rX, blockY + 7, rX + rW, blockY + 7)

  const tblY = blockY + 12

  const rmRows = (data.rawMaterials || []).map(r => [
    r.raw_material_types?.name || '—',
    String(r.opening_kg   || 0),
    String(r.purchased_kg || 0),
    String(r.quantity_kg  || 0),
    String(r.closing_kg   || 0),
  ])
  // Append mixes with closing_kg > 0 as carry-forward inventory rows
  ;(data.mixes || []).filter(mx => parseFloat(mx.closing_kg) > 0).forEach(mx => {
    rmRows.push([
      (mx.name || 'Mix') + ' [Mix]',
      String(Math.round(parseFloat(mx.opening_kg)  || 0)),
      String(Math.round(parseFloat(mx.prepared_kg) || 0)),
      String(Math.round(parseFloat(mx.used_kg)     || 0)),
      String(Math.round(parseFloat(mx.closing_kg)  || 0)),
    ])
  })
  const rmEndY = stdTable(doc, tblY,
    ['MATERIAL', 'OPEN', 'PURCH', 'USED', 'CLOSE'],
    [40, 12, 12, 12, 12],
    rmRows.length ? rmRows : null,
    { sx: lX, aligns: ['left','right','right','right','right'], noData: 'No data' }
  )
  doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); setC(doc, LIGHT)
  doc.text('All quantities in kg', lX, rmEndY + 1)

  const psRows = (data.pelletStock || []).map(p => [
    p.pellet_types?.name || '—',
    String(p.opening_mt    || 0),
    String(p.production_mt || 0),
    String(p.dispatch_mt   || 0),
    String(p.wastage_mt    || 0),
    String(p.closing_mt    || 0),
  ])
  const psEndY = stdTable(doc, tblY,
    ['TYPE', 'OPEN', 'PRD', 'DISP', 'WASTE', 'CLOSE'],
    [28, 12, 12, 12, 12, 12],
    psRows.length ? psRows : null,
    { sx: rX, aligns: ['left','right','right','right','right','right'], noData: 'No data' }
  )
  doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); setC(doc, LIGHT)
  doc.text('All quantities in MT', rX, psEndY + 1)

  y = Math.max(rmEndY, psEndY) + 6

  // ── MIX STOCK ────────────────────────────────────────────────────────────
  if ((data.mixes || []).length > 0) {
    y = secHead(doc, y, 'MIX STOCK')
    const mixRows = (data.mixes || []).map(mx => [
      mx.name || '—',
      mx.type  || '—',
      String(Math.round(parseFloat(mx.opening_kg)  || 0)),
      String(Math.round(parseFloat(mx.prepared_kg) || 0)),
      String(Math.round(parseFloat(mx.used_kg)     || 0)),
      String(Math.round(parseFloat(mx.closing_kg)  || 0)),
    ])
    y = stdTable(doc, y,
      ['MIX NAME', 'TYPE', 'OPEN (kg)', 'PREP (kg)', 'USED (kg)', 'CLOSE (kg)'],
      [46, 28, 22, 22, 22, 24],
      mixRows,
      { aligns: ['left','left','right','right','right','right'] }
    )
  }

  // ── DIESEL STOCK (from equipment totals) ─────────────────────────────────
  if ((data.equipmentDiesel || []).length > 0) {
    const eqOpen  = (data.equipmentDiesel || []).reduce((s, e) => s + (parseFloat(e.opening_litres)  || 0), 0)
    const eqAdded = (data.equipmentDiesel || []).reduce((s, e) => s + (parseFloat(e.added_litres)    || 0), 0)
    const eqUsed  = (data.equipmentDiesel || []).reduce((s, e) => s + (parseFloat(e.used_litres)     || 0), 0)
    const eqClose = (data.equipmentDiesel || []).reduce((s, e) => s + (parseFloat(e.closing_litres)  || 0), 0)

    y = secHead(doc, y, 'DIESEL STOCK')
    y = stdTable(doc, y,
      ['STORAGE', 'OPEN (L)', 'PURCHASED (L)', 'USED (L)', 'CLOSE (L)'],
      [60, 28, 32, 28, 32],
      [['Main Tank', String(Math.round(eqOpen)), String(Math.round(eqAdded)), String(Math.round(eqUsed)), String(Math.round(eqClose))]],
      { aligns: ['left','right','right','right','right'] }
    )
    // combined note
    const parts = (data.equipmentDiesel || [])
      .map(e => e.equipment_name + ' ' + Math.round(e.closing_litres || 0) + ' L')
    if (parts.length > 0) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7); setC(doc, MUTED)
      const noteStr = 'Combined closing stock: ' + parts.join(' + ') + ' = ' + Math.round(eqClose) + ' L'
      doc.text(noteStr, m, y)
      y += 5
    }
  }

  // ── EQUIPMENT & DIESEL ───────────────────────────────────────────────────
  y = secHead(doc, y, 'EQUIPMENT & DIESEL')
  const eqRows = (data.equipmentDiesel || []).map(e => {
    const open  = parseFloat(e.opening_litres)  || 0
    const added = parseFloat(e.added_litres)    || 0
    const close = parseFloat(e.closing_litres)  || 0
    // used_litres now saved; fall back to open+added-close for old records
    const used  = e.used_litres != null ? parseFloat(e.used_litres) : (open + added - close)
    return [
      e.equipment_name || '—',
      String(Math.round(open)),
      String(Math.round(added)),
      String(Math.round(used)),
      String(Math.round(close)),
      (e.hours_worked || 0) + ' h',
    ]
  })
  y = stdTable(doc, y,
    ['EQUIPMENT', 'OPEN', 'ADDED', 'USED', 'CLOSE', 'HRS'],
    [50, 24, 24, 24, 24, 34],
    eqRows.length ? eqRows : null,
    { aligns: ['left','right','right','right','right','right'], noData: 'No equipment data' }
  )
  doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); setC(doc, LIGHT)
  doc.text('All quantities in litres', m, y)
  y += 5

  // ── VEHICLE DISPATCHES (left 94mm) + ISSUES (right 82mm) ─────────────────
  const vdW = 94, issW = 82
  const vdX = m, issX = m + vdW + 4

  y += 3
  const dispBlockY = y
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setC(doc, GREEN)
  doc.text('VEHICLE DISPATCHES', vdX, dispBlockY + 5)
  doc.text('ISSUES',             issX, dispBlockY + 5)
  lineC(doc, GREEN); doc.setLineWidth(0.5)
  doc.line(vdX,  dispBlockY + 7, vdX  + vdW,  dispBlockY + 7)
  doc.line(issX, dispBlockY + 7, issX + issW, dispBlockY + 7)

  const dispTblY = dispBlockY + 12

  const dispRows = (data.dispatches || []).map(d => {
    const qty = (d.dispatch_pellets || []).reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0)
    return [
      d.truck_number || '—',
      d.customers?.name || '—',
      d.destination || '—',
      qty.toFixed(1),
      fmtTime(d.dispatch_time || d.loading_time),
    ]
  })
  const vdEndY = stdTable(doc, dispTblY,
    ['TRUCK NO.', 'CUSTOMER', 'DESTINATION', 'QTY (MT)', 'TIME'],
    [22, 26, 24, 14, 8],
    dispRows.length ? dispRows : null,
    { sx: vdX, aligns: ['left','left','left','right','right'], noData: 'No data' }
  )

  const issRows = (data.issues || []).map(iss => [
    (iss.description || '').substring(0, 30),
    iss.reported_by || '—',
    iss.status || '—',
  ])
  const issEndY = stdTable(doc, dispTblY,
    ['DESCRIPTION', 'REPORTED BY', 'STATUS'],
    [42, 20, 20],
    issRows.length ? issRows : null,
    { sx: issX, aligns: ['left','left','left'], noData: 'No issues reported' }
  )

  y = Math.max(vdEndY, issEndY) + 4

  // ── HANDOVER NOTES ───────────────────────────────────────────────────────
  if (report.handover_notes) {
    y = secHead(doc, y, 'HANDOVER NOTES')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setC(doc, TEXT)
    const lines = doc.splitTextToSize(report.handover_notes, cw - 4)
    lines.forEach(line => { doc.text(line, m, y); y += 5 })
    y += 4
  }

  // ── Per-page footer ───────────────────────────────────────────────────────
  const reportUrl  = 'app.kanoz.in/reports/' + report.id
  const genStr     = 'Generated ' + fmtNow()
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    lineC(doc, BORDER); doc.setLineWidth(0.2); doc.line(m, 284, pw - m, 284)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setC(doc, MUTED)
    doc.text(reportUrl, m, 289)
    const pgStr = genStr + '  ·  Page ' + i + ' of ' + totalPages
    const pgW   = doc.getTextWidth(pgStr)
    doc.text(pgStr, pw - m - pgW, 289)
  }

  doc.save('Shift ' + report.shift + ' Report — ' + fmtDate(report.date || startDate) + '.pdf')
}
