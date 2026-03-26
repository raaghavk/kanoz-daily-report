import { useState } from 'react'
import { getLocalDate } from '../lib/dateUtils'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { can } from '../lib/permissions'
import Modal from '../components/Modal'
import { ChevronRight, AlertTriangle, Wrench, CheckSquare, Circle } from 'lucide-react'

export default function Home() {
  const { employee, plant } = useAuth()
  const navigate = useNavigate()
  const [showProductionModal, setShowProductionModal] = useState(false)
  const [showTrucksModal, setShowTrucksModal] = useState(false)
  const [showIssuesModal, setShowIssuesModal] = useState(false)

  const now = new Date()
  const hour = now.getHours()
  // Use local date (not UTC) â toISOString() returns UTC which is wrong for IST
  const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = localDate(now)
  // Shift A: 08:00â19:59, Shift B: 20:00â07:59 (overnight)
  const currentShift = (hour >= 8 && hour < 20) ? 'A' : 'B'
  const shiftTime = currentShift === 'A' ? '08:00â20:00' : '20:00â08:00'

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
      shiftEndDate = localDate(tomorrow)
    } else {
      // Early morning portion (0-5): started yesterday, ends today
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      shiftStartDate = localDate(yesterday)
      shiftEndDate = today
    }
  }

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', plant?.id, today],
    queryFn: async () => {
      // Yesterday's date for summary
      const yd = new Date(now)
      yd.setDate(yd.getDate() - 1)
      const yesterday = localDate(yd)

      // Optimized: 4 queries instead of 6, lighter selects
      const [reportsRes, dispatchCountRes, lastReportRes, yesterdayRes] = await Promise.all([
        // Today's reports (light: only what dashboard needs)
        supabase
          .from('shift_reports')
          .select('id, shift, date, start_time, end_time, pellet_production_mt, shift_start_date, shift_end_date, issues(id)')
          .eq('plant_id', plant.id)
          .eq('is_deleted', false)
          .eq('date', today),
        // Today's dispatch count only
        supabase
          .from('vehicle_dispatches')
          .select('id', { count: 'exact', head: true })
          .eq('plant_id', plant.id)
          .eq('is_deleted', false)
          .eq('date', today),
        // Last handover note
        supabase
          .from('shift_reports')
          .select('handover_notes, shift, date')
          .eq('plant_id', plant.id)
          .eq('is_deleted', false)
          .order('date', { ascending: false })
          .order('shift', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Yesterday: combine all 3 into parallel sub-queries
        Promise.all([
          supabase.from('shift_reports').select('pellet_production_mt').eq('plant_id', plant.id).eq('is_deleted', false).eq('date', yesterday),
          supabase.from('vehicle_dispatches').select('dispatch_pellets(quantity_mt)').eq('plant_id', plant.id).eq('is_deleted', false).eq('date', yesterday),
          supabase.from('raw_material_purchases').select('total_amount, quantity_kg').eq('plant_id', plant.id).eq('is_deleted', false).eq('date', yesterday),
        ]),
      ])

      const reports = reportsRes.data || []
      const totalProd = reports.reduce((sum, r) => sum + (parseFloat(r.pellet_production_mt) || 0), 0)
      const totalIssues = reports.reduce((sum, r) => sum + (r.issues?.length || 0), 0)
      const handover = lastReportRes.data?.handover_notes ? lastReportRes.data : null

      // Yesterday summary (from combined promise)
      const [yesterdayReportsRes, yesterdayDispatchesRes, yesterdayPurchasesRes] = yesterdayRes
      const yReports = yesterdayReportsRes.data || []
      const yDispatches = yesterdayDispatchesRes.data || []
      const yPurchases = yesterdayPurchasesRes.data || []
      const yProd = yReports.reduce((s, r) => s + (parseFloat(r.pellet_production_mt) || 0), 0)
      const yTrucks = yDispatches.length
      const yDispatchMT = yDispatches.reduce((s, d) => s + (d.dispatch_pellets || []).reduce((ss, p) => ss + (parseFloat(p.quantity_mt) || 0), 0), 0)
      const yPurchaseAmt = yPurchases.reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0)
      const yPurchaseKg = yPurchases.reduce((s, p) => s + (parseFloat(p.quantity_kg) || 0), 0)

      return {
        stats: { production: totalProd, trucks: dispatchCountRes.count || 0, issues: totalIssues },
        todayReports: reports,
        handoverNotes: handover,
        yesterday: (yProd > 0 || yTrucks > 0 || yPurchases.length > 0) ? { production: yProd, trucks: yTrucks, dispatchMT: yDispatchMT, purchaseAmt: yPurchaseAmt, purchaseKg: yPurchaseKg, purchaseCount: yPurchases.length } : null,
      }
    },
    enabled: !!plant?.id,
  })

  const stats = dashboardData?.stats || { production: 0, trucks: 0, issues: 0 }
  const todayReports = dashboardData?.todayReports || []
  const handoverNotes = dashboardData?.handoverNotes || null
  const yesterday = dashboardData?.yesterday || null

  const { data: sparePartsData } = useQuery({
    queryKey: ['home-spare-parts', plant?.id],
    queryFn: async () => {
      const today = getLocalDate()
      const { data: partsData } = await supabase.from('spare_parts').select('id').eq('org_id', plant.org_id).eq('is_active', true)
      const partIds = (partsData || []).map(p => p.id)
      if (!partIds.length) return { totalParts: 0, lowStock: 0, purchasedToday: 0, issuedToday: 0 }

      const [purchasesRes, usageRes, todayInRes, todayOutRes, configRes] = await Promise.all([
        supabase.from('spare_parts_purchases').select('part_id, quantity').eq('plant_id', plant.id).in('part_id', partIds),
        supabase.from('spare_parts_usage').select('part_id, quantity').eq('plant_id', plant.id).in('part_id', partIds),
        supabase.from('spare_parts_purchases').select('quantity').eq('plant_id', plant.id).eq('purchase_date', today),
        supabase.from('spare_parts_usage').select('quantity').eq('plant_id', plant.id).eq('usage_date', today),
        supabase.from('spare_parts_plant_config').select('part_id, min_stock_level').eq('plant_id', plant.id).in('part_id', partIds),
      ])

      const purchaseMap = {}
      for (const r of (purchasesRes.data || [])) purchaseMap[r.part_id] = (purchaseMap[r.part_id] || 0) + Number(r.quantity)
      const usageMap = {}
      for (const r of (usageRes.data || [])) usageMap[r.part_id] = (usageMap[r.part_id] || 0) + Number(r.quantity)
      const configMap = {}
      for (const r of (configRes.data || [])) configMap[r.part_id] = Number(r.min_stock_level)

      const lowStock = partIds.filter(id => configMap[id] != null && ((purchaseMap[id] || 0) - (usageMap[id] || 0)) <= configMap[id]).length
      const purchasedToday = (todayInRes.data || []).reduce((s, r) => s + Number(r.quantity), 0)
      const issuedToday = (todayOutRes.data || []).reduce((s, r) => s + Number(r.quantity), 0)

      return { totalParts: partIds.length, lowStock, purchasedToday, issuedToday }
    },
    enabled: !!plant?.id,
  })
  const sp = sparePartsData || { totalParts: 0, lowStock: 0, purchasedToday: 0, issuedToday: 0 }

  const { data: tasksData } = useQuery({
    queryKey: ['home-tasks', plant?.id, employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_date, status, assigned_to_employee_id, assignee:employees!tasks_assigned_to_employee_id_fkey(name)')
        .eq('plant_id', plant.id)
        .in('status', ['open', 'done'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10)
      return data || []
    },
    enabled: !!plant?.id,
  })
  const allTasks = tasksData || []
  // Non-assigners only see their own tasks
  const myTasks = can(employee?.role, 'assign_tasks')
    ? allTasks
    : allTasks.filter(t => t.assigned_to_employee_id === employee?.id)
  const openTasks = myTasks.filter(t => t.status === 'open')
  const doneTasks = myTasks.filter(t => t.status === 'done')

  const fmtDate = (d) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const dateStr = currentShift === 'A' || shiftStartDate === shiftEndDate
    ? fmtDate(shiftStartDate)
    : `${fmtDate(shiftStartDate)} â ${fmtDate(shiftEndDate)}`

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      {/* Dark App Bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1b4332', paddingTop: 'env(safe-area-inset-top)' }}>
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
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a8d7a', textTransform: 'uppercase', marginBottom: 8 }}>
          Today's Activity
        </div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a8d7a', textTransform: 'uppercase', marginBottom: 2 }}>
            History
          </div>

          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
          {can(employee?.role, 'view_reports') && (
          <button onClick={() => navigate('/reports')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f0ebe0', cursor: 'pointer' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: '#e8f0ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>ð</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>Shift Reports</div>
            <ChevronRight size={15} color="#b5b8a8" />
          </button>
          )}
          {can(employee?.role, 'view_dispatches') && (
          <button onClick={() => navigate('/dispatch')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f0ebe0', cursor: 'pointer' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>ð</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>Dispatches</div>
            <ChevronRight size={15} color="#b5b8a8" />
          </button>
          )}
          {can(employee?.role, 'view_purchases') && (
          <button onClick={() => navigate('/purchase')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f0ebe0', cursor: 'pointer' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>ð¦</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>Purchases</div>
            <ChevronRight size={15} color="#b5b8a8" />
          </button>
          )}

          {can(employee?.role, 'view_spare_parts') && (
          <button onClick={() => navigate('/spare-parts')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 14px', background: sp.lowStock > 0 ? '#fff7f7' : 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: sp.lowStock > 0 ? '#fee2e2' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {sp.lowStock > 0 ? <AlertTriangle size={15} color="#b91c1c" /> : <Wrench size={15} color="#2563EB" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: sp.lowStock > 0 ? '#b91c1c' : '#2c2c2c' }}>
                Spare Parts {sp.lowStock > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#b91c1c', borderRadius: 5, padding: '1px 5px', marginLeft: 4 }}>{sp.lowStock} low</span>}
              </div>
              <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>{sp.totalParts} parts Â· +{sp.purchasedToday} purchased Â· {sp.issuedToday} used today</div>
            </div>
            <ChevronRight size={15} color="#b5b8a8" />
          </button>
          )}
          </div>
        </div>

        {/* Tasks Section */}
        {myTasks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a8d7a', textTransform: 'uppercase' }}>
                Tasks {openTasks.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: '#EEF2FF', color: '#2563EB', borderRadius: 5, padding: '1px 6px', marginLeft: 4 }}>{openTasks.length} open</span>}
              </div>
              <button onClick={() => navigate('/tasks')} style={{ fontSize: 11, fontWeight: 600, color: '#2d6a4f', background: 'none', border: 'none', cursor: 'pointer' }}>
                See all â
              </button>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
              {myTasks.slice(0, 4).map((task, idx) => {
                const overdue = task.status === 'open' && task.due_date && new Date(task.due_date + 'T00:00') < new Date(new Date().toDateString())
                return (
                  <button key={task.id} onClick={() => navigate('/tasks')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', cursor: 'pointer' }}>
                    <div style={{ flexShrink: 0 }}>
                      {task.status === 'done'
                        ? <CheckSquare size={16} color="#2d6a4f" />
                        : <Circle size={16} color={overdue ? '#dc2626' : '#d1d5db'} />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                      {task.assignee?.name && (
                        <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>â {task.assignee.name}</div>
                      )}
                    </div>
                    {task.due_date && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: overdue ? '#dc2626' : '#8a8d7a', flexShrink: 0 }}>
                        {new Date(task.due_date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </button>
                )
              })}
              {myTasks.length > 4 && (
                <button onClick={() => navigate('/tasks')} style={{ width: '100%', padding: '8px 14px', background: 'none', border: 'none', borderTop: '1px solid #f0ebe0', fontSize: 12, color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>
                  +{myTasks.length - 4} more tasks â
                </button>
              )}
            </div>
          </div>
        )}
        {/* Tasks empty hint for assigners */}
        {myTasks.length === 0 && can(employee?.role, 'assign_tasks') && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a8d7a', textTransform: 'uppercase', marginBottom: 8 }}>Tasks</div>
            <button onClick={() => navigate('/tasks')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '12px 14px', background: '#fff', border: '1.5px solid #e5ddd0', borderRadius: 14, cursor: 'pointer' }}>
              <CheckSquare size={18} color="#8a8d7a" />
              <span style={{ fontSize: 13, color: '#8a8d7a' }}>No open tasks Â· Tap to assign one</span>
              <ChevronRight size={15} color="#b5b8a8" style={{ marginLeft: 'auto' }} />
            </button>
          </div>
        )}

        {/* Yesterday's Summary */}
        {yesterday && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#8a8d7a', textTransform: 'uppercase', marginBottom: 10 }}>
              Yesterday's Summary (All Shifts)
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {yesterday.production > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#8a8d7a', fontWeight: 600 }}>Production</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#2d6a4f', marginTop: 2 }}>{yesterday.production.toFixed(1)} MT</div>
                  </div>
                )}
                {yesterday.trucks > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: '#8a8d7a', fontWeight: 600 }}>Dispatched</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#d4a373', marginTop: 2 }}>{yesterday.dispatchMT.toFixed(1)} MT ({yesterday.trucks} trucks)</div>
                  </div>
                )}
                {yesterday.purchaseCount > 0 && (
                  <div style={{ gridColumn: yesterday.production > 0 && yesterday.trucks > 0 ? '1 / -1' : 'auto' }}>
                    <div style={{ fontSize: 10, color: '#8a8d7a', fontWeight: 600 }}>Purchases</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#595c4a', marginTop: 2 }}>
                      â¹{Math.round(yesterday.purchaseAmt).toLocaleString('en-IN')}
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#8a8d7a', marginLeft: 6 }}>
                        ({yesterday.purchaseCount} entries, {yesterday.purchaseKg >= 1000 ? `${(yesterday.purchaseKg / 1000).toFixed(1)} MT` : `${Math.round(yesterday.purchaseKg)} kg`})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                    Shift {report.shift} â {report.date}
                  </div>
                  <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 2 }}>
                    {parseFloat(report.pellet_production_mt || 0).toFixed(1)} MT &bull; {report.start_time?.slice(0,5) || '?'} â {report.end_time?.slice(0,5) || '?'}
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
