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

const SHIFT_COLORS = { A: { bg: '#dcfce7', color: '#15803d' }, B: { bg: '#dbeafe', color: '#1d4ed8' } }

export default function ReportsTable() {
  const { plant } = useAuth()
  const [rangeIdx, setRangeIdx] = useState(1)

  const fromDate = RANGES[rangeIdx].days
    ? getLocalDate(new Date(Date.now() - (RANGES[rangeIdx].days - 1) * 86400000))
    : null

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['adminReports', plant?.id, rangeIdx],
    queryFn: async () => {
      let q = supabase
        .from('shift_reports')
        .select('id, date, shift, pellet_production_mt, start_time, end_time, remarks, employees!supervisor_id(name)')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })
      if (fromDate) q = q.gte('date', fromDate)
      const { data, error } = await q.limit(500)
      if (error) throw error
      return data || []
    },
    enabled: !!plant?.id,
    staleTime: 5 * 60 * 1000,
  })

  const totalProd = reports.reduce((s, r) => s + (parseFloat(r.pellet_production_mt) || 0), 0)

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2c2c2c', margin: 0, letterSpacing: -0.5 }}>Shift Reports</h1>
          <p style={{ fontSize: 13, color: '#8a8d7a', margin: '4px 0 0' }}>
            {reports.length} records · {totalProd.toFixed(1)} MT total production
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

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafaf5', borderBottom: '1.5px solid #e5ddd0' }}>
                {['Date', 'Shift', 'Production (MT)', 'Time', 'Supervisor', 'Remarks', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8a8d7a', fontSize: 13 }}>Loading...</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8a8d7a', fontSize: 13 }}>No reports in this range</td></tr>
              ) : reports.map(r => {
                const s = SHIFT_COLORS[r.shift] || { bg: '#f3f4f6', color: '#374151' }
                const d = new Date(r.date + 'T00:00:00')
                const dateStr = `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`
                const time = r.start_time && r.end_time ? `${r.start_time.slice(0,5)} – ${r.end_time.slice(0,5)}` : '—'
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f0ebe0', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafaf5'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#2c2c2c', whiteSpace: 'nowrap' }}>{dateStr}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
                        Shift {r.shift}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2d6a4f' }}>
                      {parseFloat(r.pellet_production_mt) > 0 ? parseFloat(r.pellet_production_mt).toFixed(2) : <span style={{ color: '#d97706' }}>0.00</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#595c4a', whiteSpace: 'nowrap' }}>{time}</td>
                    <td style={{ padding: '12px 16px', color: '#595c4a' }}>{r.employees?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#595c4a', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.remarks || <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => window.open(`/reports/${r.id}`, '_blank')}
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
