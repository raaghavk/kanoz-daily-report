import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { Loader2, Package, Truck, BarChart3, Fuel, Users, IndianRupee } from 'lucide-react'

const QUERIES = [
  {
    id: 'purchases_today',
    label: "Today's Purchases",
    icon: '📦',
    category: 'purchases',
    run: async (plantId) => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('raw_material_purchases')
        .select('final_quantity, total_amount, suppliers(name)')
        .eq('plant_id', plantId)
        .eq('date', today)
        .eq('is_deleted', false)
      if (!data || data.length === 0) return 'No purchases today.'
      const totalKg = data.reduce((s, p) => s + (parseFloat(p.final_quantity) || 0), 0)
      const totalAmt = data.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      return `${data.length} purchase${data.length > 1 ? 's' : ''} today\n${formatKg(totalKg)} total quantity\n₹${formatNum(totalAmt)} total amount`
    },
  },
  {
    id: 'purchases_this_month',
    label: 'Monthly Purchases',
    icon: '📊',
    category: 'purchases',
    run: async (plantId) => {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const { data } = await supabase
        .from('raw_material_purchases')
        .select('final_quantity, total_amount')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .gte('date', monthStart)
      if (!data || data.length === 0) return 'No purchases this month.'
      const totalKg = data.reduce((s, p) => s + (parseFloat(p.final_quantity) || 0), 0)
      const totalAmt = data.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      const avgRate = totalKg > 0 ? totalAmt / totalKg : 0
      return `${data.length} purchases this month\n${formatKg(totalKg)} total quantity\n₹${formatNum(totalAmt)} total amount\n₹${avgRate.toFixed(2)}/kg average cost`
    },
  },
  {
    id: 'pending_payments',
    label: 'Pending Payments',
    icon: '💰',
    category: 'purchases',
    run: async (plantId) => {
      const { data } = await supabase
        .from('raw_material_purchases')
        .select('total_amount, suppliers(name)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .eq('payment_status', 'Pending')
      if (!data || data.length === 0) return 'No pending payments! All clear.'
      const totalAmt = data.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      // Group by supplier
      const bySupplier = {}
      data.forEach(p => {
        const name = p.suppliers?.name || 'Unknown'
        bySupplier[name] = (bySupplier[name] || 0) + (parseFloat(p.total_amount) || 0)
      })
      const top3 = Object.entries(bySupplier).sort((a, b) => b[1] - a[1]).slice(0, 3)
      let result = `${data.length} pending payments\n₹${formatNum(totalAmt)} total pending\n\nTop suppliers:`
      top3.forEach(([name, amt]) => {
        result += `\n• ${name}: ₹${formatNum(amt)}`
      })
      return result
    },
  },
  {
    id: 'supplier_summary',
    label: 'Supplier Summary',
    icon: '👤',
    category: 'purchases',
    run: async (plantId) => {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const { data } = await supabase
        .from('raw_material_purchases')
        .select('final_quantity, total_amount, suppliers(name)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .gte('date', monthStart)
      if (!data || data.length === 0) return 'No purchases this month.'
      const bySupplier = {}
      data.forEach(p => {
        const name = p.suppliers?.name || 'Unknown'
        if (!bySupplier[name]) bySupplier[name] = { qty: 0, amt: 0, count: 0 }
        bySupplier[name].qty += parseFloat(p.final_quantity) || 0
        bySupplier[name].amt += parseFloat(p.total_amount) || 0
        bySupplier[name].count++
      })
      const sorted = Object.entries(bySupplier).sort((a, b) => b[1].amt - a[1].amt)
      let result = `Supplier-wise this month:\n`
      sorted.forEach(([name, d]) => {
        result += `\n• ${name}\n  ${d.count} purchases · ${formatKg(d.qty)} · ₹${formatNum(d.amt)}`
      })
      return result
    },
  },
  {
    id: 'dispatches_today',
    label: "Today's Dispatches",
    icon: '🚛',
    category: 'dispatches',
    run: async (plantId) => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('vehicle_dispatches')
        .select('truck_number, customers(name), dispatch_pellets(quantity_mt, pellet_type_name)')
        .eq('plant_id', plantId)
        .eq('date', today)
        .eq('is_deleted', false)
      if (!data || data.length === 0) return 'No dispatches today.'
      const totalMT = data.reduce((s, d) =>
        s + (d.dispatch_pellets || []).reduce((ss, p) => ss + (parseFloat(p.quantity_mt) || 0), 0), 0)
      // By pellet type
      const byType = {}
      data.forEach(d => (d.dispatch_pellets || []).forEach(p => {
        const name = p.pellet_type_name || 'Unknown'
        byType[name] = (byType[name] || 0) + (parseFloat(p.quantity_mt) || 0)
      }))
      let result = `${data.length} truck${data.length > 1 ? 's' : ''} dispatched today\n${totalMT.toFixed(1)} MT total`
      if (Object.keys(byType).length > 0) {
        result += '\n'
        Object.entries(byType).forEach(([name, qty]) => {
          result += `\n• ${name}: ${qty.toFixed(1)} MT`
        })
      }
      return result
    },
  },
  {
    id: 'dispatches_month',
    label: 'Monthly Dispatches',
    icon: '📈',
    category: 'dispatches',
    run: async (plantId) => {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const { data } = await supabase
        .from('vehicle_dispatches')
        .select('dispatch_pellets(quantity_mt, pellet_type_name)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .gte('date', monthStart)
      if (!data || data.length === 0) return 'No dispatches this month.'
      const totalMT = data.reduce((s, d) =>
        s + (d.dispatch_pellets || []).reduce((ss, p) => ss + (parseFloat(p.quantity_mt) || 0), 0), 0)
      const byType = {}
      data.forEach(d => (d.dispatch_pellets || []).forEach(p => {
        const name = p.pellet_type_name || 'Unknown'
        byType[name] = (byType[name] || 0) + (parseFloat(p.quantity_mt) || 0)
      }))
      let result = `${data.length} trucks this month\n${totalMT.toFixed(1)} MT total dispatched`
      Object.entries(byType).forEach(([name, qty]) => {
        result += `\n• ${name}: ${qty.toFixed(1)} MT`
      })
      return result
    },
  },
  {
    id: 'production_today',
    label: "Today's Production",
    icon: '⚙️',
    category: 'production',
    run: async (plantId) => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('shift_reports')
        .select('shift, pellet_production_mt, machine_production(machines(name), production_mt, hours_run)')
        .eq('plant_id', plantId)
        .eq('date', today)
        .eq('is_deleted', false)
      if (!data || data.length === 0) return 'No shift reports submitted today.'
      const totalMT = data.reduce((s, r) => s + (parseFloat(r.pellet_production_mt) || 0), 0)
      let result = `${data.length} shift report${data.length > 1 ? 's' : ''} today\n${totalMT.toFixed(1)} MT total production`
      data.forEach(r => {
        result += `\n\nShift ${r.shift}: ${parseFloat(r.pellet_production_mt || 0).toFixed(1)} MT`
        ;(r.machine_production || []).forEach(mp => {
          result += `\n• ${mp.machines?.name || 'Machine'}: ${parseFloat(mp.production_mt || 0).toFixed(1)} MT (${parseFloat(mp.hours_run || 0).toFixed(1)}h)`
        })
      })
      return result
    },
  },
  {
    id: 'diesel_stock',
    label: 'Diesel Stock',
    icon: '⛽',
    category: 'production',
    run: async (plantId) => {
      const { data: report } = await supabase
        .from('shift_reports')
        .select('date, shift, diesel_stock(opening_litres, purchased_litres, used_litres, closing_litres)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!report || !report.diesel_stock) return 'No diesel data available yet.'
      const ds = Array.isArray(report.diesel_stock) ? report.diesel_stock[0] : report.diesel_stock
      if (!ds) return 'No diesel data available yet.'
      return `Diesel Stock (as of Shift ${report.shift}, ${formatDate(report.date)}):\n\nOpening: ${ds.opening_litres || 0} L\nPurchased: +${ds.purchased_litres || 0} L\nUsed: -${ds.used_litres || 0} L\nClosing: ${ds.closing_litres || 0} L`
    },
  },
  {
    id: 'pellet_stock',
    label: 'Pellet Stock',
    icon: '📦',
    category: 'production',
    run: async (plantId) => {
      const { data: report } = await supabase
        .from('shift_reports')
        .select('date, shift, pellet_stock(pellet_types(name), opening_mt, production_mt, dispatch_mt, wastage_mt, closing_mt)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!report || !report.pellet_stock?.length) return 'No pellet stock data available yet.'
      let result = `Pellet Stock (as of Shift ${report.shift}, ${formatDate(report.date)}):`
      report.pellet_stock.forEach(ps => {
        result += `\n\n${ps.pellet_types?.name || 'Unknown'}:`
        result += `\n  Opening: ${parseFloat(ps.opening_mt || 0).toFixed(1)} MT`
        result += `\n  Closing: ${parseFloat(ps.closing_mt || 0).toFixed(1)} MT`
      })
      return result
    },
  },
  {
    id: 'raw_material_stock',
    label: 'RM Stock',
    icon: '🪵',
    category: 'production',
    run: async (plantId) => {
      const { data: report } = await supabase
        .from('shift_reports')
        .select('date, shift, raw_material_usage(raw_material_types(name), opening_kg, purchased_kg, quantity_kg, closing_kg)')
        .eq('plant_id', plantId)
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!report || !report.raw_material_usage?.length) return 'No raw material stock data available yet.'
      let result = `Raw Material Stock (as of Shift ${report.shift}, ${formatDate(report.date)}):`
      report.raw_material_usage.forEach(rm => {
        result += `\n\n${rm.raw_material_types?.name || 'Unknown'}:`
        result += `\n  Closing: ${formatKg(parseFloat(rm.closing_kg || 0))}`
      })
      return result
    },
  },
]

function formatNum(n) {
  return Math.round(n).toLocaleString('en-IN')
}

function formatKg(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} MT`
  return `${Math.round(kg)} kg`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function DataInsights() {
  const { plant } = useAuth()
  const [activeQuery, setActiveQuery] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function runQuery(query) {
    if (!plant?.id) return
    setActiveQuery(query.id)
    setResult(null)
    setLoading(true)
    try {
      const answer = await query.run(plant.id)
      setResult(answer)
    } catch (err) {
      console.error('Query error:', err)
      setResult('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const categories = [
    { key: 'purchases', label: 'Purchases', color: '#2d6a4f' },
    { key: 'dispatches', label: 'Dispatches', color: '#d4a373' },
    { key: 'production', label: 'Production & Stock', color: '#595c4a' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#fefae0', paddingBottom: 80 }}>
      <PageHeader title="Data Insights" subtitle="Quick answers about your plant" backTo="/" />

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Result Card */}
        {(loading || result) && (
          <div style={{
            background: '#fff', borderRadius: 14, border: '1.5px solid #2d6a4f',
            padding: 20, minHeight: 80,
          }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 0' }}>
                <Loader2 size={20} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 14, color: '#595c4a' }}>Fetching data...</span>
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, color: '#2c2c2c', fontWeight: 500 }}>
                {result}
              </div>
            )}
          </div>
        )}

        {/* Query Buttons by Category */}
        {categories.map(cat => (
          <div key={cat.key}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1, color: cat.color,
              textTransform: 'uppercase', marginBottom: 10,
            }}>
              {cat.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {QUERIES.filter(q => q.category === cat.key).map(query => (
                <button
                  key={query.id}
                  onClick={() => runQuery(query)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 14px', borderRadius: 14,
                    background: activeQuery === query.id ? '#e8f0ec' : '#fff',
                    border: activeQuery === query.id ? '1.5px solid #2d6a4f' : '1.5px solid #e5ddd0',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{query.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2c', lineHeight: 1.3 }}>
                    {query.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
