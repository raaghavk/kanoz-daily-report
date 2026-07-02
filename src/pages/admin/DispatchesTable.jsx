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

export default function DispatchesTable() {
  const { plant } = useAuth()
  const [rangeIdx, setRangeIdx] = useState(1)

  const fromDate = RANGES[rangeIdx].days
    ? getLocalDate(new Date(Date.now() - (RANGES[rangeIdx].days - 1) * 86400000))
    : null

  const { data: dispatches = [], isLoading } = useQuery({
    queryKey: ['adminDispatches', plant?.id, rangeIdx],
    queryFn: async () => {
      let q = supabase
        .from('vehicle_dispatches')
        .select(`
          id, dispatch_date, truck_number, invoice_no, driver_name,
          customers(name),
          transporters(name),
          dispatch_pellets(quantity_mt, pellet_types(name))
        `)
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .order('dispatch_date', { ascending: false })
      if (fromDate) q = q.gte('dispatch_date', fromDate)
      const { data, error } = await q.limit(500)
      if (error) throw error
      return data || []
    },
    enabled: !!plant?.id,
    staleTime: 5 * 60 * 1000,
  })

  const totalMT = dispatches.reduce((s, d) => {
    return s + (d.dispatch_pellets || []).reduce((ps, p) => ps + (parseFloat(p.quantity_mt) || 0), 0)
  }, 0)

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2c2c2c', margin: 0, letterSpacing: -0.5 }}>Dispatches</h1>
          <p style={{ fontSize: 13, color: '#8a8d7a', margin: '4px 0 0' }}>
            {dispatches.length} records · {totalMT.toFixed(2)} MT total
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
                {['Date', 'Truck #', 'Customer', 'Transporter', 'Pellets', 'Total MT', 'Invoice', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#8a8d7a' }}>Loading...</td></tr>
              ) : dispatches.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#8a8d7a' }}>No dispatches in this range</td></tr>
              ) : dispatches.map(d => {
                const dt = new Date(d.dispatch_date + 'T00:00:00')
                const dateStr = `${dt.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]} ${dt.getFullYear()}`
                const pellets = (d.dispatch_pellets || [])
                const totalMt = pellets.reduce((s, p) => s + (parseFloat(p.quantity_mt) || 0), 0)
                const pelletNames = pellets.map(p => p.pellet_types?.name).filter(Boolean).join(', ')
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f0ebe0' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafaf5'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#2c2c2c', whiteSpace: 'nowrap' }}>{dateStr}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2c2c2c', background: '#f5f0e8', padding: '3px 8px', borderRadius: 6 }}>
                        {d.truck_number || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#2c2c2c', fontWeight: 500 }}>{d.customers?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#595c4a' }}>{d.transporters?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#595c4a', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pelletNames || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2d6a4f' }}>
                      {totalMt > 0 ? totalMt.toFixed(3) : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#595c4a', fontFamily: 'monospace', fontSize: 12 }}>
                      {d.invoice_no || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => window.open(`/dispatch/${d.id}`, '_blank')}
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
