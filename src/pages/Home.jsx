import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

export default function Home() {
  const { employee, plant } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ production: 0, trucks: 0, issues: 0 })
  const [showProductionModal, setShowProductionModal] = useState(false)
  const [showTrucksModal, setShowTrucksModal] = useState(false)
  const [showIssuesModal, setShowIssuesModal] = useState(false)
  const [todayReports, setTodayReports] = useState([])
  const [handoverNotes, setHandoverNotes] = useState(null)

  const today = new Date().toISOString().split('T')[0]
  const currentShift = new Date().getHours() < 18 ? 'A' : 'B'
  const shiftTime = currentShift === 'A' ? '06:00–18:00' : '18:00–06:00'

  useEffect(() => {
    if (plant?.id) fetchDashboardData()
  }, [plant])

  async function fetchDashboardData() {
    try {
      const { data: reports } = await supabase
        .from('shift_reports')
        .select('*, machine_production(*), issues(*)')
        .eq('plant_id', plant.id)
        .eq('date', today)

      if (reports?.length) {
        const totalProd = reports.reduce((sum, r) => sum + (parseFloat(r.pellet_production_mt) || 0), 0)
        const totalIssues = reports.reduce((sum, r) => sum + (r.issues?.length || 0), 0)
        setStats(prev => ({ ...prev, production: totalProd, issues: totalIssues }))
        setTodayReports(reports)
      }

      const { data: dispatches } = await supabase
        .from('vehicle_dispatches')
        .select('*, shift_reports!inner(*)')
        .eq('shift_reports.plant_id', plant.id)
        .eq('shift_reports.date', today)

      if (dispatches) {
        setStats(prev => ({ ...prev, trucks: dispatches.length }))
      }

      const { data: lastReport } = await supabase
        .from('shift_reports')
        .select('handover_notes, shift, date')
        .eq('plant_id', plant.id)
        .order('date', { ascending: false })
        .order('shift', { ascending: false })
        .limit(1)
        .single()

      if (lastReport?.handover_notes) {
        setHandoverNotes(lastReport)
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    }
  }

  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="flex flex-col min-h-full">
      {/* Dark App Bar */}
      <div className="flex-shrink-0 pt-[env(safe-area-inset-top)]" style={{ background: '#0F2418' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #1B7A45, #145C34)' }}>
                <svg viewBox="0 0 48 48" width="18" height="18">
                  <path fill="white" d="M24 4C16 4 8 12 8 24c0 8 4 14 8 17 1-4 3-8 8-12 5 4 7 8 8 12 4-3 8-9 8-17C40 12 32 4 24 4zm0 8c3 0 6 4 6 10s-3 10-6 10-6-4-6-10 3-10 6-10z"/>
                  <circle cx="24" cy="22" r="3" fill="white"/>
                </svg>
              </div>
              <span className="text-white font-bold text-[17px]">Kanoz Report</span>
            </div>
            <div className="text-white/50 text-[11px] mt-0.5 ml-10">
              {plant?.name || 'Plant'} &bull; Shift {currentShift} &bull; {dateStr}, {shiftTime}
            </div>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.2)' }}
          >
            {employee?.name?.charAt(0) || 'U'}
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* Handover Notes */}
        {handoverNotes && (
          <div className="rounded-xl p-3.5 mb-3.5" style={{ background: '#FFF8E6', border: '1px solid #F0D98C' }}>
            <h4 className="text-[12px] font-bold uppercase tracking-[0.5px] mb-1" style={{ color: '#D4960A' }}>
              Shift {handoverNotes.shift === 'A' ? 'B' : 'A'} Handover
            </h4>
            <p className="text-[13px] leading-relaxed" style={{ color: '#5A6B62' }}>
              {handoverNotes.handover_notes}
            </p>
          </div>
        )}

        {/* Stat Cards */}
        <div className="flex gap-2 mb-3.5">
          <button
            onClick={() => setShowProductionModal(true)}
            className="flex-1 rounded-xl p-3 text-center transition-all"
            style={{ background: '#fff', border: '1px solid #E2E8E4' }}
          >
            <div className="text-[26px] font-extrabold" style={{ color: '#1B7A45' }}>
              {stats.production.toFixed(1)}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3px] mt-0.5" style={{ color: '#8A9B92' }}>
              Production MT
            </div>
          </button>
          <button
            onClick={() => setShowTrucksModal(true)}
            className="flex-1 rounded-xl p-3 text-center transition-all"
            style={{ background: '#fff', border: '1px solid #E2E8E4' }}
          >
            <div className="text-[26px] font-extrabold" style={{ color: '#D4960A' }}>
              {stats.trucks}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3px] mt-0.5" style={{ color: '#8A9B92' }}>
              Trucks Out
            </div>
          </button>
          <button
            onClick={() => setShowIssuesModal(true)}
            className="flex-1 rounded-xl p-3 text-center transition-all"
            style={{ background: '#fff', border: '1px solid #E2E8E4' }}
          >
            <div className="text-[26px] font-extrabold" style={{ color: '#E53E3E' }}>
              {stats.issues}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3px] mt-0.5" style={{ color: '#8A9B92' }}>
              Issues
            </div>
          </button>
        </div>

        {/* Action Buttons */}
        <button
          onClick={() => navigate('/shift/new')}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white text-[16px] font-semibold mb-2 active:scale-[0.98] transition-transform"
          style={{ background: '#1B7A45' }}
        >
          + New Shift Report
        </button>
        <button
          onClick={() => navigate('/dispatch/new')}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-semibold mb-2 active:scale-[0.98] transition-transform"
          style={{ background: 'transparent', border: '2px solid #1B7A45', color: '#1B7A45' }}
        >
          Quick Vehicle Dispatch
        </button>
        <button
          onClick={() => navigate('/purchase/new')}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-semibold mb-1 active:scale-[0.98] transition-transform"
          style={{ background: '#F5F7F6', border: '1px solid #E2E8E4', color: '#1A1A2E' }}
        >
          Raw Material Purchase
        </button>

        {/* Recent Reports */}
        <div className="mt-5 mb-2">
          <div className="text-[11px] font-bold uppercase tracking-[1px] mb-2" style={{ color: '#8A9B92' }}>
            Recent Reports
          </div>

          {todayReports.length > 0 ? (
            todayReports.map(report => (
              <button
                key={report.id}
                onClick={() => navigate(`/reports/${report.id}`)}
                className="w-full flex items-center gap-3 py-3.5 transition-all"
                style={{ borderBottom: '1px solid #F0F3F1' }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: '#E8F5EE' }}>
                  📊
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-semibold" style={{ color: '#1A1A2E' }}>
                    Shift {report.shift} — {report.date}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#8A9B92' }}>
                    {report.pellet_production_mt || 0} MT &bull; {report.start_time?.slice(0,5)}–{report.end_time?.slice(0,5)}
                  </div>
                </div>
                <span className="text-[16px] flex-shrink-0" style={{ color: '#8A9B92' }}>›</span>
              </button>
            ))
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: '#fff', border: '1px solid #E2E8E4' }}>
              <div className="text-2xl mb-2">📊</div>
              <p className="text-sm" style={{ color: '#5A6B62' }}>No reports yet today</p>
              <button
                onClick={() => navigate('/shift/new')}
                className="mt-3 px-5 py-2 rounded-lg text-white text-xs font-bold"
                style={{ background: '#1B7A45' }}
              >
                Start Shift Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Production Modal */}
      <Modal isOpen={showProductionModal} onClose={() => setShowProductionModal(false)} title="Production Breakdown">
        <div className="text-center py-4">
          <div className="text-3xl font-extrabold" style={{ color: '#1B7A45' }}>{stats.production.toFixed(1)} MT</div>
          <div className="text-xs mt-1" style={{ color: '#8A9B92' }}>Total production today</div>
        </div>
        <p className="text-sm text-center" style={{ color: '#5A6B62' }}>Machine-wise breakdown will appear once reports are submitted.</p>
        <button onClick={() => setShowProductionModal(false)} className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#F5F7F6', border: '1px solid #E2E8E4' }}>Close</button>
      </Modal>

      {/* Trucks Modal */}
      <Modal isOpen={showTrucksModal} onClose={() => setShowTrucksModal(false)} title="Today's Dispatches">
        <div className="text-center py-4">
          <div className="text-3xl font-extrabold" style={{ color: '#D4960A' }}>{stats.trucks}</div>
          <div className="text-xs mt-1" style={{ color: '#8A9B92' }}>Trucks dispatched today</div>
        </div>
        <button onClick={() => { setShowTrucksModal(false); navigate('/dispatch') }} className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#1B7A45' }}>View All Dispatches</button>
      </Modal>

      {/* Issues Modal */}
      <Modal isOpen={showIssuesModal} onClose={() => setShowIssuesModal(false)} title="Issues Reported">
        <div className="text-center py-4">
          <div className="text-3xl font-extrabold" style={{ color: '#E53E3E' }}>{stats.issues}</div>
          <div className="text-xs mt-1" style={{ color: '#8A9B92' }}>Issues reported today</div>
        </div>
        <button onClick={() => setShowIssuesModal(false)} className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#F5F7F6', border: '1px solid #E2E8E4' }}>Close</button>
      </Modal>
    </div>
  )
}
