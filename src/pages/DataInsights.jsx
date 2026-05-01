import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { Loader2, Send } from 'lucide-react'
import { getLocalDate } from '../lib/dateUtils'

// ── Helpers ──
function fmt(n) { return Math.round(n).toLocaleString('en-IN') }
function fmtKg(kg) { return kg >= 1000 ? `${(kg / 1000).toFixed(1)} MT` : `${Math.round(kg)} kg` }
function fmtDate(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '' }

function getDateRange(timeRange) {
  const now = new Date()
  const today = getLocalDate(now)
  const y = new Date(now); y.setDate(y.getDate() - 1)
  const yesterday = getLocalDate(y)
  switch (timeRange) {
    case 'today': return { from: today, to: today, label: 'today' }
    case 'yesterday': return { from: yesterday, to: yesterday, label: 'yesterday' }
    case 'week': { const w = new Date(now); w.setDate(w.getDate() - 7); return { from: getLocalDate(w), to: today, label: 'this week' } }
    case 'month': return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today, label: 'this month' }
    case 'last_month': {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: getLocalDate(lm), to: getLocalDate(lmEnd), label: 'last month' }
    }
    default: return { from: null, to: null, label: 'overall' }
  }
}

const TIME_WORDS = {
  today: 'today', aaj: 'today', 'aaj ka': 'today',
  yesterday: 'yesterday', kal: 'yesterday', 'kal ka': 'yesterday', beeta: 'yesterday',
  'this week': 'week', week: 'week', 'is hafte': 'week', hafta: 'week',
  'this month': 'month', month: 'month', 'is mahine': 'month', mahina: 'month',
  'last month': 'last_month', 'pichle mahine': 'last_month', 'pichhla mahina': 'last_month',
  all: 'all', total: 'all', sab: 'all', 'all time': 'all',
}

function detectTime(input) {
  const lower = input.toLowerCase()
  // Check longest phrases first
  const sorted = Object.entries(TIME_WORDS).sort((a, b) => b[0].length - a[0].length)
  for (const [phrase, range] of sorted) {
    if (lower.includes(phrase)) return range
  }
  return null
}

// ── All Query Matchers ──
const MATCHERS = [
  // PURCHASES
  {
    keywords: ['purchase', 'kharid', 'bought', 'raw material purchase', 'rm purchase', 'kitna kharida', 'kitne purchase'],
    defaultTime: 'today',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      let q = supabase.from('raw_material_purchases').select('quantity_kg, total_amount, rate_per_kg, suppliers(name), raw_material_types(name)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No purchases ${df.label}.`
      const totalKg = data.reduce((s, p) => s + (parseFloat(p.quantity_kg) || 0), 0)
      const totalAmt = data.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      const avgRate = totalKg > 0 ? totalAmt / totalKg : 0
      // Group by material type
      const byType = {}
      data.forEach(p => {
        const name = p.raw_material_types?.name || 'Other'
        if (!byType[name]) byType[name] = { qty: 0, amt: 0 }
        byType[name].qty += parseFloat(p.quantity_kg) || 0
        byType[name].amt += parseFloat(p.total_amount) || 0
      })
      let result = `📦 ${data.length} purchase${data.length > 1 ? 's' : ''} ${df.label}\n\n${fmtKg(totalKg)} total quantity\n₹${fmt(totalAmt)} total amount\n₹${avgRate.toFixed(2)}/kg avg cost`
      if (Object.keys(byType).length > 1) {
        result += '\n'
        Object.entries(byType).forEach(([name, d]) => { result += `\n• ${name}: ${fmtKg(d.qty)} (₹${fmt(d.amt)})` })
      }
      return result
    },
  },
  // PENDING PAYMENTS
  {
    keywords: ['pending', 'unpaid', 'payment due', 'baki', 'baaki', 'udhar', 'pending payment'],
    run: async (plantId) => {
      const { data } = await supabase.from('raw_material_purchases').select('total_amount, suppliers(name)').eq('plant_id', plantId).eq('is_deleted', false).eq('payment_status', 'Pending')
      if (!data?.length) return '✅ No pending payments! All clear.'
      const totalAmt = data.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      const bySupplier = {}
      data.forEach(p => { const n = p.suppliers?.name || 'Unknown'; bySupplier[n] = (bySupplier[n] || 0) + (parseFloat(p.total_amount) || 0) })
      const sorted = Object.entries(bySupplier).sort((a, b) => b[1] - a[1])
      let result = `💰 ${data.length} pending payments\n₹${fmt(totalAmt)} total pending\n`
      sorted.forEach(([name, amt]) => { result += `\n• ${name}: ₹${fmt(amt)}` })
      return result
    },
  },
  // SUPPLIER SUMMARY
  {
    keywords: ['supplier', 'supplier wise', 'supplierwise', 'sabhi supplier', 'supplier summary', 'supplier report'],
    run: async (plantId, time) => {
      const df = getDateRange(time || 'month')
      let q = supabase.from('raw_material_purchases').select('quantity_kg, total_amount, suppliers(name)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No purchases ${df.label}.`
      const bySupplier = {}
      data.forEach(p => {
        const n = p.suppliers?.name || 'Unknown'
        if (!bySupplier[n]) bySupplier[n] = { qty: 0, amt: 0, count: 0 }
        bySupplier[n].qty += parseFloat(p.quantity_kg) || 0
        bySupplier[n].amt += parseFloat(p.total_amount) || 0
        bySupplier[n].count++
      })
      const sorted = Object.entries(bySupplier).sort((a, b) => b[1].amt - a[1].amt)
      let result = `👤 Supplier-wise (${df.label}):\n`
      sorted.forEach(([name, d]) => { result += `\n• ${name}\n  ${d.count} purchases · ${fmtKg(d.qty)} · ₹${fmt(d.amt)}` })
      return result
    },
  },
  // DISPATCHES
  {
    keywords: ['dispatch', 'truck', 'gaadi', 'vehicle out', 'kitni gaadi', 'nikli', 'dispatched'],
    defaultTime: 'today',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      let q = supabase.from('vehicle_dispatches').select('truck_number, customers(name), dispatch_pellets(quantity_mt, pellet_type_name)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No dispatches ${df.label}.`
      const totalMT = data.reduce((s, d) => s + (d.dispatch_pellets || []).reduce((ss, p) => ss + (parseFloat(p.quantity_mt) || 0), 0), 0)
      const byType = {}
      data.forEach(d => (d.dispatch_pellets || []).forEach(p => { const n = p.pellet_type_name || 'Unknown'; byType[n] = (byType[n] || 0) + (parseFloat(p.quantity_mt) || 0) }))
      const byCustomer = {}
      data.forEach(d => { const n = d.customers?.name || 'Unknown'; byCustomer[n] = (byCustomer[n] || 0) + 1 })
      let result = `🚛 ${data.length} truck${data.length > 1 ? 's' : ''} dispatched ${df.label}\n${totalMT.toFixed(1)} MT total`
      if (Object.keys(byType).length > 0) {
        result += '\n'
        Object.entries(byType).forEach(([name, qty]) => { result += `\n• ${name}: ${qty.toFixed(1)} MT` })
      }
      if (Object.keys(byCustomer).length > 1) {
        result += '\n\nBy customer:'
        Object.entries(byCustomer).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => { result += `\n• ${name}: ${count} truck${count > 1 ? 's' : ''}` })
      }
      return result
    },
  },
  // PRODUCTION
  {
    keywords: ['production', 'pellet production', 'utpaadan', 'output', 'kitna bana', 'manufactured', 'produce'],
    defaultTime: 'today',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      let q = supabase.from('shift_reports').select('shift, date, pellet_production_mt, machine_production(machines(name), production_mt, hours_run)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No shift reports ${df.label}.`
      const totalMT = data.reduce((s, r) => s + (parseFloat(r.pellet_production_mt) || 0), 0)
      let result = `⚙️ ${totalMT.toFixed(1)} MT production ${df.label} (${data.length} shift${data.length > 1 ? 's' : ''})`
      // Machine breakdown
      const byMachine = {}
      data.forEach(r => (r.machine_production || []).forEach(mp => {
        const name = mp.machines?.name || 'Machine'
        if (!byMachine[name]) byMachine[name] = { mt: 0, hrs: 0 }
        byMachine[name].mt += parseFloat(mp.production_mt) || 0
        byMachine[name].hrs += parseFloat(mp.hours_run) || 0
      }))
      if (Object.keys(byMachine).length > 0) {
        result += '\n\nMachine-wise:'
        Object.entries(byMachine).forEach(([name, d]) => { result += `\n• ${name}: ${d.mt.toFixed(1)} MT (${d.hrs.toFixed(1)} hrs)` })
      }
      return result
    },
  },
  // DIESEL STOCK
  {
    keywords: ['diesel', 'diesel stock', 'fuel', 'fuel stock', 'kitna diesel'],
    run: async (plantId) => {
      const { data: report } = await supabase.from('shift_reports').select('date, shift, diesel_stock(opening_litres, purchased_litres, used_litres, closing_litres)').eq('plant_id', plantId).eq('is_deleted', false).order('date', { ascending: false }).order('shift', { ascending: false }).limit(1).maybeSingle()
      if (!report?.diesel_stock) return 'No diesel data available yet.'
      const ds = Array.isArray(report.diesel_stock) ? report.diesel_stock[0] : report.diesel_stock
      if (!ds) return 'No diesel data available yet.'
      return `⛽ Diesel Stock (Shift ${report.shift}, ${fmtDate(report.date)})\n\nOpening: ${ds.opening_litres || 0} L\nPurchased: +${ds.purchased_litres || 0} L\nUsed: -${ds.used_litres || 0} L\n\n📊 Closing: ${ds.closing_litres || 0} L`
    },
  },
  // PELLET STOCK
  {
    keywords: ['pellet stock', 'pellet inventory', 'stock pellet', 'kitna pellet', 'pellet kitna'],
    run: async (plantId) => {
      const { data: report } = await supabase.from('shift_reports').select('date, shift, pellet_stock(pellet_types(name), opening_mt, closing_mt)').eq('plant_id', plantId).eq('is_deleted', false).order('date', { ascending: false }).order('shift', { ascending: false }).limit(1).maybeSingle()
      if (!report?.pellet_stock?.length) return 'No pellet stock data available yet.'
      let total = 0
      let result = `📦 Pellet Stock (Shift ${report.shift}, ${fmtDate(report.date)}):\n`
      report.pellet_stock.forEach(ps => {
        const closing = parseFloat(ps.closing_mt || 0)
        total += closing
        result += `\n• ${ps.pellet_types?.name || 'Unknown'}: ${closing.toFixed(1)} MT`
      })
      result += `\n\n📊 Total: ${total.toFixed(1)} MT`
      return result
    },
  },
  // RAW MATERIAL STOCK
  {
    keywords: ['raw material stock', 'rm stock', 'material stock', 'stock raw', 'kitna material', 'raw material kitna'],
    run: async (plantId) => {
      const { data: report } = await supabase.from('shift_reports').select('date, shift, raw_material_usage(raw_material_types(name), closing_kg)').eq('plant_id', plantId).eq('is_deleted', false).order('date', { ascending: false }).order('shift', { ascending: false }).limit(1).maybeSingle()
      if (!report?.raw_material_usage?.length) return 'No raw material stock data available yet.'
      let result = `🪵 RM Stock (Shift ${report.shift}, ${fmtDate(report.date)}):\n`
      report.raw_material_usage.forEach(rm => { result += `\n• ${rm.raw_material_types?.name || 'Unknown'}: ${fmtKg(parseFloat(rm.closing_kg || 0))}` })
      return result
    },
  },
  // ALL STOCK
  {
    keywords: ['all stock', 'stock', 'inventory', 'sabhi stock', 'pura stock'],
    run: async (plantId) => {
      const { data: report } = await supabase.from('shift_reports').select('date, shift, pellet_stock(pellet_types(name), closing_mt), raw_material_usage(raw_material_types(name), closing_kg), diesel_stock(closing_litres)').eq('plant_id', plantId).eq('is_deleted', false).order('date', { ascending: false }).order('shift', { ascending: false }).limit(1).maybeSingle()
      if (!report) return 'No stock data available yet.'
      let result = `📊 All Stock (Shift ${report.shift}, ${fmtDate(report.date)}):`
      if (report.pellet_stock?.length) {
        result += '\n\n📦 Pellets:'
        report.pellet_stock.forEach(ps => { result += `\n  ${ps.pellet_types?.name}: ${parseFloat(ps.closing_mt || 0).toFixed(1)} MT` })
      }
      if (report.raw_material_usage?.length) {
        result += '\n\n🪵 Raw Material:'
        report.raw_material_usage.forEach(rm => { result += `\n  ${rm.raw_material_types?.name}: ${fmtKg(parseFloat(rm.closing_kg || 0))}` })
      }
      if (report.diesel_stock) {
        const ds = Array.isArray(report.diesel_stock) ? report.diesel_stock[0] : report.diesel_stock
        if (ds) result += `\n\n⛽ Diesel: ${ds.closing_litres || 0} L`
      }
      return result
    },
  },
  // TOTAL SPENDING / EXPENSES
  {
    keywords: ['spending', 'expense', 'kharcha', 'total spend', 'how much spent', 'kitna kharcha'],
    defaultTime: 'month',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      let q = supabase.from('raw_material_purchases').select('total_amount, loading_expense, unloading_expense, transport_expense, other_expense').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No spending data ${df.label}.`
      const totalAmt = data.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      const totalLoading = data.reduce((s, p) => s + (parseFloat(p.loading_expense) || 0), 0)
      const totalUnloading = data.reduce((s, p) => s + (parseFloat(p.unloading_expense) || 0), 0)
      const totalTransport = data.reduce((s, p) => s + (parseFloat(p.transport_expense) || 0), 0)
      const totalCharges = totalLoading + totalUnloading + totalTransport
      return `💸 Spending ${df.label}:\n\n₹${fmt(totalAmt)} total purchase amount\n₹${fmt(totalCharges)} in charges (loading + unloading + transport)\n\n${data.length} purchases made`
    },
  },
  // COUNTS / NUMBERS
  {
    keywords: ['how many', 'kitne', 'count', 'total number', 'number of'],
    defaultTime: 'today',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      let pq = supabase.from('raw_material_purchases').select('id', { count: 'exact', head: true }).eq('plant_id', plantId).eq('is_deleted', false)
      let dq = supabase.from('vehicle_dispatches').select('id', { count: 'exact', head: true }).eq('plant_id', plantId).eq('is_deleted', false)
      let rq = supabase.from('shift_reports').select('id', { count: 'exact', head: true }).eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) { pq = pq.gte('date', df.from); dq = dq.gte('date', df.from); rq = rq.gte('date', df.from) }
      if (df.to) { pq = pq.lte('date', df.to); dq = dq.lte('date', df.to); rq = rq.lte('date', df.to) }
      const [pr, dr, rr] = await Promise.all([pq, dq, rq])
      return `📊 Counts ${df.label}:\n\n• ${pr.count || 0} purchases\n• ${dr.count || 0} dispatches\n• ${rr.count || 0} shift reports`
    },
  },
  // CUSTOMER WISE DISPATCHES
  {
    keywords: ['customer', 'customer wise', 'customerwise', 'client wise'],
    defaultTime: 'month',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      let q = supabase.from('vehicle_dispatches').select('customers(name), dispatch_pellets(quantity_mt)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No dispatches ${df.label}.`
      const byCustomer = {}
      data.forEach(d => {
        const name = d.customers?.name || 'Unknown'
        if (!byCustomer[name]) byCustomer[name] = { trucks: 0, mt: 0 }
        byCustomer[name].trucks++
        byCustomer[name].mt += (d.dispatch_pellets || []).reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0)
      })
      const sorted = Object.entries(byCustomer).sort((a, b) => b[1].mt - a[1].mt)
      let result = `🏭 Customer-wise dispatches (${df.label}):\n`
      sorted.forEach(([name, d]) => { result += `\n• ${name}: ${d.mt.toFixed(1)} MT (${d.trucks} truck${d.trucks > 1 ? 's' : ''})` })
      return result
    },
  },
  // MATERIAL TYPE WISE PURCHASES
  {
    keywords: ['material wise', 'materialwise', 'material type', 'type wise', 'rm type'],
    defaultTime: 'month',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      let q = supabase.from('raw_material_purchases').select('quantity_kg, total_amount, raw_material_types(name)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No purchases ${df.label}.`
      const byType = {}
      data.forEach(p => {
        const name = p.raw_material_types?.name || 'Other'
        if (!byType[name]) byType[name] = { qty: 0, amt: 0, count: 0 }
        byType[name].qty += parseFloat(p.quantity_kg) || 0
        byType[name].amt += parseFloat(p.total_amount) || 0
        byType[name].count++
      })
      const sorted = Object.entries(byType).sort((a, b) => b[1].amt - a[1].amt)
      let result = `🪵 Material type-wise (${df.label}):\n`
      sorted.forEach(([name, d]) => { result += `\n• ${name}\n  ${d.count} purchases · ${fmtKg(d.qty)} · ₹${fmt(d.amt)}` })
      return result
    },
  },
  // AVERAGE RATE
  {
    keywords: ['average rate', 'avg rate', 'rate per kg', 'avg cost', 'average cost', 'kitne ka'],
    defaultTime: 'month',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      let q = supabase.from('raw_material_purchases').select('quantity_kg, total_amount, raw_material_types(name)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No purchase data ${df.label}.`
      const byType = {}
      data.forEach(p => {
        const name = p.raw_material_types?.name || 'Other'
        if (!byType[name]) byType[name] = { qty: 0, amt: 0 }
        byType[name].qty += parseFloat(p.quantity_kg) || 0
        byType[name].amt += parseFloat(p.total_amount) || 0
      })
      let result = `📊 Average purchase rate (${df.label}):\n`
      Object.entries(byType).forEach(([name, d]) => {
        const rate = d.qty > 0 ? d.amt / d.qty : 0
        result += `\n• ${name}: ₹${rate.toFixed(2)}/kg`
      })
      return result
    },
  },
  // ISSUES
  {
    keywords: ['issue', 'problem', 'breakdown', 'dikkat', 'samasya', 'kharab'],
    defaultTime: 'week',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      let q = supabase.from('shift_reports').select('date, shift, issues(description, severity, issue_type, is_resolved, machines(name))').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      const allIssues = (data || []).flatMap(r => (r.issues || []).map(i => ({ ...i, date: r.date, shift: r.shift })))
      if (!allIssues.length) return `✅ No issues reported ${df.label}.`
      const unresolved = allIssues.filter(i => !i.is_resolved)
      let result = `⚠️ ${allIssues.length} issue${allIssues.length > 1 ? 's' : ''} ${df.label} (${unresolved.length} unresolved)\n`
      allIssues.slice(0, 5).forEach(i => {
        result += `\n• ${i.description || 'No description'}`
        if (i.machines?.name) result += ` (${i.machines.name})`
        result += ` — ${i.severity || 'medium'}`
      })
      if (allIssues.length > 5) result += `\n\n...and ${allIssues.length - 5} more`
      return result
    },
  },
  // TODAY SUMMARY / DAILY SUMMARY
  {
    keywords: ['summary', 'overview', 'aaj ka haal', 'daily summary', 'report summary'],
    defaultTime: 'today',
    run: async (plantId, time) => {
      const df = getDateRange(time)
      const [pRes, dRes, rRes] = await Promise.all([
        supabase.from('raw_material_purchases').select('quantity_kg, total_amount').eq('plant_id', plantId).eq('is_deleted', false).gte('date', df.from || '2024-01-01').lte('date', df.to || getLocalDate()),
        supabase.from('vehicle_dispatches').select('dispatch_pellets(quantity_mt)').eq('plant_id', plantId).eq('is_deleted', false).gte('date', df.from || '2024-01-01').lte('date', df.to || getLocalDate()),
        supabase.from('shift_reports').select('pellet_production_mt').eq('plant_id', plantId).eq('is_deleted', false).gte('date', df.from || '2024-01-01').lte('date', df.to || getLocalDate()),
      ])
      const purchases = pRes.data || []
      const dispatches = dRes.data || []
      const reports = rRes.data || []
      const purchaseAmt = purchases.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      const purchaseKg = purchases.reduce((s, p) => s + (parseFloat(p.quantity_kg) || 0), 0)
      const dispatchMT = dispatches.reduce((s, d) => s + (d.dispatch_pellets || []).reduce((ss, p) => ss + (parseFloat(p.quantity_mt) || 0), 0), 0)
      const prodMT = reports.reduce((s, r) => s + (parseFloat(r.pellet_production_mt) || 0), 0)
      return `📋 Summary (${df.label}):\n\n⚙️ Production: ${prodMT.toFixed(1)} MT\n🚛 Dispatched: ${dispatchMT.toFixed(1)} MT (${dispatches.length} trucks)\n📦 Purchased: ${fmtKg(purchaseKg)} (₹${fmt(purchaseAmt)})\n📝 Shift Reports: ${reports.length}`
    },
  },
]

const SUGGESTIONS = [
  "Summary today",
  "Purchases yesterday",
  "Pending payments",
  "Dispatches this week",
  "Production this month",
  "All stock",
  "Supplier summary",
  "Customer wise",
  "Average rate",
]

function matchQuery(input) {
  const lower = input.toLowerCase().trim()
  let bestMatch = null
  let bestScore = 0
  for (const matcher of MATCHERS) {
    for (const kw of matcher.keywords) {
      if (lower.includes(kw) && kw.length > bestScore) {
        bestMatch = matcher
        bestScore = kw.length
      }
    }
  }
  if (!bestMatch) return null
  const timeRange = detectTime(lower) || bestMatch.defaultTime || null
  return { matcher: bestMatch, timeRange }
}

// ── Component ──
export default function DataInsights() {
  const { plant } = useAuth()
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! Ask me about your plant data.\n\nTry: purchases, dispatches, production, stock, payments, spending, issues, summary — for today, yesterday, this week, or this month." },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text) {
    const question = (text || input).trim()
    if (!question || loading || !plant?.id) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setLoading(true)
    try {
      const match = matchQuery(question)
      if (!match) {
        setMessages(prev => [...prev, { role: 'bot', text: "I didn't understand that. Try asking about:\n\n• Purchases / Spending\n• Pending payments\n• Dispatches\n• Production\n• Stock (diesel / pellet / RM / all)\n• Supplier / Customer / Material summary\n• Average rate\n• Issues / Breakdowns\n• Daily summary\n\nAdd: today, yesterday, this week, this month, last month" }])
        return
      }
      const answer = await match.matcher.run(plant.id, match.timeRange)
      setMessages(prev => [...prev, { role: 'bot', text: answer }])
    } catch (err) {
      console.error('Query error:', err)
      setMessages(prev => [...prev, { role: 'bot', text: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#fefae0' }}>
      <div style={{ flexShrink: 0 }}>
        <PageHeader title="Data Assistant" subtitle="Ask about your plant data" backTo="/" />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '85%', padding: '12px 16px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? '#2d6a4f' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#2c2c2c',
              border: msg.role === 'bot' ? '1.5px solid #e5ddd0' : 'none',
              fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontWeight: 500,
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '12px 20px', borderRadius: '14px 14px 14px 4px', background: '#fff', border: '1.5px solid #e5ddd0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={16} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#595c4a' }}>Looking up...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && (
        <div style={{ flexShrink: 0, padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => handleSend(s)} style={{
              padding: '8px 14px', borderRadius: 20, background: '#fff', border: '1.5px solid #e5ddd0',
              fontSize: 12, fontWeight: 600, color: '#2d6a4f', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{
        flexShrink: 0, padding: '12px 16px', background: '#fff', borderTop: '1px solid #e5ddd0',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask about purchases, stock, dispatches..."
          disabled={loading}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 24, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', background: '#fefae0', color: '#2c2c2c' }}
        />
        <button onClick={() => handleSend()} disabled={loading || !input.trim()} style={{
          width: 44, height: 44, borderRadius: '50%', background: input.trim() ? '#2d6a4f' : '#e5ddd0',
          border: 'none', cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Send size={18} color="#fff" />
        </button>
      </div>
    </div>
  )
}
