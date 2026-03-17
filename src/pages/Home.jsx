import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { can } from '../lib/permissions'
import Modal from '../components/Modal'
import { ChevronRight } from 'lucide-react'

export default function Home() {
  const { employee, plant } = useAuth()
  const navigate = useNavigate()
  const [showProductionModal, setShowProductionModal] = useState(false)
  const [showTrucksModal, setShowTrucksModal] = useState(false)
  const [showIssuesModal, setShowIssuesModal] = useState(false)

  const now = new Date()
  const hour = now.getHours()
  const today = now.toISOString().split('T')[0]
  // Shift A: 06:00–17:59, Shift B: 18:00–05:59 (overnight)
  const currentShift = (hour >= 6 && hour < 18) ? 'A' : 'B'
  const shiftTime = currentShift === 'A' ? '06:00–18:00' : '18:00–06:00'

  // Compute shift start/end dates
  let shiftStartDate, shiftEndDate
  if (currentShift === 'A') {
    shiftStartDate = today
    shiftEndDate = today
  } else {
    if (hour >= 18) {
      // Evening portion: starts today, ends tomorrow
      shiftStartDate = today
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      shiftEndDate = tomorrow.toISOString().split('T')[0]
    } else {
      // Early morning portion (0-5): started yesterday, ends today
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      shiftStartDate = yesterday.toISOString().split('T')[0]
      shiftEndDate = today
    }
  }

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

  const fmtDate = (d) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const dateStr = currentShift === 'A' || shiftStartDate === shiftEndDate
    ? fmtDate(shiftStartDate)
    : `${fmtDate(shiftStartDate)} – ${fmtDate(shiftEndDate)}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Dark App Bar */}
      <div style={{ flexShrink: 0, background: '#1b4332', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: 'rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <img src="/kanoz-logo.png" alt="Kanoz" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Welcome, {employee?.name?.split(' ')[0] || 'User'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                {plant?.name || 'Plant'} &bull; Shift {currentShift} &bull; {dateStr}
              </div>
            </div>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', background: '#fefae0' }}>
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

        {/* History Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a8d7a', textTransform: 'uppercase', marginBottom: 0 }}>
            History
          </div>

          {can(employee?.role, 'view_reports') && (
          <button
            onClick={() => navigate('/reports')}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
              padding: '14px 16px', borderRadius: 14, background: '#fff',
              border: '1.5px solid #e5ddd0', cursor: 'pointer',
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#e8f0ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              📊
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>Shift Reports</div>
              <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>View all submitted reports</div>
            </div>
            <ChevronRight size={18} color="#b5b8a8" />
          </button>
          )}

          {can(employee?.role, 'view_dispatches') && (
          <button
            onClick={() => navigate('/dispatch')}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
              padding: '14px 16px', borderRadius: 14, background: '#fff',
              border: '1.5px solid #e5ddd0', cursor: 'pointer',
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              🚛
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>Dispatches</div>
              <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>View vehicle dispatch history</div>
            </div>
            <ChevronRight size={18} color="#b5b8a8" />
          </button>
          )}

          {can(employee?.role, 'view_purchases') && (
          <button
            onClick={() => navigate('/purchase')}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
              padding: '14px 16px', borderRadius: 14, background: '#fff',
              border: '1.5px solid #e5ddd0', cursor: 'pointer',
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              📦
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>Purchases</div>
              <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>View raw material purchases</div>
            </div>
            <ChevronRight size={18} color="#b5b8a8" />
          </button>
          )}
        </div>

        {/* Today's Reports */}
        {todayReports.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a8d7a', textTransform: 'uppercase', marginBottom: 12 }}>
            Today's Reports
          </div>
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2c' }}>
                    Shift {report.shift} — {report.date}
                  </div>
                  <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 2 }}>
                    {report.pellet_production_mt || 0} MT &bull; {(() => {
                      const sd = report.shift_start_date || report.date
                      const ed = report.shift_end_date || report.date
                      const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''
                      return `${fmt(sd)} ${report.start_time?.slice(0,5)} – ${sd !== ed ? fmt(ed) + ' ' : ''}${report.end_time?.slice(0,5)}`
                    })()}
                  </div>
                </div>
                <ChevronRight size={18} color="#b5b8a8" />
              </button>
            ))}
          </div>
        </div>
        )}
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
