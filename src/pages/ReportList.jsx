import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'
import { FileText, ChevronRight, Calendar } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function ReportList() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('today')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (plant?.id) {
      fetchReports()
    }
  }, [plant, filter])

  async function fetchReports() {
    try {
      setLoading(true)
      let startDate = today
      let endDate = today

      const currentDate = new Date(today)

      if (filter === 'week') {
        const dayOfWeek = currentDate.getDay()
        const diff = currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(currentDate.setDate(diff))
        startDate = monday.toISOString().split('T')[0]
        endDate = today
      } else if (filter === 'month') {
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        startDate = firstDay.toISOString().split('T')[0]
        endDate = today
      }

      const { data, error } = await supabase
        .from('shift_reports')
        .select('*, employees(name)')
        .eq('plant_id', plant.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })

      if (error) throw error

      const reportsWithTotals = data?.map(r => ({
        ...r,
        total_mt: parseFloat(r.pellet_production_mt) || 0
      })) || []

      setReports(reportsWithTotals)
    } catch (err) {
      console.error('Error fetching reports:', err)
      showToast('Failed to load reports', 'error')
    } finally {
      setLoading(false)
    }
  }

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
    <div className="pb-20">
      <PageHeader title="Shift Reports" subtitle="View and manage all reports" backTo="/" />

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto" style={{ padding: '16px 20px 0' }}>
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700,
              whiteSpace: 'nowrap', transition: 'all 0.2s',
              ...(filter === tab.id
                ? { background: '#1B7A45', color: 'white' }
                : { background: '#fff', color: '#1A1A2E', border: '1.5px solid #E2E8E4' })
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <div className="text-center" style={{ padding: '32px 0' }}>
            <div style={{ fontSize: 13, color: '#8A9B92' }}>Loading reports...</div>
          </div>
        ) : reports.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map(report => (
              <button
                key={report.id}
                onClick={() => navigate(`/reports/${report.id}`)}
                className="w-full text-left"
                style={{
                  background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4',
                  padding: 16, transition: 'all 0.2s'
                }}
              >
                <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1A2E' }}>
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
                    <div className="flex items-center gap-1" style={{ fontSize: 11, color: '#8A9B92', marginBottom: 6 }}>
                      <Calendar size={12} />
                      {formatDate(report.date)}
                    </div>
                    <div style={{ fontSize: 12, color: '#5A6B62' }}>
                      Supervisor: {report.employees?.name || 'N/A'}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1B7A45' }}>
                      {report.total_mt.toFixed(1)} MT
                    </div>
                    <ChevronRight size={16} color="#C5CFC8" />
                  </div>
                </div>

                {/* Production Details */}
                <div className="flex items-center justify-between" style={{
                  paddingTop: 12, borderTop: '1px solid #F0F3F1', fontSize: 12
                }}>
                  <div>
                    <span style={{ color: '#8A9B92' }}>Time: </span>
                    <span style={{ color: '#1A1A2E', fontWeight: 500 }}>
                      {report.start_time?.slice(0, 5)} – {report.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  <div style={{ color: '#8A9B92' }}>
                    {report.status === 'submitted' ? 'Completed' : 'In Progress'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center" style={{
            background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: '32px 20px'
          }}>
            <FileText size={32} className="mx-auto" style={{ color: '#C5CFC8', marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: '#5A6B62', marginBottom: 8 }}>No reports found</p>
            <p style={{ fontSize: 12, color: '#8A9B92', marginBottom: 16 }}>
              {filter === 'today'
                ? 'No reports for today yet'
                : filter === 'week'
                ? 'No reports this week'
                : 'No reports this month'}
            </p>
            <button
              onClick={() => navigate('/shift/new')}
              style={{
                padding: '10px 20px', background: '#1B7A45', color: 'white',
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
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Summary
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div style={{ fontSize: 10, color: '#8A9B92', marginBottom: 4 }}>Total Reports</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1A2E' }}>{reports.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#8A9B92', marginBottom: 4 }}>Total Production</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1B7A45' }}>
                  {reports.reduce((sum, r) => sum + r.total_mt, 0).toFixed(1)} MT
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#8A9B92', marginBottom: 4 }}>Submitted</div>
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
