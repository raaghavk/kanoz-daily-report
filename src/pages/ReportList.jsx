import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { FileText, ChevronRight, ChevronDown, Calendar, Filter, Loader2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { showToast } from '../components/Toast'
import { getLocalDate } from '../lib/dateUtils'

export default function ReportList() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [groupedReports, setGroupedReports] = useState({})
  const [collapsedDates, setCollapsedDates] = useState({})

  // Persist filter tab in URL
  const filterTab = searchParams.get('tab') || 'month'
  function setFilterTab(tab) {
    setSearchParams({ tab }, { replace: true })
  }

  // Filter state for 'all' tab
  const [showFilters, setShowFilters] = useState(false)
  const [filterSupervisor, setFilterSupervisor] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [supervisors, setSupervisors] = useState([])

  // Load filter options (supervisors)
  useEffect(() => {
    if (plant?.id) {
      supabase.from('employees').select('id, name').eq('plant_id', plant.id).eq('is_active', true).order('name')
        .then(({ data, error }) => { if (error) console.error('Failed to load supervisors:', error); setSupervisors(data || []) })
    }
  }, [plant?.id])

  useEffect(() => {
    if (plant?.id) {
      fetchReports()
    }
  }, [plant?.id, filterTab, filterSupervisor, filterStatus, filterDateFrom, filterDateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchReports() {
    try {
      setLoading(true)
      const dateFilter = getDateFilter(filterTab)

      let query = supabase
        .from('shift_reports')
        .select('id, date, shift, status, pellet_production_mt, start_time, end_time, shift_start_date, shift_end_date, supervisor_id, employees!supervisor_id(name)')
        .eq('plant_id', plant.id)
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })

      // Apply date filter
      if (filterTab === 'all' && filterDateFrom) {
        query = query.gte('date', filterDateFrom)
      } else {
        query = query.gte('date', dateFilter.start)
      }
      if (filterTab === 'all' && filterDateTo) {
        query = query.lte('date', filterDateTo)
      } else {
        query = query.lte('date', dateFilter.end)
      }

      // Apply supervisor/status filters for 'all' tab
      if (filterTab === 'all' && filterSupervisor) {
        query = query.eq('supervisor_id', filterSupervisor)
      }
      if (filterTab === 'all' && filterStatus) {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query
      if (error) throw error

      groupReportsByDate((data || []).map(r => ({
        ...r,
        total_mt: parseFloat(r.pellet_production_mt) || 0
      })))
    } catch (err) {
      console.error('Error fetching reports:', err)
      showToast('Failed to load reports', 'error')
    } finally {
      setLoading(false)
    }
  }

  function getDateFilter(tab) {
    const today = new Date()
    const start = new Date(today)

    if (tab === 'week') {
      const dayOfWeek = today.getDay()
      start.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
      return { start: getLocalDate(start), end: getLocalDate(today) }
    } else if (tab === 'month') {
      start.setDate(1)
      return { start: getLocalDate(start), end: getLocalDate(today) }
    } else {
      // 'all' tab — wide range
      const currentYear = today.getFullYear()
      return { start: `${currentYear - 1}-01-01`, end: getLocalDate(today) }
    }
  }

  function groupReportsByDate(data) {
    const grouped = {}
    data.forEach(report => {
      const date = report.shift_start_date || report.date || ''
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(report)
    })
    setGroupedReports(grouped)

    // Collapse all dates except the most recent one
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a))
    const collapsed = {}
    sortedDates.forEach((date, idx) => {
      if (idx > 0) collapsed[date] = true
    })
    setCollapsedDates(collapsed)
  }

  function toggleDateCollapse(date) {
    setCollapsedDates(prev => ({ ...prev, [date]: !prev[date] }))
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function getDateTotal(reports) {
    return reports.reduce((sum, r) => sum + (r.total_mt || 0), 0)
  }

  function clearFilters() {
    setFilterSupervisor('')
    setFilterStatus('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const dateKeys = Object.keys(groupedReports).sort((a, b) => new Date(b) - new Date(a))
  const hasActiveFilters = filterSupervisor || filterStatus || filterDateFrom || filterDateTo

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      {/* Sticky Header + Tabs */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader title="Shift Reports" subtitle="View and manage all reports" backTo="/" />

        {/* Filter Tabs */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          background: '#fefae0', borderBottom: '1px solid #e5ddd0', padding: '10px 20px',
        }}>
          {['week', 'month', 'all'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              style={{
                padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                whiteSpace: 'nowrap', transition: 'all 0.2s', border: 'none', cursor: 'pointer',
                ...(filterTab === tab
                  ? { background: '#2d6a4f', color: 'white' }
                  : { background: 'white', color: '#2c2c2c', border: '1.5px solid #e5ddd0' })
              }}
            >
              {tab === 'week' ? 'This Week' : tab === 'month' ? 'This Month' : 'All'}
            </button>
          ))}
          {filterTab === 'all' && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                background: hasActiveFilters ? '#d4a373' : 'white',
                color: hasActiveFilters ? 'white' : '#2c2c2c',
                borderColor: hasActiveFilters ? '#d4a373' : '#e5ddd0',
              }}
            >
              <Filter size={12} /> Filters
            </button>
          )}
        </div>

        {/* Filters Panel */}
        {filterTab === 'all' && showFilters && (
          <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5ddd0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>Supervisor</label>
                <select value={filterSupervisor} onChange={e => setFilterSupervisor(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">All Supervisors</option>
                  {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">All</option>
                  <option value="submitted">Submitted</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>From</label>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ width: '100%', padding: '8px 6px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>To</label>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ width: '100%', padding: '8px 6px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ padding: '6px 12px', background: '#fefae0', border: '1px solid #e5ddd0', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#595c4a', cursor: 'pointer', alignSelf: 'flex-start' }}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <Loader2 size={32} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : dateKeys.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center' }}>
            <FileText size={32} style={{ color: '#b5b8a8', marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: '#595c4a', marginBottom: 8 }}>No reports found</p>
            <p style={{ fontSize: 12, color: '#8a8d7a', marginBottom: 16 }}>
              {filterTab === 'week' ? 'No reports this week' : filterTab === 'month' ? 'No reports this month' : 'No reports match your filters'}
            </p>
            <button
              onClick={() => navigate('/shift/new')}
              style={{
                padding: '10px 20px', background: '#2d6a4f', color: 'white',
                borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer'
              }}
            >
              Create New Report
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {dateKeys.map(date => {
              const isCollapsed = collapsedDates[date]
              const reports = groupedReports[date]
              const dateTotal = getDateTotal(reports)

              return (
                <div key={date}>
                  {/* Date Header */}
                  <button
                    onClick={() => toggleDateCollapse(date)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '0 0 10px 0', textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isCollapsed
                        ? <ChevronRight size={14} style={{ color: '#8a8d7a' }} />
                        : <ChevronDown size={14} style={{ color: '#8a8d7a' }} />
                      }
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#b5b8a8', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {formatDate(date)}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f' }}>
                      {dateTotal.toFixed(1)} MT · {reports.length} shift{reports.length > 1 ? 's' : ''}
                    </span>
                  </button>

                  {/* Reports — shown only when not collapsed */}
                  {!isCollapsed && (
                    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
                      {reports.map((report, rIdx) => (
                        <button
                          key={report.id}
                          onClick={() => navigate(`/reports/${report.id}`)}
                          style={{
                            width: '100%', textAlign: 'left', cursor: 'pointer',
                            background: 'transparent', border: 'none', padding: '12px 14px',
                            borderTop: rIdx > 0 ? '1px solid #f0ebe0' : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
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
                              <div style={{ fontSize: 12, color: '#595c4a' }}>
                                {report.employees?.name || 'N/A'}
                              </div>
                              <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 2 }}>
                                {(() => {
                                  const sd = report.shift_start_date || report.date
                                  const ed = report.shift_end_date || report.date
                                  const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''
                                  return `${fmt(sd)} ${report.start_time?.slice(0, 5)} \u2013 ${sd !== ed ? fmt(ed) + ' ' : ''}${report.end_time?.slice(0, 5)}`
                                })()}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#2d6a4f' }}>
                                {report.total_mt.toFixed(1)} MT
                              </div>
                              <ChevronRight size={14} color="#b5b8a8" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Summary Bar */}
        {dateKeys.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5ddd0', display: 'flex', gap: 12, fontSize: 11, color: '#8a8d7a', fontWeight: 500 }}>
            <span>{Object.values(groupedReports).flat().length} report{Object.values(groupedReports).flat().length > 1 ? 's' : ''}</span>
            <span>·</span>
            <span style={{ color: '#2d6a4f', fontWeight: 700 }}>{Object.values(groupedReports).flat().reduce((sum, r) => sum + (r.total_mt || 0), 0).toFixed(1)} MT production</span>
          </div>
        )}
      </div>
    </div>
  )
}