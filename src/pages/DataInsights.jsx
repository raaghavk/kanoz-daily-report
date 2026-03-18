import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { Loader2, Send } from 'lucide-react'
import { getLocalDate } from '../lib/dateUtils'

// ── Helpers ──
function formatNum(n) { return Math.round(n).toLocaleString('en-IN') }
function formatKg(kg) { return kg >= 1000 ? `${(kg / 1000).toFixed(1)} MT` : `${Math.round(kg)} kg` }
function formatDate(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '' }

function getDateFilter(timeRange) {
  const now = new Date()
  const today = getLocalDate(now)
  switch (timeRange) {
    case 'today': return { from: today, to: today, label: 'today' }
    case 'week': {
      const w = new Date(now); w.setDate(w.getDate() - 7)
      return { from: getLocalDate(w), to: today, label: 'this week' }
    }
    case 'month': {
      return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today, label: 'this month' }
    }
    default: return { from: null, to: null, label: 'overall' }
  }
}

// ── Query matchers ──
const MATCHERS = [
  {
    keywords: ['purchase', 'kharid', 'bought', 'raw material', 'rm '],
    timeWords: { today: 'today', aaj: 'today', week: 'week', month: 'month', mahina: 'month', all: 'all', total: 'all' },
    defaultTime: 'today',
    run: async (plantId, timeRange) => {
      const df = getDateFilter(timeRange)
      let q = supabase.from('raw_material_purchases').select('final_quantity, total_amount, suppliers(name)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No purchases ${df.label}.`
      const totalKg = data.reduce((s, p) => s + (parseFloat(p.final_quantity) || 0), 0)
      const totalAmt = data.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      const avgRate = totalKg > 0 ? totalAmt / totalKg : 0
      return `📦 ${data.length} purchase${data.length > 1 ? 's' : ''} ${df.label}\n\n${formatKg(totalKg)} total quantity\n₹${formatNum(totalAmt)} total amount\n₹${avgRate.toFixed(2)}/kg average cost`
    },
  },
  {
    keywords: ['pending', 'unpaid', 'payment', 'baki', 'baaki'],
    run: async (plantId) => {
      const { data } = await supabase.from('raw_material_purchases').select('total_amount, suppliers(name)').eq('plant_id', plantId).eq('is_deleted', false).eq('payment_status', 'Pending')
      if (!data?.length) return '✅ No pending payments! All clear.'
      const totalAmt = data.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      const bySupplier = {}
      data.forEach(p => { const n = p.suppliers?.name || 'Unknown'; bySupplier[n] = (bySupplier[n] || 0) + (parseFloat(p.total_amount) || 0) })
      const sorted = Object.entries(bySupplier).sort((a, b) => b[1] - a[1])
      let result = `💰 ${data.length} pending payments\n₹${formatNum(totalAmt)} total pending\n`
      sorted.forEach(([name, amt]) => { result += `\n• ${name}: ₹${formatNum(amt)}` })
      return result
    },
  },
  {
    keywords: ['supplier', 'sabhi supplier', 'supplier wise', 'supplierwise'],
    run: async (plantId) => {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const { data } = await supabase.from('raw_material_purchases').select('final_quantity, total_amount, suppliers(name)').eq('plant_id', plantId).eq('is_deleted', false).gte('date', monthStart)
      if (!data?.length) return 'No purchases this month.'
      const bySupplier = {}
      data.forEach(p => {
        const n = p.suppliers?.name || 'Unknown'
        if (!bySupplier[n]) bySupplier[n] = { qty: 0, amt: 0, count: 0 }
        bySupplier[n].qty += parseFloat(p.final_quantity) || 0
        bySupplier[n].amt += parseFloat(p.total_amount) || 0
        bySupplier[n].count++
      })
      const sorted = Object.entries(bySupplier).sort((a, b) => b[1].amt - a[1].amt)
      let result = `👤 Supplier-wise this month:\n`
      sorted.forEach(([name, d]) => { result += `\n• ${name}\n  ${d.count} purchases · ${formatKg(d.qty)} · ₹${formatNum(d.amt)}` })
      return result
    },
  },
  {
    keywords: ['dispatch', 'truck', 'gaadi', 'vehicle out'],
    timeWords: { today: 'today', aaj: 'today', week: 'week', month: 'month', all: 'all' },
    defaultTime: 'today',
    run: async (plantId, timeRange) => {
      const df = getDateFilter(timeRange)
      let q = supabase.from('vehicle_dispatches').select('truck_number, customers(name), dispatch_pellets(quantity_mt, pellet_type_name)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No dispatches ${df.label}.`
      const totalMT = data.reduce((s, d) => s + (d.dispatch_pellets || []).reduce((ss, p) => ss + (parseFloat(p.quantity_mt) || 0), 0), 0)
      const byType = {}
      data.forEach(d => (d.dispatch_pellets || []).forEach(p => { const n = p.pellet_type_name || 'Unknown'; byType[n] = (byType[n] || 0) + (parseFloat(p.quantity_mt) || 0) }))
      let result = `🚛 ${data.length} truck${data.length > 1 ? 's' : ''} dispatched ${df.label}\n${totalMT.toFixed(1)} MT total`
      Object.entries(byType).forEach(([name, qty]) => { result += `\n• ${name}: ${qty.toFixed(1)} MT` })
      return result
    },
  },
  {
    keywords: ['production', 'pellet production', 'utpaadan', 'output'],
    timeWords: { today: 'today', aaj: 'today', week: 'week', month: 'month' },
    defaultTime: 'today',
    run: async (plantId, timeRange) => {
      const df = getDateFilter(timeRange)
      let q = supabase.from('shift_reports').select('shift, pellet_production_mt, machine_production(machines(name), production_mt, hours_run)').eq('plant_id', plantId).eq('is_deleted', false)
      if (df.from) q = q.gte('date', df.from)
      if (df.to) q = q.lte('date', df.to)
      const { data } = await q
      if (!data?.length) return `No shift reports ${df.label}.`
      const totalMT = data.reduce((s, r) => s + (parseFloat(r.pellet_production_mt) || 0), 0)
      let result = `⚙️ ${data.length} shift report${data.length > 1 ? 's' : ''} ${df.label}\n${totalMT.toFixed(1)} MT total production`
      if (timeRange === 'today') {
        data.forEach(r => {
          result += `\n\nShift ${r.shift}: ${parseFloat(r.pellet_production_mt || 0).toFixed(1)} MT`
          ;(r.machine_production || []).forEach(mp => { result += `\n• ${mp.machines?.name || 'Machine'}: ${parseFloat(mp.production_mt || 0).toFixed(1)} MT` })
        })
      }
      return result
    },
  },
  {
    keywords: ['diesel', 'diesel stock', 'fuel'],
    run: async (plantId) => {
      const { data: report } = await supabase.from('shift_reports').select('date, shift, diesel_stock(opening_litres, purchased_litres, used_litres, closing_litres)').eq('plant_id', plantId).eq('is_deleted', false).order('date', { ascending: false }).order('shift', { ascending: false }).limit(1).maybeSingle()
      if (!report?.diesel_stock) return 'No diesel data available yet.'
      const ds = Array.isArray(report.diesel_stock) ? report.diesel_stock[0] : report.diesel_stock
      if (!ds) return 'No diesel data available yet.'
      return `⛽ Diesel Stock (Shift ${report.shift}, ${formatDate(report.date)})\n\nOpening: ${ds.opening_litres || 0} L\nPurchased: +${ds.purchased_litres || 0} L\nUsed: -${ds.used_litres || 0} L\nClosing: ${ds.closing_litres || 0} L`
    },
  },
  {
    keywords: ['pellet stock', 'pellet inventory', 'stock pellet'],
    run: async (plantId) => {
      const { data: report } = await supabase.from('shift_reports').select('date, shift, pellet_stock(pellet_types(name), opening_mt, closing_mt)').eq('plant_id', plantId).eq('is_deleted', false).order('date', { ascending: false }).order('shift', { ascending: false }).limit(1).maybeSingle()
      if (!report?.pellet_stock?.length) return 'No pellet stock data available yet.'
      let result = `📦 Pellet Stock (Shift ${report.shift}, ${formatDate(report.date)}):`
      report.pellet_stock.forEach(ps => { result += `\n\n${ps.pellet_types?.name || 'Unknown'}: ${parseFloat(ps.closing_mt || 0).toFixed(1)} MT` })
      return result
    },
  },
  {
    keywords: ['raw material stock', 'rm stock', 'material stock', 'stock raw'],
    run: async (plantId) => {
      const { data: report } = await supabase.from('shift_reports').select('date, shift, raw_material_usage(raw_material_types(name), closing_kg)').eq('plant_id', plantId).eq('is_deleted', false).order('date', { ascending: false }).order('shift', { ascending: false }).limit(1).maybeSingle()
      if (!report?.raw_material_usage?.length) return 'No raw material stock data available yet.'
      let result = `🪵 RM Stock (Shift ${report.shift}, ${formatDate(report.date)}):`
      report.raw_material_usage.forEach(rm => { result += `\n\n${rm.raw_material_types?.name || 'Unknown'}: ${formatKg(parseFloat(rm.closing_kg || 0))}` })
      return result
    },
  },
  {
    keywords: ['stock', 'inventory', 'all stock'],
    run: async (plantId) => {
      const { data: report } = await supabase.from('shift_reports').select('date, shift, pellet_stock(pellet_types(name), closing_mt), raw_material_usage(raw_material_types(name), closing_kg), diesel_stock(closing_litres)').eq('plant_id', plantId).eq('is_deleted', false).order('date', { ascending: false }).order('shift', { ascending: false }).limit(1).maybeSingle()
      if (!report) return 'No stock data available yet.'
      let result = `📊 All Stock (Shift ${report.shift}, ${formatDate(report.date)}):`
      if (report.pellet_stock?.length) {
        result += '\n\n🔵 Pellet Stock:'
        report.pellet_stock.forEach(ps => { result += `\n  ${ps.pellet_types?.name}: ${parseFloat(ps.closing_mt || 0).toFixed(1)} MT` })
      }
      if (report.raw_material_usage?.length) {
        result += '\n\n🟤 Raw Material:'
        report.raw_material_usage.forEach(rm => { result += `\n  ${rm.raw_material_types?.name}: ${formatKg(parseFloat(rm.closing_kg || 0))}` })
      }
      if (report.diesel_stock) {
        const ds = Array.isArray(report.diesel_stock) ? report.diesel_stock[0] : report.diesel_stock
        if (ds) result += `\n\n⛽ Diesel: ${ds.closing_litres || 0} L`
      }
      return result
    },
  },
]

const SUGGESTIONS = [
  "Purchases today",
  "Pending payments",
  "Dispatches this week",
  "Diesel stock",
  "All stock",
  "Monthly production",
  "Supplier summary",
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
  let timeRange = bestMatch.defaultTime || null
  if (bestMatch.timeWords) {
    for (const [word, range] of Object.entries(bestMatch.timeWords)) {
      if (lower.includes(word)) { timeRange = range; break }
    }
  }
  return { matcher: bestMatch, timeRange }
}

// ── Component ──
export default function DataInsights() {
  const { plant } = useAuth()
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! Ask me about your plant data — purchases, dispatches, production, stock, payments.\n\nTry tapping a suggestion or type your question." },
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
        setMessages(prev => [...prev, { role: 'bot', text: "I didn't understand that. Try asking about:\n\n• Purchases (today / week / month)\n• Pending payments\n• Dispatches\n• Production\n• Diesel / Pellet / RM stock\n• Supplier summary\n• All stock" }])
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
