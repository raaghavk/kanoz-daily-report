import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { can } from '../../lib/permissions'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import { Loader2, Plus, CheckCircle, Circle, Archive, CalendarDays, User, Trash2 } from 'lucide-react'
import { getLocalDate } from '../../lib/dateUtils'

const STATUS_META = {
  open:   { label: 'Open',     bg: '#EEF2FF', text: '#2563EB', border: '#c7d2fe' },
  done:   { label: 'Done',     bg: '#e8f0ec', text: '#2d6a4f', border: '#a7c4b5' },
  closed: { label: 'Closed',   bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 12,
  border: '1.5px solid #e5ddd0', background: '#fefae0',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#8a8d7a', marginBottom: 6,
}

export default function TasksPage() {
  const { plant, employee } = useAuth()
  const navigate = useNavigate()
  const role = employee?.role
  const canAssign = can(role, 'assign_tasks')
  const isAdmin = role === 'admin'

  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [allPlants, setAllPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('open')
  const [filterPlant, setFilterPlant] = useState(plant?.id || '')

  // Assign modal
  const [showAssign, setShowAssign] = useState(false)
  const [assignForm, setAssignForm] = useState({ title: '', due_date: '', assigned_to_employee_id: '', plant_id: '' })
  const [submitting, setSubmitting] = useState(false)

  // Mark done modal
  const [showDone, setShowDone] = useState(null)
  const [doneNote, setDoneNote] = useState('')

  // Close task modal
  const [showClose, setShowClose] = useState(null)

  // Delete task (admin / task creator only)
  const [deletingId, setDeletingId] = useState(null)

  // Keep filterPlant in sync when plant changes (e.g. first load)
  useEffect(() => { if (plant?.id && !filterPlant) setFilterPlant(plant.id) }, [plant]) // eslint-disable-line
  useEffect(() => { if (plant?.id) load() }, [plant, filterStatus, filterPlant]) // eslint-disable-line
  useEffect(() => { if (isAdmin && plant?.org_id) loadAllPlants() }, [isAdmin, plant]) // eslint-disable-line
  useEffect(() => { if (canAssign && plant?.id) loadEmployees(assignForm.plant_id || plant.id) }, [canAssign, plant, assignForm.plant_id]) // eslint-disable-line

  async function loadAllPlants() {
    try {
      const { data } = await supabase.from('plants').select('id, name').eq('org_id', plant.org_id).eq('is_active', true).order('name')
      setAllPlants(data || [])
    } catch { /* silent */ }
  }

  async function load() {
    setLoading(true)
    try {
      let query = supabase
        .from('tasks')
        .select(`
          id, title, due_date, status, completion_note, created_at, done_at, closed_at,
          assigned_to_employee_id, assigned_by_employee_id, plant_id,
          assignee:employees!tasks_assigned_to_employee_id_fkey(id, name),
          assigner:employees!tasks_assigned_by_employee_id_fkey(id, name),
          plant:plants(name)
        `)
        .order('created_at', { ascending: false })

      // Filter by plant — 'all' only available to admin
      if (filterPlant === 'all' && isAdmin) {
        query = query.eq('org_id', plant.org_id)
      } else {
        query = query.eq('plant_id', filterPlant || plant.id)
      }

      if (filterStatus !== 'all') query = query.eq('status', filterStatus)

      const { data, error } = await query
      if (error) throw error

      // Non-assigners only see tasks assigned to them
      if (!canAssign) {
        setTasks((data || []).filter(t => t.assigned_to_employee_id === employee?.id))
      } else {
        setTasks(data || [])
      }
    } catch { showToast('Failed to load tasks', 'error') } finally { setLoading(false) }
  }

  async function loadEmployees(plantId) {
    try {
      const { data } = await supabase
        .from('employees')
        .select('id, name, role')
        .eq('plant_id', plantId)
        .eq('is_active', true)
        .order('name')
      setEmployees((data || []).filter(e => e.id !== employee?.id))
    } catch { /* silent */ }
  }

  async function handleAssign() {
    if (!assignForm.title.trim()) { showToast('Enter a task title', 'error'); return }
    if (!assignForm.assigned_to_employee_id) { showToast('Select who to assign to', 'error'); return }
    const targetPlantId = assignForm.plant_id || plant.id
    setSubmitting(true)
    try {
      const { error } = await supabase.from('tasks').insert([{
        org_id: plant.org_id,
        plant_id: targetPlantId,
        title: assignForm.title.trim(),
        due_date: assignForm.due_date || null,
        assigned_to_employee_id: assignForm.assigned_to_employee_id,
        assigned_by_employee_id: employee?.id || null,
        status: 'open',
      }])
      if (error) throw error
      showToast('Task assigned!', 'success')
      // Notify assignee
      import('../../lib/notifications').then(({ sendNotification }) => {
        sendNotification('task_assigned', {
          task_title: assignForm.title.trim(),
          assigned_by: employee?.name || 'Someone',
          due_date: assignForm.due_date || null,
          assignee_employee_id: assignForm.assigned_to_employee_id,
        })
      }).catch(() => {})
      setAssignForm({ title: '', due_date: '', assigned_to_employee_id: '', plant_id: '' })
      setShowAssign(false)
      load()
    } catch { showToast('Failed to assign task', 'error') } finally { setSubmitting(false) }
  }

  async function handleMarkDone(task) {
    setSubmitting(true)
    try {
      const { error } = await supabase.from('tasks').update({
        status: 'done',
        completion_note: doneNote.trim() || null,
        done_at: new Date().toISOString(),
      }).eq('id', task.id)
      if (error) throw error
      showToast('Marked as done!', 'success')
      setShowDone(null)
      setDoneNote('')
      load()
    } catch { showToast('Failed to update', 'error') } finally { setSubmitting(false) }
  }

  async function handleClose(task) {
    setSubmitting(true)
    try {
      const { error } = await supabase.from('tasks').update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      }).eq('id', task.id)
      if (error) throw error
      showToast('Task closed', 'success')
      // Notify the assignee that their task was closed
      if (task.assigned_to_employee_id) {
        import('../../lib/notifications').then(({ sendNotification }) => {
          sendNotification('task_updated', {
            task_title: task.title,
            new_status: 'closed',
            assignee_employee_id: task.assigned_to_employee_id,
          })
        }).catch(() => {})
      }
      setShowClose(null)
      load()
    } catch { showToast('Failed to close task', 'error') } finally { setSubmitting(false) }
  }

  async function handleDelete(taskId) {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    setDeletingId(taskId)
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
      showToast('Task deleted', 'success')
      load()
    } catch { showToast('Failed to delete task', 'error') } finally { setDeletingId(null) }
  }

  const fmtDate = d => d ? new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null
  const isOverdue = d => d && new Date(d + 'T00:00') < new Date(new Date().toDateString())

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader
        title="Tasks"
        subtitle={filterPlant === 'all' ? 'All Plants · Assigned work' : `${plant?.name} · Assigned work`}
        onBack={() => navigate('/')}
      />

      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Admin: Plant filter */}
        {isAdmin && allPlants.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            <button onClick={() => setFilterPlant('all')}
              style={{
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                border: `1.5px solid ${filterPlant === 'all' ? '#d4a373' : '#e5ddd0'}`,
                background: filterPlant === 'all' ? '#d4a373' : '#fff',
                color: filterPlant === 'all' ? 'white' : '#595c4a',
                fontSize: 12, fontWeight: 600,
              }}>All Plants</button>
            {allPlants.map(p => (
              <button key={p.id} onClick={() => setFilterPlant(p.id)}
                style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                  border: `1.5px solid ${filterPlant === p.id ? '#2d6a4f' : '#e5ddd0'}`,
                  background: filterPlant === p.id ? '#2d6a4f' : '#fff',
                  color: filterPlant === p.id ? 'white' : '#595c4a',
                  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                }}>{p.name}</button>
            ))}
          </div>
        )}

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {['open', 'done', 'closed', 'all'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                border: `1.5px solid ${filterStatus === s ? '#2d6a4f' : '#e5ddd0'}`,
                background: filterStatus === s ? '#2d6a4f' : '#fff',
                color: filterStatus === s ? 'white' : '#595c4a',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={28} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8a8d7a' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {filterStatus === 'open' ? 'No open tasks' : 'No tasks here'}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {canAssign ? 'Tap + to assign a task' : 'Nothing assigned to you right now'}
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            {tasks.map((task, idx) => {
              const sm = STATUS_META[task.status] || STATUS_META.open
              const overdue = task.status === 'open' && isOverdue(task.due_date)
              const isAssignedToMe = task.assigned_to_employee_id === employee?.id
              const iAmCreator = task.assigned_by_employee_id === employee?.id
              const canDelete = isAdmin || iAmCreator
              // Admin / creator can close any non-closed task directly
              const canForceClose = canAssign && task.status !== 'closed' && (iAmCreator || isAdmin)

              return (
                <div key={task.id} style={{
                  borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none',
                  padding: '12px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  {/* Status icon / action button */}
                  <button
                    onClick={() => {
                      if (task.status === 'open' && isAssignedToMe) { setShowDone(task); setDoneNote('') }
                      else if (task.status === 'done' && canAssign) { setShowClose(task) }
                      else if (task.status === 'open' && canForceClose) { setShowClose(task) }
                    }}
                    style={{
                      background: 'none', border: 'none', cursor:
                        (task.status === 'open' && (isAssignedToMe || canForceClose)) || (task.status === 'done' && canAssign)
                          ? 'pointer' : 'default',
                      padding: 0, marginTop: 2, flexShrink: 0,
                    }}
                    title={
                      task.status === 'open' && isAssignedToMe ? 'Mark as done' :
                      task.status === 'open' && canForceClose ? 'Close task' :
                      task.status === 'done' && canAssign ? 'Close / archive task' : ''
                    }
                  >
                    {task.status === 'closed'
                      ? <Archive size={20} color="#9ca3af" />
                      : task.status === 'done'
                      ? <CheckCircle size={20} color="#2d6a4f" />
                      : <Circle size={20} color={overdue ? '#dc2626' : '#d1d5db'} />
                    }
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: task.status === 'closed' ? '#9ca3af' : '#2c2c2c' }}>
                      {task.title}
                    </div>

                    {/* Assignee / assigner */}
                    <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {filterPlant === 'all' && task.plant?.name && (
                        <span style={{ background: '#f0f7f3', color: '#2d6a4f', borderRadius: 5, padding: '1px 6px', fontWeight: 700, fontSize: 10 }}>
                          {task.plant.name}
                        </span>
                      )}
                      {task.assignee?.name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <User size={10} /> {task.assignee.name}
                        </span>
                      )}
                      {task.due_date && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: overdue ? '#dc2626' : '#8a8d7a' }}>
                          <CalendarDays size={10} /> {fmtDate(task.due_date)}{overdue ? ' · Overdue' : ''}
                        </span>
                      )}
                    </div>

                    {/* Completion note */}
                    {task.completion_note && (
                      <div style={{ fontSize: 11, color: '#2d6a4f', marginTop: 3, fontStyle: 'italic' }}>
                        "{task.completion_note}"
                      </div>
                    )}

                    {/* Hint for action */}
                    {task.status === 'open' && isAssignedToMe && (
                      <div style={{ fontSize: 11, color: '#2563EB', marginTop: 3 }}>Tap circle to mark done</div>
                    )}
                    {task.status === 'open' && canForceClose && !isAssignedToMe && (
                      <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 3 }}>Tap circle to close</div>
                    )}
                    {task.status === 'done' && canAssign && (
                      <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 3 }}>Tap ✓ to close & archive</div>
                    )}
                  </div>

                  {/* Right side: status badge + delete */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      background: sm.bg, color: sm.text,
                      border: `1px solid ${sm.border}`,
                      borderRadius: 8, padding: '3px 8px',
                    }}>{sm.label}</span>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(task.id)}
                        disabled={deletingId === task.id}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, opacity: deletingId === task.id ? 0.4 : 0.5,
                          display: 'flex', alignItems: 'center',
                        }}
                        title="Delete task"
                      >
                        <Trash2 size={14} color="#dc2626" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB — only for assigners */}
      {canAssign && (
        <button
          onClick={() => setShowAssign(true)}
          style={{
            position: 'fixed', bottom: 88, right: 20, width: 56, height: 56,
            borderRadius: '50%', background: '#2d6a4f', color: 'white',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(45,106,79,0.35)', zIndex: 50,
          }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* Assign Task Modal */}
      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assign Task">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Task <span style={{ color: '#d32f2f' }}>*</span></label>
            <input
              type="text"
              value={assignForm.title}
              onChange={e => setAssignForm({ ...assignForm, title: e.target.value })}
              placeholder="e.g., Check conveyor belt tension"
              style={inputStyle}
              maxLength={120}
            />
          </div>
          {/* Admin: plant selector for assigning to any plant */}
          {isAdmin && allPlants.length > 1 && (
            <div>
              <label style={labelStyle}>Plant <span style={{ color: '#d32f2f' }}>*</span></label>
              <select
                value={assignForm.plant_id || plant.id}
                onChange={e => setAssignForm({ ...assignForm, plant_id: e.target.value, assigned_to_employee_id: '' })}
                style={inputStyle}
              >
                {allPlants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={labelStyle}>Assign To <span style={{ color: '#d32f2f' }}>*</span></label>
            <select
              value={assignForm.assigned_to_employee_id}
              onChange={e => setAssignForm({ ...assignForm, assigned_to_employee_id: e.target.value })}
              style={{ ...inputStyle, color: assignForm.assigned_to_employee_id ? '#2c2c2c' : '#8a8d7a' }}
            >
              <option value="">Select employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} · {emp.role}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              value={assignForm.due_date}
              onChange={e => setAssignForm({ ...assignForm, due_date: e.target.value })}
              style={inputStyle}
              min={getLocalDate()}
            />
          </div>
          <div style={{ background: '#EEF2FF', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#2563EB' }}>
            📌 Assigned by: <strong>{employee?.name || 'You'}</strong>
          </div>
          <button
            onClick={handleAssign}
            disabled={submitting}
            style={{
              width: '100%', padding: '13px 0', background: '#2d6a4f',
              color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700,
              border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Assigning...' : 'Assign Task'}
          </button>
        </div>
      </Modal>

      {/* Mark Done Modal */}
      {showDone && (
        <Modal isOpen={!!showDone} onClose={() => setShowDone(null)} title="Mark as Done">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>
              {showDone.title}
            </div>
            <div>
              <label style={labelStyle}>Completion Note (optional)</label>
              <textarea
                value={doneNote}
                onChange={e => setDoneNote(e.target.value)}
                placeholder="Any notes on how it was completed…"
                rows={3}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>
            <button
              onClick={() => handleMarkDone(showDone)}
              disabled={submitting}
              style={{
                width: '100%', padding: '13px 0', background: '#2d6a4f',
                color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700,
                border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Saving...' : 'Mark as Done ✓'}
            </button>
          </div>
        </Modal>
      )}

      {/* Close Task Modal */}
      {showClose && (
        <Modal isOpen={!!showClose} onClose={() => setShowClose(null)} title="Close Task">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>
              {showClose.title}
            </div>
            {showClose.completion_note && (
              <div style={{ background: '#e8f0ec', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#2d6a4f', fontStyle: 'italic' }}>
                "{showClose.completion_note}"
              </div>
            )}
            <div style={{ fontSize: 13, color: '#595c4a' }}>
              Closing will archive this task. It will no longer appear in Open or Done filters.
            </div>
            <button
              onClick={() => handleClose(showClose)}
              disabled={submitting}
              style={{
                width: '100%', padding: '13px 0', background: '#6b7280',
                color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700,
                border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Closing...' : 'Close & Archive'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
