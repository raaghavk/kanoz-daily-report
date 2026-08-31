import { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { can, PERMISSION_CATALOG } from '../lib/permissions'
import { showToast } from '../components/Toast'

const CREAM = '#fefae0'
const GREEN = '#2d6a4f'
const DGREEN = '#1b4332'
const BORDER = '#e5ddd0'
const MUTED = '#8a8d7a'
const TEXT = '#2c2c2c'

function labelFor(key) {
  const item = PERMISSION_CATALOG.find(p => p.key === key)
  return item ? item.label : key
}

function permsSummary(perms) {
  const list = Array.isArray(perms) ? perms : []
  if (list.length === 0) return 'No permissions'
  const labels = list.map(labelFor)
  const shown = labels.slice(0, 3).join(', ')
  const extra = labels.length - 3
  return extra > 0 ? `${shown} +${extra}` : shown
}

function RoleModal({ initial, onClose, onSave, saving }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [checked, setChecked] = useState(() => {
    const set = new Set(Array.isArray(initial?.permissions) ? initial.permissions : [])
    return set
  })
  const [trackAttendance, setTrackAttendance] = useState(initial?.track_attendance !== false)
  const [receiveTasks, setReceiveTasks] = useState(initial?.receive_tasks !== false)

  function toggle(key) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function submit() {
    if (!name.trim()) {
      showToast('Role name is required')
      return
    }
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      permissions: PERMISSION_CATALOG.filter(p => checked.has(p.key)).map(p => p.key),
      track_attendance: trackAttendance,
      receive_tasks: receiveTasks,
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, maxHeight: '92vh', borderTopLeftRadius: 20, borderTopRightRadius: 20, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: DGREEN }}>{initial ? 'Edit Role' : 'Add Role'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color={MUTED} />
          </button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>Role Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Shift In-charge"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 14, color: TEXT, boxSizing: 'border-box', marginBottom: 14 }}
          />
          <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Short description of this role"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 14, color: TEXT, boxSizing: 'border-box', marginBottom: 18 }}
          />
          <button
            onClick={() => setTrackAttendance(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${trackAttendance ? GREEN : BORDER}`, background: trackAttendance ? '#f0f5f1' : '#fff', cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 10 }}
          >
            <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${trackAttendance ? GREEN : BORDER}`, background: trackAttendance ? GREEN : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {trackAttendance && <Check size={14} color="#fff" />}
            </span>
            <span style={{ fontSize: 13.5, color: TEXT, fontWeight: 500 }}>Track attendance for this role<br/><span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>Turn off so people with this role are not marked (e.g. Admin/owner).</span></span>
          </button>
          <button
            onClick={() => setReceiveTasks(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${receiveTasks ? GREEN : BORDER}`, background: receiveTasks ? '#f0f5f1' : '#fff', cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 16 }}
          >
            <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${receiveTasks ? GREEN : BORDER}`, background: receiveTasks ? GREEN : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {receiveTasks && <Check size={14} color="#fff" />}
            </span>
            <span style={{ fontSize: 13.5, color: TEXT, fontWeight: 500 }}>Can be assigned tasks<br/><span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>Turn off so this role never appears in the assign-task picker (e.g. Admin).</span></span>
          </button>
          <label style={{ fontSize: 12, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 10 }}>Permissions</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PERMISSION_CATALOG.map(p => {
              const on = checked.has(p.key)
              return (
                <button
                  key={p.key}
                  onClick={() => toggle(p.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${on ? GREEN : BORDER}`, background: on ? '#f0f5f1' : '#fff', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${on ? GREEN : BORDER}`, background: on ? GREEN : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {on && <Check size={14} color="#fff" />}
                  </span>
                  <span style={{ fontSize: 13.5, color: TEXT, fontWeight: 500 }}>{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ padding: '14px 18px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{ flex: 1, padding: '12px 0', background: '#fff', color: TEXT, borderRadius: 12, fontSize: 14, fontWeight: 700, border: `1.5px solid ${BORDER}`, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '12px 0', background: GREEN, color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RolesPage() {
  const { employee } = useAuth()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { mode: 'add' | 'edit', role }
  const [saving, setSaving] = useState(false)

  const allowed = can(employee?.role, 'manage_users')
  const orgId = employee?.org_id

  const fetchRoles = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('org_id', orgId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      setRoles(data || [])
    } catch (err) {
      console.error('Error fetching roles:', err)
      showToast('Could not load roles')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    if (allowed) fetchRoles()
    else setLoading(false)
  }, [allowed, fetchRoles])

  async function handleSave(payload) {
    setSaving(true)
    try {
      if (modal?.mode === 'edit' && modal.role) {
        const { error } = await supabase
          .from('roles')
          .update({ name: payload.name, description: payload.description, permissions: payload.permissions, track_attendance: payload.track_attendance, receive_tasks: payload.receive_tasks })
          .eq('id', modal.role.id)
        if (error) throw error
        showToast('Role updated')
      } else {
        const { error } = await supabase
          .from('roles')
          .insert({ org_id: orgId, name: payload.name, description: payload.description, permissions: payload.permissions, is_default: false, track_attendance: payload.track_attendance, receive_tasks: payload.receive_tasks })
        if (error) throw error
        showToast('Role created')
      }
      setModal(null)
      await fetchRoles()
    } catch (err) {
      console.error('Error saving role:', err)
      showToast('Could not save role')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(role) {
    if (!window.confirm('Delete this role? Employees with it will lose its permissions until reassigned.')) return
    try {
      const { error } = await supabase.from('roles').delete().eq('id', role.id)
      if (error) throw error
      showToast('Role deleted')
      await fetchRoles()
    } catch (err) {
      console.error('Error deleting role:', err)
      showToast('Could not delete role')
    }
  }

  if (!allowed) {
    return (
      <div style={{ minHeight: '100%', background: CREAM, padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: 24, textAlign: 'center', marginTop: 40 }}>
          <Shield size={32} color={MUTED} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Access denied</div>
          <div style={{ fontSize: 13, color: MUTED }}>You don't have permission to manage roles.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', background: CREAM, paddingBottom: 40 }}>
      <div style={{ padding: '18px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={22} color={GREEN} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: DGREEN }}>Roles</div>
            <div style={{ fontSize: 12, color: MUTED }}>Manage roles & permissions</div>
          </div>
        </div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: GREEN, color: '#fff', borderRadius: 12, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: MUTED, fontSize: 13 }}>Loading…</div>
        ) : roles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: MUTED, fontSize: 13 }}>No roles yet. Add one to get started.</div>
        ) : (
          roles.map(role => (
            <div key={role.id} style={{ background: '#fff', borderRadius: 16, border: `1px solid ${BORDER}`, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Shield size={18} color={GREEN} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{role.name}</span>
                      {role.is_default && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, background: '#e7f0ea', padding: '2px 7px', borderRadius: 6, letterSpacing: 0.5 }}>DEFAULT</span>
                      )}
                    </div>
                    {role.description && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>{role.description}</div>}
                    <div style={{ fontSize: 12, color: '#595c4a', marginTop: 6 }}>{permsSummary(role.permissions)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setModal({ mode: 'edit', role })} style={{ padding: 8, background: '#f5f2e8', border: `1px solid ${BORDER}`, borderRadius: 9, cursor: 'pointer' }}>
                    <Pencil size={15} color={GREEN} />
                  </button>
                  <button onClick={() => handleDelete(role)} style={{ padding: 8, background: '#fdecec', border: '1px solid #f3d4d4', borderRadius: 9, cursor: 'pointer' }}>
                    <Trash2 size={15} color="#DC2626" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <RoleModal
          initial={modal.mode === 'edit' ? modal.role : null}
          onClose={() => !saving && setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}
