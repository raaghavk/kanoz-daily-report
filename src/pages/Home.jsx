import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { ChevronRight, Plus, Truck, Package } from 'lucide-react'

export default function Home() {
  const { employee, plant } = useAuth()
  const navigate = useNavigate()
  const [showProductionModal, setShowProductionModal] = useState(false)
  const [showTrucksModal, setShowTrucksModal] = useState(false)
  const [showIssuesModal, setShowIssuesModal] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const currentShift = new Date().getHours() < 18 ? 'A' : 'B'
  const shiftTime = currentShift === 'A' ? '06:00–18:00' : '18:00–06:00'

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', plant?.id, today],
    queryFn: async () => {
      const [reportsRes, dispatchesRes, lastReportRes] = await Promise.all([
        supabase
          .from('shift_reports')
          .select('*, machine_production(*), issues(*)')
          .eq('plant_id', plant.id)
          .eq('date', today),
        supabase
          .from('vehicle_dispatches')
          .select('*')
          .eq('plant_id', plant.id)
          .eq('date', today),
        supabase
          .from('shift_reports')
          .select('handover_notes, shift, date')
          .eq('plant_id', plant.id)
          .order('date', { ascending: false })
          .order('shift', { ascending: false })
          .limit(1)
          .single(),
      ])

      const reports = reportsRes.data || []
      const totalProd = reports.reduce((sum, r) => sum + (parseFloat(r.pellet_production_mt) || 0), 0)
      const totalIssues = reports.reduce((sum, r) => sum + (r.issues?.length || 0), 0)
      const handover = lastReportRes.data?.handover_notes ? lastReportRes.data : null

      return {
        stats: { production: totalProd, trucks: dispatchesRes.data?.length || 0, issues: totalIssues },
        todayReports: reports,
        handoverNotes: handover,
      }
    },
    enabled: !!plant?.id,
  })

  const stats = dashboardData?.stats || { production: 0, trucks: 0, issues: 0 }
  const todayReports = dashboardData?.todayReports || []
  const handoverNotes = dashboardData?.handoverNotes || null

  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Dark App Bar */}
      <div style={{ flexShrink: 0, background: '#1b4332', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: 'linear-gradient(135deg, #2d6a4f, #1b4332)',
                boxShadow: '0 2px 8px rgba(45,106,79,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg viewBox="0 0 48 48" width="18" height="18">
                  <path fill="white" d="M24 4C16 4 8 12 8 24c0 8 4 14 8 17 1-4 3-8 8-12 5 4 7 8 8 12 4-3 8-9 8-17C40 12 32 4 24 4zm0 8c3 0 6 4 6 10s-3 10-6 10-6-4-6-10 3-10 6-10z"/>
                  <circle cx="24" cy="22" r="3" fill="white"/>
                </svg>
              </div>
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Kanoz Report</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                  {plant?.name || 'Plant'} &bull; Shift {currentShift} &bull; {dateStr}
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/settings')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(255,255,255,0.15)',
                fontSize: 14, fontWeight: 700, color: 'white',
                cursor: 'pointer'
              }}
            >
              {employee?.name?.charAt(0) || 'U'}
            </button>
          </div>
          {/* Shift time bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 10, padding: '8px 12px'
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: currentShift === 'A' ? '#40916c' : '#e9c46a',
              boxShadow: currentShift === 'A' ? '0 0 6px #40916c' : '0 0 6px #e9c46a'
            }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              Shift {currentShift} &bull; {shiftTime}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
        {/* Handover Notes */}
        {handoverNotes && (
          <div style={{
            background: '#fefae0', border: '1.5px solid #e9c46a',
            borderRadius: 14, padding: '14px 16px', marginBottom: 16
          }}>
            <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: '#d4a373', textTransform: 'uppercase', marginBottom: 4 }}>
              Shift {handoverNotes.shift === 'A' ? 'B' : 'A'} Handover
            </h4>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: '#595c4a' }}>
              {handoverNotes.handover_notes}
            </p>
          </div>
        )}

        {/* Stat Cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => setShowProductionModal(true)}
            style={{
              flex: 1, textAlign: 'center',
              background: '#fff', border: '1.5px solid #e5ddd0',
              borderRadius: 14, padding: '16px 8px',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: '#2d6a4f', lineHeight: 1 }}>
              {stats.production.toFixed(1)}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 6 }}>
              Production MT
            </div>
          </button>
          <button
            onClick={() => setShowTrucksModal(true)}
            style={{
              flex: 1, textAlign: 'center',
              background: '#fff', border: '1.5px solid #e5ddd0',
              borderRadius: 14, padding: '16px 8px',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: '#d4a373', lineHeight: 1 }}>
              {stats.trucks}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 6 }}>
              Trucks Out
            </div>
          </button>
          <button
            onClick={() => setShowIssuesModal(true)}
            style={{
              flex: 1, textAlign: 'center',
              background: '#fff', border: '1.5px solid #e5ddd0',
              borderRadius: 14, padding: '16px 8px',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: '#d32f2f', lineHeight: 1 }}>
              {stats.issues}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 6 }}>
              Issues
            </div>
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => navigate('/shift/new')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '15px 0', borderRadius: 14,
              background: '#2d6a4f', color: 'white',
              fontSize: 15, fontWeight: 600,
              boxShadow: '0 4px 14px rgba(45,106,79,0.25)',
              border: 'none', cursor: 'pointer'
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            New Shift Report
          </button>
          <button
            onClick={() => navigate('/dispatch')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 0', borderRadius: 14,
              background: '#e8f0ec', color: '#2d6a4f',
              fontSize: 14, fontWeight: 600,
              border: '1.5px solid #b8d4c4',
              cursor: 'pointer'
            }}
          >
            <Truck size={16} strokeWidth={2} />
            Quick Vehicle Dispatch
          </button>
          <button
            onClick={() => navigate('/purchase/new')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 0', borderRadius: 14,
              background: '#fff', color: '#2c2c2c',
              fontSize: 14, fontWeight: 600,
              border: '1.5px solid #e5ddd0',
              cursor: 'pointer'
            }}
          >
            <Package size={16} strokeWidth={2} />
            Raw Material Purchase
          </button>
        </div>

        {/* Recent Reports */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a8d7a', textTransform: 'uppercase', marginBottom: 12 }}>
            Recent Reports
          </div>

          {todayReports.length > 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
              {todayReports.map((report, idx) => (
                <button
                  key={report.id}
                  onClick={() => navigate(`/reports/${report.id}`)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    padding: '14px 16px',
                    borderBottom: idx < todayReports.length - 1 ? '1px solid #f0ebe0' : 'none',
                    background: 'transparent', border: 'none', cursor: 'pointer'
                  }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    width: 44, height: 44, borderRadius: 12, background: '#e8f0ec', fontSize: 20
                  }}>
                    📊
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2c' }}>
                      Shift {report.shift} — {report.date}
                    </div>
                    <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 2 }}>
                      {report.pellet_production_mt || 0} MT &bull; {report.start_time?.slice(0,5)}–{report.end_time?.slice(0,5)}
                    </div>
                  </div>
                  <ChevronRight size={18} color="#b5b8a8" />
                </button>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              background: '#fff', borderRadius: 14,
              border: '1.5px solid #e5ddd0', padding: '32px 20px'
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#595c4a', marginBottom: 4 }}>No reports yet today</p>
              <p style={{ fontSize: 12, color: '#8a8d7a', marginBottom: 16 }}>Start a shift report to track production</p>
              <button
                onClick={() => navigate('/shift/new')}
                style={{
                  padding: '10px 24px', borderRadius: 10,
                  background: '#2d6a4f', color: 'white',
                  fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer'
                }}
              >
                Start Shift Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Production Modal */}
      <Modal isOpen={showProductionModal} onClose={() => setShowProductionModal(false)} title="Production Breakdown">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#2d6a4f' }}>{stats.production.toFixed(1)} MT</div>
          <div style={{ fontSize: 12, marginTop: 4, color: '#8a8d7a' }}>Total production today</div>
        </div>
        <p style={{ fontSize: 14, textAlign: 'center', color: '#595c4a' }}>Machine-wise breakdown will appear once reports are submitted.</p>
        <button onClick={() => setShowProductionModal(false)} style={{ width: '100%', marginTop: 16, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, background: '#fefae0', border: '1px solid #e5ddd0', cursor: 'pointer' }}>Close</button>
      </Modal>

      {/* Trucks Modal */}
      <Modal isOpen={showTrucksModal} onClose={() => setShowTrucksModal(false)} title="Today's Dispatches">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#d4a373' }}>{stats.trucks}</div>
          <div style={{ fontSize: 12, marginTop: 4, color: '#8a8d7a' }}>Trucks dispatched today</div>
        </div>
        <button onClick={() => { setShowTrucksModal(false); navigate('/dispatch') }} style={{ width: '100%', marginTop: 16, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, color: 'white', background: '#2d6a4f', border: 'none', cursor: 'pointer' }}>View All Dispatches</button>
      </Modal>

      {/* Issues Modal */}
      <Modal isOpen={showIssuesModal} onClose={() => setShowIssuesModal(false)} title="Issues Reported">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#d32f2f' }}>{stats.issues}</div>
          <div style={{ fontSize: 12, marginTop: 4, color: '#8a8d7a' }}>Issues reported today</div>
        </div>
        <button onClick={() => setShowIssuesModal(false)} style={{ width: '100%', marginTop: 16, padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 500, background: '#fefae0', border: '1px solid #e5ddd0', cursor: 'pointer' }}>Close</button>
      </Modal>
    </div>
  )
}
