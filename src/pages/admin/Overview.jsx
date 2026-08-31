import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getLocalDate, getLocalDateDaysAgo, localDateOffset } from '../../lib/dateUtils'
import { TrendingUp, Package, Truck, AlertTriangle } from 'lucide-react'

function BarChart({ data, color }) {
  if (!data || !data.length) return (
    <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a8d7a', fontSize: 12 }}>No data</div>
  )
  const max = Math.max(...data.map(d => d.value), 0.001)
  const H = 80
  const barW = 22
  const gap = 5
  const totalW = data.length * (barW + gap)
  return (
    <svg viewBox={`0 0 ${totalW} ${H + 22}`} style={{ width: '100%', height: H + 22 }}>
      {data.map((d, i) => {
        const h = (d.value / max) * H
        const x = i * (barW + gap)
        const displayVal = d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'k' : d.value % 1 === 0 ? d.value : d.value.toFixed(1)
        return (
          <g key={i}>
            <rect x={x} y={H - h} width={barW} height={Math.max(h, 2)} fill={color} rx={3} opacity={h > 0 ? 1 : 0.2} />
            {h > 10 && (
              <text x={x + barW / 2} y={H - h - 3} textAnchor="middle" fontSize="7.5" fill={color} fontWeight="700">{displayVal}</text>
            )}
            <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="7.5" fill="#8a8d7a">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1.5px solid #e5ddd0', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#2c2c2c', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function Overview() {
  const { plant } = useAuth()

  const today = getLocalDate()
  const thirtyDaysAgo = getLocalDateDaysAgo(29)
  const fourteenDaysAgo = getLocalDateDaysAgo(13)

  // Shift reports last 30 days
  const { data: reportsData } = useQuery({
    queryKey: ['adminOverviewReports', plant?.id],
    queryFn: async () => {
      const { data } = await supabase.from('shift_reports')
        .select('date, pellet_production_mt')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .gte('date', thirtyDaysAgo)
        .lte('date', today)
        .order('date')
      return data || []
    },
    enabled: !!plant?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Purchases last 30 days
  const { data: purchasesData } = useQuery({
    queryKey: ['adminOverviewPurchases', plant?.id],
    queryFn: async () => {
      const { data } = await supabase.from('raw_material_purchases')
        .select('purchase_datetime, quantity_kg')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .gte('purchase_datetime', thirtyDaysAgo + 'T00:00:00')
        .order('purchase_datetime')
      return data || []
    },
    enabled: !!plant?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Dispatches last 30 days
  const { data: dispatchesData } = useQuery({
    queryKey: ['adminOverviewDispatches', plant?.id],
    queryFn: async () => {
      const { data } = await supabase.from('vehicle_dispatches')
        .select('dispatch_date')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .gte('dispatch_date', thirtyDaysAgo)
        .lte('dispatch_date', today)
        .order('dispatch_date')
      return data || []
    },
    enabled: !!plant?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Pending delete requests
  const { data: pendingCount } = useQuery({
    queryKey: ['adminPendingRequests', plant?.org_id],
    queryFn: async () => {
      const { count } = await supabase.from('delete_requests')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', plant.org_id)
        .eq('status', 'pending')
      return count || 0
    },
    enabled: !!plant?.org_id,
    staleTime: 2 * 60 * 1000,
  })

  // KPI aggregates
  const totalProduction = (reportsData || []).reduce((s, r) => s + (parseFloat(r.pellet_production_mt) || 0), 0)
  const totalPurchasesKg = (purchasesData || []).reduce((s, p) => s + (parseFloat(p.quantity_kg) || 0), 0)
  const totalDispatches = (dispatchesData || []).length

  // Build last 14 days chart arrays
  function buildDailyMap(days) {
    const labels = []
    const map = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = localDateOffset(-i)
      const key = getLocalDate(d)
      const label = `${d.getDate()}/${d.getMonth() + 1}`
      labels.push({ key, label })
      map[key] = 0
    }
    return { labels, map }
  }

  const { labels: prodLabels, map: prodMap } = buildDailyMap(14)
  ;(reportsData || []).filter(r => r.date >= fourteenDaysAgo).forEach(r => {
    if (prodMap[r.date] !== undefined) prodMap[r.date] += parseFloat(r.pellet_production_mt) || 0
  })
  const prodChart = prodLabels.map(l => ({ label: l.label, value: prodMap[l.key] }))

  const { labels: purchLabels, map: purchMap } = buildDailyMap(14)
  ;(purchasesData || []).forEach(p => {
    const dateKey = p.purchase_datetime ? p.purchase_datetime.split('T')[0] : null
    if (dateKey && purchMap[dateKey] !== undefined) purchMap[dateKey] += (parseFloat(p.quantity_kg) || 0) / 1000
  })
  const purchChart = purchLabels.map(l => ({ label: l.label, value: purchMap[l.key] }))

  const { labels: dispLabels, map: dispMap } = buildDailyMap(14)
  ;(dispatchesData || []).filter(d => d.dispatch_date >= fourteenDaysAgo).forEach(d => {
    if (dispMap[d.dispatch_date] !== undefined) dispMap[d.dispatch_date] += 1
  })
  const dispChart = dispLabels.map(l => ({ label: l.label, value: dispMap[l.key] }))

  const fmtMT = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k MT' : v.toFixed(1) + ' MT'
  const fmtT = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k T' : v.toFixed(1) + ' T'

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2c2c2c', margin: 0, letterSpacing: -0.5 }}>Overview</h1>
        <p style={{ fontSize: 13, color: '#8a8d7a', margin: '4px 0 0' }}>Last 30 days · {plant?.name}</p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KpiCard icon={TrendingUp} label="Production" value={fmtMT(totalProduction)} sub="last 30 days" color="#2d6a4f" />
        <KpiCard icon={Package} label="Purchases" value={fmtT(totalPurchasesKg / 1000)} sub="last 30 days" color="#d4a373" />
        <KpiCard icon={Truck} label="Dispatches" value={totalDispatches} sub="last 30 days" color="#4e8cb8" />
        <KpiCard
          icon={AlertTriangle}
          label="Pending Requests"
          value={pendingCount ?? '—'}
          sub={pendingCount > 0 ? 'require review' : 'all clear'}
          color={pendingCount > 0 ? '#d97706' : '#8a8d7a'}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1.5px solid #e5ddd0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', marginBottom: 4 }}>Daily Production (MT)</div>
          <div style={{ fontSize: 11, color: '#8a8d7a', marginBottom: 16 }}>Last 14 days</div>
          <BarChart data={prodChart} color="#2d6a4f" />
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1.5px solid #e5ddd0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', marginBottom: 4 }}>Daily Purchases (T)</div>
          <div style={{ fontSize: 11, color: '#8a8d7a', marginBottom: 16 }}>Last 14 days</div>
          <BarChart data={purchChart} color="#d4a373" />
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1.5px solid #e5ddd0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', marginBottom: 4 }}>Daily Dispatches</div>
          <div style={{ fontSize: 11, color: '#8a8d7a', marginBottom: 16 }}>Last 14 days</div>
          <BarChart data={dispChart} color="#4e8cb8" />
        </div>
      </div>
    </div>
  )
}
