import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { can } from '../../lib/permissions'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import { getLocalDate } from '../../lib/dateUtils'
import { CHECK_IN_GEOFENCE_RADIUS_M, gpsErrorMessage, prepareSelfCheckIn } from '../../lib/geofence'
import { Loader2, LogIn, LogOut, MapPin, CheckCircle2, Circle, Clock, CalendarDays, UserPlus, X, ChevronDown, ChevronUp, Trash2, UserCheck } from 'lucide-react'

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

// Combine an HH:MM time input with a YYYY-MM-DD date into an ISO timestamp
function combineDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const d = new Date(`${dateStr}T00:00:00`)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// GPS: required=true rejects with a user-facing error; otherwise resolves null on failure.
function getCoords({ required = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      if (required) reject(new Error('This device does not support GPS. Check-in requires location.'))
      else resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (required) reject(new Error(gpsErrorMessage(err)))
        else resolve(null)
      },
      { enableHighAccuracy: true, timeout: required ? 12000 : 8000, maximumAge: required ? 15000 : 60000 }
    )
  })
}

export default function AttendancePage() {
  const { employee, plant } = useAuth()
  const role = employee?.role
  const isAdmin = can(role, 'manage_users') || can(role, 'plant_settings')
  const today = getLocalDate()
  const canMarkOthers = can(employee?.role, 'mark_attendance_others') || ['admin', 'plant_manager', 'supervisor'].includes(employee?.role)

  const [myRow, setMyRow] = useState(null)
  const [loadingMine, setLoadingMine] = useState(true)
  const [saving, setSaving] = useState(false)

  const [roster, setRoster] = useState([])
  const [myTracksAttendance, setMyTracksAttendance] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(true)

  const [histDate, setHistDate] = useState(today)
  const [history, setHistory] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)

  const [machines, setMachines] = useState([])   // plant machines + equipment (for attach-to)

  // Add-labourer modal
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addMobile, setAddMobile] = useState('')
  const [addType, setAddType] = useState('labour')   // 'labour' | 'driver'
  const [addWage, setAddWage] = useState('')
  const [addMachineIds, setAddMachineIds] = useState([])
  const [addSaving, setAddSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)

  // Collapsible staff role groups — track collapsed role keys
  const [collapsedRoles, setCollapsedRoles] = useState({})

  // Supervisor marking-for-others
  const [markingId, setMarkingId] = useState(null)   // employee id currently saving
  const [expandedId, setExpandedId] = useState(null) // row with times/hours expander open
  const [timeIn, setTimeIn] = useState('')
  const [timeOut, setTimeOut] = useState('')
  const [hoursInput, setHoursInput] = useState('')

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
        .select('id, name, role, worker_type, mobile, labour_daily_wage, machine_id, machine_ids')
        .eq('plant_id', plant.id)
        .eq('is_active', true)
        .order('name')
      // Roles flagged track_attendance = false are excluded from attendance entirely.
      const exempt = new Set()
      try {
        const orgId = plant?.org_id || employee?.org_id
        if (orgId) {
          const { data: roleRows } = await supabase.from('roles').select('key, name, track_attendance').eq('org_id', orgId)
          for (const r of (roleRows || [])) {
            if (r.track_attendance === false) { if (r.key) exempt.add(r.key); if (r.name) exempt.add(r.name) }
          }
        }
      } catch { /* ignore */ }
      setMyTracksAttendance(!exempt.has(employee?.role))
      const visibleEmps = (emps || []).filter(e => !exempt.has(e.role))
      const { data: rows } = await supabase
        .from('attendance')
        .select('id, employee_id, check_in_at, check_out_at, status, hours, marked_by, machine_id, machine_ids')
        .eq('plant_id', plant.id)
        .eq('work_date', today)
      const nameById = {}
      for (const e of (emps || [])) nameById[e.id] = e.name
      const byEmp = {}
      for (const r of (rows || [])) byEmp[r.employee_id] = r
      setRoster(visibleEmps.map(e => ({ ...e, att: byEmp[e.id] || null, markerName: byEmp[e.id]?.marked_by ? (nameById[byEmp[e.id].marked_by] || null) : null })))
    } catch { /* silent */ } finally { setLoadingRoster(false) }
  }, [plant?.id, today])

  const loadMachines = useCallback(async () => {
    if (!plant?.id) return
    try {
      const [mRes, eRes] = await Promise.all([
        supabase.from('machines').select('id, name').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
        supabase.from('equipment').select('id, name').eq('plant_id', plant.id).eq('is_active', true).order('sort_order'),
      ])
      setMachines([...(mRes.data || []), ...(eRes.data || [])])
    } catch { /* silent */ }
  }, [plant?.id])

  const loadHistory = useCallback(async () => {
    if (!plant?.id || !isAdmin) return
    setLoadingHist(true)
    try {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name, role, worker_type, labour_daily_wage')
        .eq('plant_id', plant.id)
        .eq('is_active', true)
        .order('name')
      // Exclude roles flagged track_attendance = false (e.g. Admin) from history too.
      const exempt = new Set()
      try {
        const orgId = plant?.org_id || employee?.org_id
        if (orgId) {
          const { data: roleRows } = await supabase.from('roles').select('key, name, track_attendance').eq('org_id', orgId)
          for (const r of (roleRows || [])) {
            if (r.track_attendance === false) { if (r.key) exempt.add(r.key); if (r.name) exempt.add(r.name) }
          }
        }
      } catch { /* ignore */ }
      const visibleEmps = (emps || []).filter(e => !exempt.has(e.role))
      const { data: rows } = await supabase
        .from('attendance')
        .select('employee_id, check_in_at, check_out_at, status, hours, note')
        .eq('plant_id', plant.id)
        .eq('work_date', histDate)
      const byEmp = {}
      for (const r of (rows || [])) byEmp[r.employee_id] = r
      setHistory(visibleEmps.map(e => ({ ...e, att: byEmp[e.id] || null })))
    } catch { /* silent */ } finally { setLoadingHist(false) }
  }, [plant?.id, isAdmin, histDate, plant?.org_id, employee?.org_id])

  useEffect(() => { loadMine() }, [loadMine])
  useEffect(() => { loadRoster() }, [loadRoster])
  useEffect(() => { loadMachines() }, [loadMachines])
  useEffect(() => { loadHistory() }, [loadHistory])

  async function handleCheckIn() {
    if (saving || !employee?.id || !plant?.id) return
    setSaving(true)
    try {
      const [{ data: plantLoc, error: plantErr }, coords] = await Promise.all([
        supabase.from('plants').select('location_lat, location_lng').eq('id', plant.id).maybeSingle(),
        getCoords({ required: true }),
      ])
      if (plantErr) throw new Error('Could not load plant location. Try again.')
      const gated = prepareSelfCheckIn({
        plantLat: plantLoc?.location_lat,
        plantLng: plantLoc?.location_lng,
        coords,
      })
      const payload = {
        org_id: plant.org_id,
        plant_id: plant.id,
        employee_id: employee.id,
        work_date: today,
        status: gated.status,
        check_in_at: new Date().toISOString(),
        check_in_lat: gated.check_in_lat,
        check_in_lng: gated.check_in_lng,
      }
      const { error } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'employee_id,work_date' })
      if (error) throw error
      showToast(`Checked in · ${Math.round(gated.distanceM)} m from plant`, 'success')
      await Promise.all([loadMine(), loadRoster()])
    } catch (err) { showToast(err?.message || 'Check-in failed', 'error') } finally { setSaving(false) }
  }

  async function handleCheckOut() {
    if (saving || !myRow?.id) return
    if (!window.confirm('Check out now? This records your end time.')) return
    setSaving(true)
    try {
      const coords = await getCoords()
      const outAt = new Date().toISOString()
      const autoHrs = hoursBetween(myRow.check_in_at, outAt)
      const { error } = await supabase
        .from('attendance')
        .update({
          check_out_at: outAt,
          check_out_lat: coords?.lat ?? null,
          check_out_lng: coords?.lng ?? null,
          hours: autoHrs != null ? Number(autoHrs) : null,
        })
        .eq('id', myRow.id)
      if (error) throw error
      showToast('Checked out', 'success')
      await Promise.all([loadMine(), loadRoster()])
    } catch { showToast('Check-out failed', 'error') } finally { setSaving(false) }
  }

  // --- Add labourer (login-less employee row) ---
  async function handleAddLabourer() {
    if (addSaving) return
    const name = addName.trim()
    if (!name) { showToast('Name is required', 'error'); return }
    if (!plant?.id) { showToast('No plant selected', 'error'); return }
    setAddSaving(true)
    try {
      const wage = addWage.trim() === '' ? null : Number(addWage)
      const { error } = await supabase
        .from('employees')
        .insert({
          org_id: plant.org_id,
          plant_id: plant.id,
          name,
          mobile: addMobile.trim() || null,
          worker_type: addType,
          role: addType,
          is_active: true,
          auth_user_id: null,
          labour_daily_wage: (wage != null && !Number.isNaN(wage)) ? wage : null,
          machine_id: addMachineIds[0] || null,
          machine_ids: addMachineIds.length ? addMachineIds : null,
        })
      if (error) throw error
      showToast('Worker added', 'success')
      setShowAdd(false)
      setAddName(''); setAddMobile(''); setAddType('labour'); setAddWage(''); setAddMachineIds([])
      await loadRoster()
    } catch { showToast('Failed to add worker', 'error') } finally { setAddSaving(false) }
  }

  // --- Delete a labourer (soft: deactivate) ---
  async function deleteLabourer(emp) {
    if (deletingId) return
    if (!window.confirm(`Remove ${emp.name}? They will no longer appear on the roster.`)) return
    setDeletingId(emp.id)
    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: false })
        .eq('id', emp.id)
      if (error) throw error
      showToast('Worker removed', 'success')
      await loadRoster()
    } catch { showToast('Failed to remove worker', 'error') } finally { setDeletingId(null) }
  }

  // --- Mark everyone in a group present in one tap (then unselect absentees) ---
  async function markAllPresent(members) {
    if (markingAll || !plant?.id || !employee?.id) return
    const targets = (members || []).filter(m => !isPresent(m.att))
    if (targets.length === 0) { showToast('Everyone already present', 'success'); return }
    setMarkingAll(true)
    try {
      const rows = targets.map(m => ({
        org_id: plant.org_id, plant_id: plant.id, employee_id: m.id, work_date: today,
        status: 'present', marked_by: employee.id,
        ...(m.machine_ids?.length ? { machine_ids: m.machine_ids, machine_id: m.machine_ids[0] } : (m.machine_id ? { machine_id: m.machine_id } : {})),
      }))
      const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'employee_id,work_date' })
      if (error) throw error
      showToast(`Marked ${targets.length} present`, 'success')
      await Promise.all([loadRoster(), loadMine(), loadHistory()])
    } catch { showToast('Failed to mark all present', 'error') } finally { setMarkingAll(false) }
  }

  // --- Mark present/absent for another employee ---
  async function markStatus(emp, status) {
    if (markingId || !plant?.id || !employee?.id) return
    setMarkingId(emp.id)
    try {
      const payload = {
        org_id: plant.org_id,
        plant_id: plant.id,
        employee_id: emp.id,
        work_date: today,
        status,
        marked_by: employee.id,
      }
      // Absent clears any recorded times/hours; present (quick) leaves times as-is
      if (status === 'absent') {
        payload.check_in_at = null
        payload.check_out_at = null
        payload.hours = null
        payload.machine_id = null
        payload.machine_ids = null
      } else if (emp.machine_ids?.length) {
        // Carry the worker's attached machines onto today's attendance
        payload.machine_ids = emp.machine_ids
        payload.machine_id = emp.machine_ids[0]
      } else if (emp.machine_id) {
        payload.machine_id = emp.machine_id
      }
      const { error } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'employee_id,work_date' })
      if (error) throw error
      showToast(status === 'present' ? 'Marked present' : 'Marked absent', 'success')
      await Promise.all([loadRoster(), loadMine(), loadHistory()])
    } catch { showToast('Failed to mark attendance', 'error') } finally { setMarkingId(null) }
  }

  // Open/close the per-row times/hours expander, seeding from existing values
  function toggleExpander(emp) {
    if (expandedId === emp.id) { setExpandedId(null); return }
    setExpandedId(emp.id)
    setTimeIn(fmtTime(emp.att?.check_in_at) || '')
    setTimeOut(fmtTime(emp.att?.check_out_at) || '')
    setHoursInput(emp.att?.hours != null ? String(emp.att.hours) : '')
  }

  // --- Save exact times / hours for another employee ---
  async function saveTimesHours(emp) {
    if (markingId || !plant?.id || !employee?.id) return
    setMarkingId(emp.id)
    try {
      const checkIn = combineDateTime(today, timeIn)
      const checkOut = combineDateTime(today, timeOut)
      // Auto hours: if both in & out are set, derive hours; otherwise fall back to manual entry.
      const autoHrs = hoursBetween(checkIn, checkOut)
      let hours = null
      if (autoHrs != null) hours = Number(autoHrs)
      else if (hoursInput.trim() !== '') { const h = Number(hoursInput); if (!Number.isNaN(h)) hours = h }
      const payload = {
        org_id: plant.org_id,
        plant_id: plant.id,
        employee_id: emp.id,
        work_date: today,
        status: 'present',
        marked_by: employee.id,
        check_in_at: checkIn,
        check_out_at: checkOut,
        hours,
      }
      const { error } = await supabase
        .from('attendance')
        .upsert(payload, { onConflict: 'employee_id,work_date' })
      if (error) throw error
      showToast('Times saved', 'success')
      setExpandedId(null)
      await Promise.all([loadRoster(), loadMine(), loadHistory()])
    } catch { showToast('Failed to save times', 'error') } finally { setMarkingId(null) }
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
    if (att?.status === 'present') return { label: att.hours != null ? `Present · ${att.hours}h` : 'Present', bg: '#e8f0ec', text: GREEN }
    if (att?.status === 'absent') return { label: 'Absent', bg: '#fdecec', text: '#c0392b' }
    return { label: 'Absent', bg: '#f3f4f6', text: '#9ca3af' }
  }

  const smallBtn = (bg, color, border) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '6px 10px', borderRadius: 8, border: border || 'none',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', background: bg, color,
  })

  const machineNameById = {}
  for (const m of machines) machineNameById[m.id] = m.name

  // Split roster: app-user staff (grouped by role) vs login-less labour/drivers
  const staff = roster.filter(e => (e.worker_type || 'staff') === 'staff')
  const labour = roster.filter(e => ['labour','driver','operator'].includes(e.worker_type))

  // Group staff by role, preserving name order within each group
  const staffGroups = []
  const groupIndex = {}
  for (const e of staff) {
    const key = e.role || 'other'
    if (groupIndex[key] == null) { groupIndex[key] = staffGroups.length; staffGroups.push({ key, label: (key).replace(/_/g, ' '), members: [] }) }
    staffGroups[groupIndex[key]].members.push(e)
  }
  const isPresent = (att) => !!(att && (att.check_in_at || att.status === 'present'))

  // Reusable per-person row (status pill + supervisor mark controls + times expander)
  function renderPersonRow(e, idx, extra) {
    const pill = statusPill(e.att)
    const busy = markingId === e.id
    const markedByOther = e.att?.marked_by && e.att.marked_by !== e.id && e.markerName
    const isExpanded = expandedId === e.id
    const attIds = (e.att?.machine_ids?.length ? e.att.machine_ids : null) || (e.machine_ids?.length ? e.machine_ids : null) || (e.att?.machine_id ? [e.att.machine_id] : null) || (e.machine_id ? [e.machine_id] : null) || []
    const attachedNames = attIds.map(id => machineNameById[id]).filter(Boolean)
    return (
      <div key={e.id} style={{ borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.name}{e.id === employee?.id ? ' (You)' : ''}
              </div>
              {extra?.typeTag && (
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, background: '#f0ebe0', color: MUTED, borderRadius: 5, padding: '1px 5px', flexShrink: 0, textTransform: 'uppercase' }}>{extra.typeTag}</span>
              )}
            </div>
            {extra?.showRole && (
              <div style={{ fontSize: 10, color: MUTED, marginTop: 1, textTransform: 'capitalize' }}>{(e.role || '').replace(/_/g, ' ')}</div>
            )}
            {attachedNames.length > 0 && (
              <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>On: {attachedNames.join(', ')}</div>
            )}
            {e.labour_daily_wage != null && (
              <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>Wage: ₹{e.labour_daily_wage}/day</div>
            )}
            {markedByOther && (
              <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>Marked by {e.markerName}</div>
            )}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, background: pill.bg, color: pill.text, borderRadius: 7, padding: '3px 9px', flexShrink: 0 }}>
            {pill.label}
          </span>
        </div>
        {canMarkOthers && (
          <div style={{ display: 'flex', gap: 8, padding: '0 14px 11px', flexWrap: 'wrap' }}>
            <button disabled={busy} onClick={() => markStatus(e, 'present')} style={{ ...smallBtn('#e8f0ec', GREEN), opacity: busy ? 0.6 : 1 }}>
              {busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={12} />} Present
            </button>
            <button disabled={busy} onClick={() => markStatus(e, 'absent')} style={{ ...smallBtn('#fdecec', '#c0392b'), opacity: busy ? 0.6 : 1 }}>
              <Circle size={12} /> Absent
            </button>
            <button disabled={busy} onClick={() => toggleExpander(e)} style={{ ...smallBtn('#fff', DARK, `1.5px solid ${BORDER}`), opacity: busy ? 0.6 : 1 }}>
              <Clock size={12} /> Times/Hours {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {extra?.deletable && (
              <button disabled={deletingId === e.id} onClick={() => deleteLabourer(e)} style={{ ...smallBtn('#fff', '#c0392b', `1.5px solid ${BORDER}`), marginLeft: 'auto', opacity: deletingId === e.id ? 0.6 : 1 }}>
                {deletingId === e.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />} Remove
              </button>
            )}
          </div>
        )}
        {canMarkOthers && isExpanded && (
          <div style={{ padding: '0 14px 12px' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>Check in</div>
                <input type="time" value={timeIn} onChange={(ev) => setTimeIn(ev.target.value)} style={{ padding: '7px 8px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fefae0', fontSize: 13, color: TEXT, outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>Check out</div>
                <input type="time" value={timeOut} onChange={(ev) => setTimeOut(ev.target.value)} style={{ padding: '7px 8px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fefae0', fontSize: 13, color: TEXT, outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>Hours</div>
                <input type="number" step="0.5" min="0" value={hoursInput} onChange={(ev) => setHoursInput(ev.target.value)} placeholder="e.g. 8" style={{ width: 64, padding: '7px 8px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: '#fefae0', fontSize: 13, color: TEXT, outline: 'none' }} />
              </div>
              <button disabled={busy} onClick={() => saveTimesHours(e)} style={{ ...smallBtn(GREEN, '#fff'), padding: '8px 14px', opacity: busy ? 0.6 : 1 }}>
                {busy ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null} Save
              </button>
            </div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>Hours auto-fill from check-in/out; enter manually if only marking present.</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Attendance" subtitle={plant?.name || 'Plant'} backTo="/" />

      <div style={{ padding: '16px 20px 32px' }}>
        {/* My status / check-in-out */}
        <div style={sectionLabel}>My Attendance · Today</div>
        {!myTracksAttendance ? (
          <div style={{ ...cardStyle, padding: 16, marginBottom: 20, fontSize: 13, color: MUTED }}>
            Attendance isn't tracked for your role.
          </div>
        ) : (
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
                <MapPin size={12} /> Must be within {CHECK_IN_GEOFENCE_RADIUS_M} m of the plant. Location is required.
              </div>
            </>
          )}
        </div>
        )}

        {/* Staff roster — grouped by role, collapsible */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ ...sectionLabel, marginBottom: 0 }}>Staff · Who's In</div>
          {canMarkOthers && (
            <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${GREEN}`, background: '#fff', color: GREEN, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <UserPlus size={13} /> Add labourer
            </button>
          )}
        </div>
        {loadingRoster ? (
          <div style={{ ...cardStyle, marginBottom: 20, padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : staffGroups.length === 0 ? (
          <div style={{ ...cardStyle, marginBottom: 20, padding: 16, fontSize: 13, color: MUTED }}>No active staff.</div>
        ) : (
          staffGroups.map((g) => {
            const collapsed = !!collapsedRoles[g.key]
            const presentCount = g.members.filter(m => isPresent(m.att)).length
            return (
              <div key={g.key} style={{ ...cardStyle, marginBottom: 12 }}>
                <button
                  onClick={() => setCollapsedRoles(prev => ({ ...prev, [g.key]: !prev[g.key] }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: DARK, textTransform: 'capitalize' }}>{g.label}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{presentCount}/{g.members.length} present</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, background: '#f0ebe0', borderRadius: 7, padding: '3px 9px', flexShrink: 0 }}>{g.members.length}</span>
                  {collapsed ? <ChevronDown size={18} color={MUTED} /> : <ChevronUp size={18} color={MUTED} />}
                </button>
                {!collapsed && (
                  <div style={{ borderTop: `1px solid #f0ebe0` }}>
                    {canMarkOthers && g.members.some(m => !isPresent(m.att)) && (
                      <button disabled={markingAll} onClick={() => markAllPresent(g.members)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 14px 2px', padding: '7px 12px', borderRadius: 9, border: `1.5px solid ${GREEN}`, background: '#e8f0ec', color: GREEN, fontSize: 12, fontWeight: 700, cursor: markingAll ? 'default' : 'pointer', opacity: markingAll ? 0.6 : 1 }}>
                        {markingAll ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />} Mark all present
                      </button>
                    )}
                    {g.members.map((e, idx) => renderPersonRow(e, idx, { typeTag: (e.role || 'staff').replace(/_/g, ' ') }))}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Labour & Workers — separate section, only when marking others */}
        {canMarkOthers && (
          <>
            <div style={{ ...sectionLabel, marginTop: 8 }}>Labour &amp; Workers</div>
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              {loadingRoster ? (
                <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: 13 }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                </div>
              ) : labour.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: MUTED }}>No labourers yet. Use “Add labourer” to add today's workers.</div>
              ) : (
                <>
                  {labour.some(m => !isPresent(m.att)) && (
                    <button disabled={markingAll} onClick={() => markAllPresent(labour)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 14px 2px', padding: '7px 12px', borderRadius: 9, border: `1.5px solid ${GREEN}`, background: '#e8f0ec', color: GREEN, fontSize: 12, fontWeight: 700, cursor: markingAll ? 'default' : 'pointer', opacity: markingAll ? 0.6 : 1 }}>
                      {markingAll ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />} Mark all present
                    </button>
                  )}
                  {labour.map((e, idx) => renderPersonRow(e, idx, { typeTag: e.worker_type, deletable: true }))}
                </>
              )}
            </div>
          </>
        )}

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
                  const hrs = e.att?.hours != null ? `${e.att.hours}` : hoursBetween(e.att?.check_in_at, e.att?.check_out_at)
                  let detail = 'Absent'
                  if (e.att?.check_in_at) {
                    detail = `In ${fmtTime(e.att.check_in_at)}`
                    if (e.att?.check_out_at) detail += ` · Out ${fmtTime(e.att.check_out_at)}`
                  } else if (e.att?.status === 'present') {
                    detail = 'Present'
                  } else if (e.att?.status === 'absent') {
                    detail = 'Absent'
                  }
                  if (hrs) detail += ` · ${hrs} hrs`
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, background: '#f0ebe0', color: MUTED, borderRadius: 5, padding: '1px 5px', flexShrink: 0, textTransform: 'uppercase' }}>{(['labour','driver','operator'].includes(e.worker_type) ? e.worker_type : (e.role || 'staff')).replace(/_/g, ' ')}</span>
                        </div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{detail}{e.labour_daily_wage != null ? ` · ₹${e.labour_daily_wage}/day` : ''}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Add worker / labourer modal */}
      {showAdd && (
        <div onClick={() => !addSaving && setShowAdd(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
          <div onClick={(ev) => ev.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#fefae0', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: '18px 20px 24px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: DARK }}>Add worker / labourer</div>
              <button onClick={() => !addSaving && setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4 }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5 }}>Name *</div>
              <input value={addName} onChange={(ev) => setAddName(ev.target.value)} placeholder="Full name" style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 14, color: TEXT, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5 }}>Mobile (optional)</div>
              <input value={addMobile} onChange={(ev) => setAddMobile(ev.target.value)} placeholder="Phone number" inputMode="tel" style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 14, color: TEXT, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5 }}>Type</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['labour', 'driver', 'operator'].map((t) => (
                  <button key={t} onClick={() => setAddType(t)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${addType === t ? GREEN : BORDER}`, background: addType === t ? '#e8f0ec' : '#fff', color: addType === t ? GREEN : MUTED, fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5 }}>Daily wage ₹ (optional)</div>
              <input value={addWage} onChange={(ev) => setAddWage(ev.target.value)} placeholder="e.g. 500" inputMode="numeric" type="number" min="0" style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', fontSize: 14, color: TEXT, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5 }}>Attach to machines (optional) — tap any</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {machines.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>No machines configured.</div>}
                {machines.map((m) => {
                  const on = addMachineIds.includes(m.id)
                  return (
                    <button key={m.id} type="button" onClick={() => setAddMachineIds(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id])} style={{ padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${on ? GREEN : BORDER}`, background: on ? '#e8f0ec' : '#fff', color: on ? GREEN : MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{m.name}</button>
                  )
                })}
              </div>
            </div>
            <button onClick={handleAddLabourer} disabled={addSaving || !addName.trim()} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 12, border: 'none', background: (addSaving || !addName.trim()) ? '#c3d2c9' : GREEN, color: '#fff', fontSize: 14, fontWeight: 700, cursor: (addSaving || !addName.trim()) ? 'default' : 'pointer' }}>
              {addSaving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={16} />} Add worker
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
