import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getLocalDate } from '../../lib/dateUtils'
import { ExternalLink } from 'lucide-react'

const RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', days: 90 },
  { label: 'All time', days: null },
]

const PAYMENT_STYLE = {
  paid:    { bg: '#dcfce7', color: '#15803d', label: 'Paid' },
  unpaid:  { bg: '#fee2e2', color: '#b91c1c', label: 'Unpaid' },
  partial: { bg: '#fef3c7', color: '#92400e', label: 'Partial' },
}

export default function PurchasesTable() {
  const { plant } = useAuth()
  const [rangeIdx, setRangeIdx] = useState(1)

  const fromDate = RANGES[rangeIdx].days
    ? getLocalDate(new Date(Date.now() - (RANGES[rangeIdx].days - 1) * 86400000)) + 'T00:00:00'
    : null

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['adminPurchases', plant?.id, rangeIdx],
    queryFn: async () => {
      let q = supabase
        .from('raw_material_purchases')
        .select('id, purchase_datetime, quantity_kg, rate_per_kg, total_rm_amount, payment_status, suppliers(name), raw_material_types(name)')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .order('purchase_datetime', { ascending: false })
      if (fromDate) q = q.gte('purchase_datetime', fromDate)
      const { data, error } = await q.limit(500)
      if (error) throw error
      return data || []
    },
    enabled: !!plant?.id,
    staleTime: 5 * 60 * 1000,
  })

  const totalQty = purchases.reduce((s, p) => s + (parseFloat(p.quantity_kg) || 0), 0)
  const totalAmt = purchases.reduce((s, p) => s + (parseFloat(p.total_rm_amount) || 0), 0)

  const fmt = n => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n.toFixed(0)}`

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2c2c2c', margin: 0, letterSpacing: -0.5 }}>Purchases</h1>
          <p style={{ fontSize: 13, color: '#8a8d7a', margin: '4px 0 0' }}>
            {purchases.length} records · {(totalQty / 1000).toFixed(2)} T · {fmt(totalAmt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGES.map((r, i) => (
            <button key={i} onClick={() => setRangeIdx(i)} style={{
              padding: '7px 14px', borderRadius: 8, border: '1.5px solid',
              borderColor: rangeIdx === i ? '#2d6a4f' : '#e5ddd0',
              background: rangeIdx === i ? '#2d6a4f' : '#fff',
              color: rangeIdx === i ? '#fff' : '#595c4a',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafaf5', borderBottom: '1.5px solid #e5ddd0' }}>
                {['Date & Time', 'Supplier', 'Material', 'Qty (kg)', 'Rate (₹/kg)', 'Total', 'Payment', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#8a8d7a' }}>Loading...</td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#8a8d7a' }}>No purchases in this range</td></tr>
              ) : purchases.map(p => {
                const dt = p.purchase_datetime ? new Date(p.purchase_datetime) : null
                const dateStr = dt ? `${dt.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]}` : '—'
                const timeStr = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                const ps = PAYMENT_STYLE[p.payment_status] || { bg: '#f3f4f6', color: '#6b7280', label: p.payment_status || '—' }
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f0ebe0' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafaf5'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: '#2c2c2c' }}>{dateStr}</div>
                      <div style={{ fontSize: 11, color: '#8a8d7a' }}>{timeStr}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#2c2c2c', fontWeight: 500 }}>{p.suppliers?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#595c4a' }}>{p.raw_material_types?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2c2c2c' }}>
                      {parseFloat(p.quantity_kg || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#595c4a' }}>
                      {p.rate_per_kg ? `₹${parseFloat(p.rate_per_kg).toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2c2c2c' }}>
                      {p.total_rm_amount ? fmt(parseFloat(p.total_rm_amount)) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, background: ps.bg, color: ps.color, fontSize: 11, fontWeight: 700 }}>
                        {ps.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => window.open(`/purchase/${p.id}`, '_blank')}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#f0f9f4', color: '#2d6a4f', border: '1px solid #b8d4c4', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                      >
                        <ExternalLink size={12} /> View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
