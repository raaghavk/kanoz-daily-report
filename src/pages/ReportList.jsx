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
      <div className="px-4 mt-4 flex gap-2 overflow-x-auto">
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filter === tab.id
                ? 'bg-kanoz-green text-white'
                : 'bg-kanoz-card text-kanoz-text border border-kanoz-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="px-4 mt-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-kanoz-text-secondary text-sm">Loading reports...</div>
          </div>
        ) : reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map(report => (
              <button
                key={report.id}
                onClick={() => navigate(`/reports/${report.id}`)}
                className="w-full bg-kanoz-card rounded-xl border border-kanoz-border p-4 text-left hover:border-kanoz-green transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-extrabold text-kanoz-text">
                        Shift {report.shift}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        report.status === 'submitted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {report.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-kanoz-text-tertiary mb-2">
                      <Calendar size={12} />
                      {formatDate(report.date)}
                    </div>
                    <div className="text-xs text-kanoz-text-secondary">
                      Supervisor: {report.employees?.name || 'N/A'}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="text-sm font-extrabold text-kanoz-green">
                      {report.total_mt.toFixed(1)} MT
                    </div>
                    <ChevronRight size={16} className="text-kanoz-text-tertiary group-hover:text-kanoz-green transition-colors" />
                  </div>
                </div>

                {/* Production Details */}
                <div className="pt-3 border-t border-kanoz-border flex items-center justify-between text-xs">
                  <div>
                    <span className="text-kanoz-text-tertiary">Time: </span>
                    <span className="text-kanoz-text font-medium">
                      {report.start_time?.slice(0, 5)} – {report.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  <div className="text-kanoz-text-tertiary">
                    {report.status === 'submitted' ? 'Completed' : 'In Progress'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-8 text-center">
            <FileText size={32} className="mx-auto text-kanoz-text-tertiary mb-3" />
            <p className="text-sm text-kanoz-text-secondary mb-2">No reports found</p>
            <p className="text-xs text-kanoz-text-tertiary mb-4">
              {filter === 'today'
                ? 'No reports for today yet'
                : filter === 'week'
                ? 'No reports this week'
                : 'No reports this month'}
            </p>
            <button
              onClick={() => navigate('/shift/new')}
              className="inline-block px-4 py-2 bg-kanoz-green text-white rounded-lg text-xs font-bold hover:bg-kanoz-green/90 transition-all"
            >
              Create New Report
            </button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {reports.length > 0 && (
        <div className="px-4 mt-6 pb-4">
          <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-4">
            <div className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">
              Summary
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] text-kanoz-text-tertiary mb-1">Total Reports</div>
                <div className="text-lg font-extrabold text-kanoz-text">{reports.length}</div>
              </div>
              <div>
                <div className="text-[10px] text-kanoz-text-tertiary mb-1">Total Production</div>
                <div className="text-lg font-extrabold text-kanoz-green">
                  {reports.reduce((sum, r) => sum + r.total_mt, 0).toFixed(1)} MT
                </div>
              </div>
              <div>
                <div className="text-[10px] text-kanoz-text-tertiary mb-1">Submitted</div>
                <div className="text-lg font-extrabold text-kanoz-blue">
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
