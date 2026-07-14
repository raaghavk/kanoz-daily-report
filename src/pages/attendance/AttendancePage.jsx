import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { can } from '../../lib/permissions'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { getLocalDate } from '../../lib/dateUtils'
import { Loader2, LogIn, LogOut, MapPin, CheckCircle2, Circle, Clock, CalendarDays } from 'lucide-react'

const GREEN = '#2d6a4f'
const DARK = '#1b4332'
const MUTED = '#8a8d7a'
const BORDER = '#e5ddd0'
const TEXT = '#2c2c2c'

function fmtTime(ts) {
  if (!ts) return null
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function hoursBetween(a, b) {
  if (!a || !b) return null
  const ms = new Date(b) - new Date(a)
  if (ms <= 0) return null
  const h = ms / 3600000
  return h.toFixed(1)
}

// Try to grab GPS coords; resolves to {lat,lng} or null (never rejects)
function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  })
}

export default function AttendancePage() {
  const { employee, plant } = useAuth()
  const role = employee?.role
  const isAdmin = can(role, 'manage_users') || can(role, 'plant_settings')
  const today = getLocalDate()

  const [myRow, setMyRow] = useState(null)
  const [loadingMine, setLoadingMine] = useState(true)
  const [saving, setSaving] = useState(false)

  const [roster, setRoster] = useState([])
  const [loadingRoster, setLoadingRoster] = useState(true)

  const [histDate, setHistDate] = useState(today)
  const [history, setHistory] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)

  const loadMine = useCallback(async () => {
    if (!employee?.id) return
    setLoadingMine(true)
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('work_date', today)
        .maybeSingle()
      setMyRow(data || null)
    } catch { showToast('Failed to load attendance', 'error') } finally { setLoadingMine(false) }
  }, [employee?.id, today])

  const loadRoster = useCallback(async () => {
    if (!plant?.id) return
    setLoadingRoster(true)
    try {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name, role')
        .eq('plant_id', plant.id)
        .eq('is_active', true)
        .order('name')
      const { data: rows } = await supabase
        .from('attendance')
        .select('employee_id, check_in_at, check_out_at')
        .eq('plant_id', plant.id)
        .eq('work_date', today)
      const byEmp = {}
      for (const r of (rows || [])) byEmp[r.employee_id] = r
      setRoster((emps || []).map(e => ({ ...e, att: byEmp[e.id] || null })))
    } catch { /* silent */ } finally { setLoadingRoster(false) }
  }, [plant?.id, today])

  const loadHistory = useCallback(async () => {
    if (!plant?.id || !isAdmin) return
    setLoadingHist(true)
    try {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name')
        .eq('plant_id', plant.id)
        .eq('is_active', true)
        .order('name')
      const { data: rows } = await supabase
        .from('attendance')
        .select('employee_id, check_in_at, check_out_at, note')
        .eq('plant_id', plant.id)
        .eq('work_date', histDate)
      const byEmp = {}
      for (const r of (rows || [])) byEmp[r.employee_id] = r
      setHistory((emps || []).map(e => ({ ...e, att: byEmp[e.id] || null })))
    } catch { /* silent */ } finally { setLoadingHist(false) }
  }, [plant?.id, isAdmin, histDate])

  useEffect(() => { loadMine() }, [loadMine])
  useEffect(() => { loadRoster() }, [loadRoster])
  useEffect(() => { loadHistory() }, [loadHistory])

  async function handleCheckIn() {
    if (saving || !employee?.id || !plant?.id) return
    setSaving(true)
    try {
      const coords = await getCoords()
      const payload = {
        org_id: plant.org_id,
        plant_id: plant.id,
        employee_id: employee.id,
        work_date: today,
        check_in_at: new Date().toISOString(),
        check_in_lat: coords?.lat ?? null,
        check_in_lng: coords?.lng ?? null,
      }
      const { error } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'employee_id,work_date' })
      if (error) throw error
      showToast(coords ? 'Checked in with location' : 'Checked in', 'success')
      await Promise.all([loadMine(), loadRoster()])
    } catch { showToast('Check-in failed', 'error') } finally { setSaving(false) }
  }

  async function handleCheckOut() {
    if (saving || !myRow?.id) return
    if (!window.confirm('Check out now? This records your end time.')) return
    setSaving(true)
    try {
      const coords = await getCoords()
      const { error } = await supabase
        .from('attendance')
        .update({
          check_out_at: new Date().toISOString(),
          check_out_lat: coords?.lat ?? null,
          check_out_lng: coords?.lng ?? null,
        })
        .eq('id', myRow.id)
      if (error) throw error
      showToast('Checked out', 'success')
      await Promise.all([loadMine(), loadRoster()])
    } catch { showToast('Check-out failed', 'error') } finally { setSaving(false) }
  }

  const checkedIn = !!myRow?.check_in_at
  const checkedOut = !!myRow?.check_out_at
  const totalHrs = hoursBetween(myRow?.check_in_at, myRow?.check_out_at)

  let statusText = 'Not checked in yet'
  if (checkedOut) statusText = `Checked out at ${fmtTime(myRow.check_out_at)}`
  else if (checkedIn) statusText = `Checked in at ${fmtTime(myRow.check_in_at)}`

  const cardStyle = { background: '#fff', borderRadius: 14, border: `1.5px solid ${BORDER}`, overflow: 'hidden' }
  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED, textTransform: 'uppercase', marginBottom: 8 }

  function statusPill(att) {
    if (att?.check_out_at) return { label: `Out ${fmtTime(att.check_out_at)}`, bg: '#e8f0ec', text: GREEN }
    if (att?.check_in_at) return { label: `In ${fmtTime(att.check_in_at)}`, bg: '#EEF2FF', text: '#2563EB' }
    return { label: 'Absent', bg: '#f3f4f6', text: '#9ca3af' }
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Attendance" subtitle={plant?.name || 'Plant'} backTo="/" />

      <div style={{ padding: '16px 20px 32px' }}>
        {/* My status / check-in-out */}
        <div style={sectionLabel}>My Attendance · Today</div>
        <div style={{ ...cardStyle, padding: 16, marginBottom: 20 }}>
          {loadingMine ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: checkedIn ? '#e8f0ec' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {checkedOut ? <CheckCircle2 size={20} color={GREEN} /> : checkedIn ? <Clock size={20} color="#2563EB" /> : <Circle size={20} color="#9ca3af" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{statusText}</div>
                  {checkedOut && totalHrs && (
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Total: {totalHrs} hrs</div>
                  )}
                  {checkedIn && !checkedOut && (
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Currently on shift</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  onClick={handleCheckIn}
                  disabled={saving || checkedIn}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 0', borderRadius: 12, border: 'none',
                    fontSize: 14, fontWeight: 700, cursor: (saving || checkedIn) ? 'default' : 'pointer',
                    background: checkedIn ? '#e8f0ec' : GREEN,
                    color: checkedIn ? GREEN : '#fff',
                    opacity: saving && !checkedIn ? 0.7 : 1,
                  }}
                >
                  {saving && !checkedIn ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <LogIn size={16} />}
                  {checkedIn ? 'Checked In' : 'Check In'}
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={saving || !checkedIn || checkedOut}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 0', borderRadius: 12,
                    border: `1.5px solid ${(!checkedIn || checkedOut) ? BORDER : DARK}`,
                    fontSize: 14, fontWeight: 700,
                    cursor: (saving || !checkedIn || checkedOut) ? 'default' : 'pointer',
                    background: checkedOut ? '#e8f0ec' : '#fff',
                    color: (!checkedIn || checkedOut) ? MUTED : DARK,
                    opacity: saving && checkedIn && !checkedOut ? 0.7 : 1,
                  }}
                >
                  {saving && checkedIn && !checkedOut ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOut size={16} />}
                  {checkedOut ? 'Checked Out' : 'Check Out'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 11, color: MUTED }}>
                <MapPin size={12} /> Location captured if you allow it — optional.
              </div>
            </>
          )}
        </div>

        {/* Today's roster — shared board */}
        <div style={sectionLabel}>Today's Roster · Who's In</div>
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          {loadingRoster ? (
            <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
            </div>
          ) : roster.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: MUTED }}>No active employees.</div>
          ) : (
            roster.map((e, idx) => {
              const pill = statusPill(e.att)
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.name}{e.id === employee?.id ? ' (You)' : ''}
                    </div>
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 1, textTransform: 'capitalize' }}>{(e.role || '').replace(/_/g, ' ')}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, background: pill.bg, color: pill.text, borderRadius: 7, padding: '3px 9px', flexShrink: 0 }}>
                    {pill.label}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Admin history */}
        {isAdmin && (
          <>
            <div style={sectionLabel}>History</div>
            <div style={{ ...cardStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid #f0ebe0' }}>
                <CalendarDays size={16} color={MUTED} />
                <input
                  type="date"
                  value={histDate}
                  max={today}
                  onChange={(ev) => setHistDate(ev.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fefae0', fontSize: 14, color: TEXT, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {loadingHist ? (
                <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                </div>
              ) : history.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: MUTED }}>No employees.</div>
              ) : (
                history.map((e, idx) => {
                  const hrs = hoursBetween(e.att?.check_in_at, e.att?.check_out_at)
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                          {e.att?.check_in_at ? `In ${fmtTime(e.att.check_in_at)}` : 'Absent'}
                          {e.att?.check_out_at ? ` · Out ${fmtTime(e.att.check_out_at)}` : ''}
                          {hrs ? ` · ${hrs} hrs` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
