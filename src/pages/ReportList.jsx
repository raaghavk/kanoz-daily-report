import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { FileText, ChevronRight, Calendar } from 'lucide-react'
import PageHeader from '../components/PageHeader'

function getDateRange(filter, today) {
  let startDate = today
  const endDate = today

  if (filter === 'week') {
    const currentDate = new Date(today)
    const dayOfWeek = currentDate.getDay()
    const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(currentDate.setDate(diff))
    startDate = monday.toISOString().split('T')[0]
  } else if (filter === 'month') {
    const currentDate = new Date(today)
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    startDate = firstDay.toISOString().split('T')[0]
  }

  return { startDate, endDate }
}

export default function ReportList() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('today')

  const today = new Date().toISOString().split('T')[0]

  const { data: reports = [], isLoading: loading } = useQuery({
    queryKey: ['reports', plant?.id, filter, today],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange(filter, today)

      const { data, error } = await supabase
        .from('shift_reports')
        .select('*, employees(name)')
        .eq('plant_id', plant.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })

      if (error) throw error

      return (data || []).map(r => ({
        ...r,
        total_mt: parseFloat(r.pellet_production_mt) || 0
      }))
    },
    enabled: !!plant?.id,
  })

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const filterTabs = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' }
  ]

  return (
    <div style={{ paddingBottom: 80 }}>
      <PageHeader title="Shift Reports" subtitle="View and manage all reports" backTo="/" />

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 20px 0' }}>
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700,
              whiteSpace: 'nowrap', transition: 'all 0.2s',
              ...(filter === tab.id
                ? { background: '#2d6a4f', color: 'white' }
                : { background: '#fff', color: '#2c2c2c', border: '1.5px solid #e5ddd0' })
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 13, color: '#8a8d7a' }}>Loading reports...</div>
          </div>
        ) : reports.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map(report => (
              <button
                key={report.id}
                onClick={() => navigate(`/reports/${report.id}`)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0',
                  padding: 16, transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#2c2c2c' }}>
                        Shift {report.shift}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                        ...(report.status === 'submitted'
                          ? { background: '#DCFCE7', color: '#15803D' }
                          : { background: '#FEF3C7', color: '#B45309' })
                      }}>
                        {report.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8a8d7a', marginBottom: 6 }}>
                      <Calendar size={12} />
                      {formatDate(report.date)}
                    </div>
                    <div style={{ fontSize: 12, color: '#595c4a' }}>
                      Supervisor: {report.employees?.name || 'N/A'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#2d6a4f' }}>
                      {report.total_mt.toFixed(1)} MT
                    </div>
                    <ChevronRight size={16} color="#b5b8a8" />
                  </div>
                </div>

                {/* Production Details */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: 12, borderTop: '1px solid #f0ebe0', fontSize: 12
                }}>
                  <div>
                    <span style={{ color: '#8a8d7a' }}>Time: </span>
                    <span style={{ color: '#2c2c2c', fontWeight: 500 }}>
                      {report.start_time?.slice(0, 5)} – {report.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  <div style={{ color: '#8a8d7a' }}>
                    {report.status === 'submitted' ? 'Completed' : 'In Progress'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '32px 20px'
          }}>
            <FileText size={32} style={{ color: '#b5b8a8', marginBottom: 12, margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: '#595c4a', marginBottom: 8 }}>No reports found</p>
            <p style={{ fontSize: 12, color: '#8a8d7a', marginBottom: 16 }}>
              {filter === 'today'
                ? 'No reports for today yet'
                : filter === 'week'
                ? 'No reports this week'
                : 'No reports this month'}
            </p>
            <button
              onClick={() => navigate('/shift/new')}
              style={{
                padding: '10px 20px', background: '#2d6a4f', color: 'white',
                borderRadius: 12, fontSize: 13, fontWeight: 700
              }}
            >
              Create New Report
            </button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {reports.length > 0 && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Summary
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#8a8d7a', marginBottom: 4 }}>Total Reports</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#2c2c2c' }}>{reports.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#8a8d7a', marginBottom: 4 }}>Total Production</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#2d6a4f' }}>
                  {reports.reduce((sum, r) => sum + r.total_mt, 0).toFixed(1)} MT
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#8a8d7a', marginBottom: 4 }}>Submitted</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#2563EB' }}>
                  {reports.filter(r => r.status === 'submitted').length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
