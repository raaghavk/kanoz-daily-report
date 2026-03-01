import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Factory, TrendingUp, Truck, AlertTriangle, Plus, FileText, Package, ChevronRight } from 'lucide-react'
import Modal from '../components/Modal'

export default function Home() {
  const { employee, plant } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ production: 0, trucks: 0, issues: 0 })
  const [showProductionModal, setShowProductionModal] = useState(false)
  const [showTrucksModal, setShowTrucksModal] = useState(false)
  const [showIssuesModal, setShowIssuesModal] = useState(false)
  const [todayReport, setTodayReport] = useState(null)
  const [handoverNotes, setHandoverNotes] = useState(null)

  const today = new Date().toISOString().split('T')[0]
  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'

  useEffect(() => {
    if (plant?.id) fetchDashboardData()
  }, [plant])

  async function fetchDashboardData() {
    try {
      // Fetch today's shift reports
      const { data: reports } = await supabase
        .from('shift_reports')
        .select('*, machine_production(*), issues(*)')
        .eq('plant_id', plant.id)
        .eq('date', today)

      if (reports?.length) {
        const totalProd = reports.reduce((sum, r) => sum + (parseFloat(r.pellet_production_mt) || 0), 0)
        const totalIssues = reports.reduce((sum, r) => sum + (r.issues?.length || 0), 0)
        setStats(prev => ({ ...prev, production: totalProd, issues: totalIssues }))
        setTodayReport(reports[0])
      }

      // Fetch today's dispatches
      const { data: dispatches } = await supabase
        .from('vehicle_dispatches')
        .select('*, shift_reports!inner(*)')
        .eq('shift_reports.plant_id', plant.id)
        .eq('shift_reports.date', today)

      if (dispatches) {
        setStats(prev => ({ ...prev, trucks: dispatches.length }))
      }

      // Fetch handover from last shift
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

  return (
    <div className="pb-2">
      {/* Header */}
      <div className="bg-kanoz-green px-5 pt-12 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs">{greeting}</p>
            <h1 className="text-white text-lg font-extrabold">{employee?.name || 'Supervisor'}</h1>
          </div>
          <div className="text-right">
            <div className="text-white/70 text-xs">{plant?.name || 'Plant'}</div>
            <div className="text-white text-xs font-medium">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => setShowProductionModal(true)} className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
            <TrendingUp size={18} className="mx-auto text-white/80 mb-1" />
            <div className="text-white text-xl font-extrabold">{stats.production.toFixed(1)}</div>
            <div className="text-white/60 text-[10px]">Production MT</div>
          </button>
          <button onClick={() => setShowTrucksModal(true)} className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
            <Truck size={18} className="mx-auto text-white/80 mb-1" />
            <div className="text-white text-xl font-extrabold">{stats.trucks}</div>
            <div className="text-white/60 text-[10px]">Trucks Out</div>
          </button>
          <button onClick={() => setShowIssuesModal(true)} className="bg-white/15 rounded-xl p-3 text-center backdrop-blur-sm">
            <AlertTriangle size={18} className="mx-auto text-white/80 mb-1" />
            <div className="text-white text-xl font-extrabold">{stats.issues}</div>
            <div className="text-white/60 text-[10px]">Issues</div>
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 -mt-3">
        <div className="bg-kanoz-card rounded-xl shadow-sm border border-kanoz-border p-4">
          <div className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider mb-3">Quick Actions</div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/shift/new')}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-kanoz-green-light/30 hover:bg-kanoz-green-light/50 transition-colors"
            >
              <div className="w-10 h-10 bg-kanoz-green rounded-xl flex items-center justify-center">
                <Plus size={20} className="text-white" />
              </div>
              <span className="text-[11px] font-semibold text-kanoz-text">New Report</span>
            </button>
            <button
              onClick={() => navigate('/dispatch/new')}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-kanoz-accent rounded-xl flex items-center justify-center">
                <Truck size={20} className="text-white" />
              </div>
              <span className="text-[11px] font-semibold text-kanoz-text">Dispatch</span>
            </button>
            <button
              onClick={() => navigate('/purchase/new')}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-kanoz-blue rounded-xl flex items-center justify-center">
                <Package size={20} className="text-white" />
              </div>
              <span className="text-[11px] font-semibold text-kanoz-text">Purchase</span>
            </button>
          </div>
        </div>
      </div>

      {/* Handover Notes */}
      {handoverNotes && (
        <div className="px-4 mt-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} className="text-amber-600" />
              <span className="text-xs font-bold text-amber-800 uppercase">Handover from Previous Shift</span>
            </div>
            <p className="text-sm text-amber-900">{handoverNotes.handover_notes}</p>
            <div className="text-[10px] text-amber-600 mt-2">
              Shift {handoverNotes.shift} &bull; {handoverNotes.date}
            </div>
          </div>
        </div>
      )}

      {/* Recent Reports */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-kanoz-text-secondary uppercase tracking-wider">Today's Reports</span>
          <button onClick={() => navigate('/reports')} className="text-xs text-kanoz-green font-medium flex items-center gap-0.5">
            View All <ChevronRight size={12} />
          </button>
        </div>
        {todayReport ? (
          <button
            onClick={() => navigate(`/reports/${todayReport.id}`)}
            className="w-full bg-kanoz-card rounded-xl border border-kanoz-border p-4 text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm">Shift {todayReport.shift}</span>
              <span className="text-xs text-kanoz-text-tertiary">
                {todayReport.start_time?.slice(0, 5)} – {todayReport.end_time?.slice(0, 5)}
              </span>
            </div>
            <div className="text-xs text-kanoz-text-secondary">
              Production: {todayReport.pellet_production_mt || 0} MT
            </div>
          </button>
        ) : (
          <div className="bg-kanoz-card rounded-xl border border-kanoz-border p-6 text-center">
            <Factory size={28} className="mx-auto text-kanoz-text-tertiary mb-2" />
            <p className="text-sm text-kanoz-text-secondary">No reports yet today</p>
            <button
              onClick={() => navigate('/shift/new')}
              className="mt-3 px-4 py-2 bg-kanoz-green text-white text-xs font-bold rounded-lg"
            >
              Start Shift Report
            </button>
          </div>
        )}
      </div>

      {/* Production Modal */}
      <Modal isOpen={showProductionModal} onClose={() => setShowProductionModal(false)} title="Today's Production">
        <div className="text-center py-4">
          <div className="text-3xl font-extrabold text-kanoz-green">{stats.production.toFixed(1)} MT</div>
          <div className="text-xs text-kanoz-text-tertiary mt-1">Total production today</div>
        </div>
        <p className="text-sm text-kanoz-text-secondary text-center">Detailed machine-wise breakdown will appear here once reports are submitted.</p>
        <button onClick={() => setShowProductionModal(false)} className="w-full mt-4 py-2.5 bg-gray-100 rounded-xl text-sm font-medium">Close</button>
      </Modal>

      {/* Trucks Modal */}
      <Modal isOpen={showTrucksModal} onClose={() => setShowTrucksModal(false)} title="Trucks Dispatched">
        <div className="text-center py-4">
          <div className="text-3xl font-extrabold text-kanoz-accent">{stats.trucks}</div>
          <div className="text-xs text-kanoz-text-tertiary mt-1">Trucks dispatched today</div>
        </div>
        <button onClick={() => { setShowTrucksModal(false); navigate('/dispatch') }} className="w-full mt-4 py-2.5 bg-kanoz-green text-white rounded-xl text-sm font-bold">View All Dispatches</button>
      </Modal>

      {/* Issues Modal */}
      <Modal isOpen={showIssuesModal} onClose={() => setShowIssuesModal(false)} title="Issues Reported">
        <div className="text-center py-4">
          <div className="text-3xl font-extrabold text-kanoz-red">{stats.issues}</div>
          <div className="text-xs text-kanoz-text-tertiary mt-1">Issues reported today</div>
        </div>
        <button onClick={() => setShowIssuesModal(false)} className="w-full mt-4 py-2.5 bg-gray-100 rounded-xl text-sm font-medium">Close</button>
      </Modal>
    </div>
  )
}
