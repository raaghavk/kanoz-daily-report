import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { ROLE_OPTIONS } from '../lib/permissions'
import { UserPlus, Edit2, Shield, ChevronLeft, Phone, MapPin, Check, X, Loader2, Key } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ROLE_BADGE = {
  admin:            { bg: '#e8f0ec', text: '#2d6a4f',  label: 'Admin' },
  plant_manager:    { bg: '#FEF3C7', text: '#d97706',  label: 'Plant Mgr' },
  supervisor:       { bg: '#EBF4FF', text: '#3B82F6',  label: 'Supervisor' },
  purchase_manager: { bg: '#fefae0', text: '#d4a373',  label: 'Purchase Mgr' },
  accountant:       { bg: '#F3E8FF', text: '#7C3AED',  label: 'Accountant' },
}

export default function UserManagement() {
  const { employee } = useAuth()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [plants, setPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showAccess, setShowAccess] = useState(null) // employee object
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [toast, setToast] = useState(null)

  const [form, setForm] = useState({ name: '', mobile: '', role: 'supervisor', plant_id: '', is_active: true })
  const [accessForm, setAccessForm] = useState({ email: '', password: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)

  const isAdmin = employee?.role === 'admin'

  useEffect(() => { if (isAdmin) loadData() }, [isAdmin]) // eslint-disable-line

  if (!isAdmin) return (
    <div style={{ padding: 20, textAlign: 'center', paddingTop: 80 }}>
      <Shield size={48} color="#d32f2f" style={{ margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2c2c2c', marginBottom: 8 }}>Access Denied</h2>
      <p style={{ fontSize: 14, color: '#595c4a' }}>Only admins can manage users.</p>
    </div>
  )

  async function loadData() {
    setLoading(true)
    try {
      const [empRes, plantRes] = await Promise.all([
        supabase.from('employees').select('*, plants(name)').eq('org_id', employee.org_id).order('name'),
        supabase.from('plants').select('*').eq('org_id', employee.org_id).eq('is_active', true).order('name')
      ])
      if (empRes.data) setEmployees(empRes.data)
      if (plantRes.data) setPlants(plantRes.data)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openAddForm() {
    setForm({ name: '', mobile: '', role: 'supervisor', plant_id: plants[0]?.id || '', is_active: true })
    setEditingId(null)
    setShowForm(true)
  }

  function openEditForm(emp) {
    setForm({ name: emp.name, mobile: emp.mobile || '', role: emp.role, plant_id: emp.plant_id || '', is_active: emp.is_active })
    setEditingId(emp.id)
    setShowForm(true)
  }

  async function saveEmployee() {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return }
    if (!form.plant_id) { showToast('Please select a plant', 'error'); return }
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('employees').update({
          name: form.name.trim(), mobile: form.mobile.trim() || null,
          role: form.role, plant_id: form.plant_id,
          is_active: form.is_active, updated_at: new Date().toISOString()
        }).eq('id', editingId)
        if (error) throw error
        showToast('Employee updated')
      } else {
        const { error } = await supabase.from('employees').insert({
          name: form.name.trim(), mobile: form.mobile.trim() || null,
          role: form.role, plant_id: form.plant_id,
          org_id: employee.org_id, is_active: form.is_active
        })
        if (error) throw error
        showToast('Employee added')
      }
      setShowForm(false)
      loadData()
    } catch (err) { showToast(err.message, 'error') } finally { setSaving(false) }
  }

  async function grantAccess() {
    const { email, password, confirmPassword } = accessForm
    if (!email.trim()) { showToast('Email is required', 'error'); return }
    if (!password) { showToast('Password is required', 'error'); return }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return }
    if (password !== confirmPassword) { showToast('Passwords do not match', 'error'); return }

    setInviting(true)
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: email.trim(), password, employee_id: showAccess.id }
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      showToast(`✓ Login created for ${showAccess.name}`)
      setShowAccess(null)
      setAccessForm({ email: '', password: '', confirmPassword: '' })
      loadData()
    } catch (err) {
      showToast(err.message || 'Failed to create login', 'error')
    } finally { setInviting(false) }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1.5px solid #e5ddd0', background: '#fefae0', color: '#2c2c2c',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }

  if (loading) return (
    <div style={{ padding: 20, textAlign: 'center', paddingTop: 80 }}>
      <Loader2 size={32} color="#2d6a4f" style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    </div>
  )

  const active = employees.filter(e => e.is_active)
  const inactive = employees.filter(e => !e.is_active)

  return (
    <div style={{ minHeight: '100vh', background: '#fefae0' }}>
      {/* Header */}
      <div style={{ background: '#1b4332', color: 'white', padding: '14px 20px', paddingTop: 'max(14px, env(safe-area-inset-top))', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <ChevronLeft size={22} />
          </button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Team</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 1 }}>{active.length} active · {employees.length} total</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Add button */}
        <button onClick={openAddForm} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '12px 0', background: '#2d6a4f', color: 'white',
          borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          <UserPlus size={17} /> Add Team Member
        </button>

        {/* Active employees */}
        {active.map(emp => <EmployeeCard key={emp.id} emp={emp} onEdit={openEditForm} onAccess={() => { setShowAccess(emp); setAccessForm({ email: '', password: '', confirmPassword: '' }); setShowPw(false) }} />)}

        {/* Inactive */}
        {inactive.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, paddingLeft: 4 }}>Inactive</div>
            {inactive.map(emp => <EmployeeCard key={emp.id} emp={emp} onEdit={openEditForm} onAccess={() => { setShowAccess(emp); setAccessForm({ email: '', password: '', confirmPassword: '' }) }} />)}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 24, maxHeight: '88vh', overflowY: 'auto', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#2c2c2c' }}>{editingId ? 'Edit' : 'Add'} Team Member</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={22} color="#8a8d7a" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </div>
              <div>
                <label style={labelStyle}>Mobile</label>
                <input style={inputStyle} type="tel" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="Phone number" />
              </div>
              <div>
                <label style={labelStyle}>Role *</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 4 }}>{ROLE_OPTIONS.find(r => r.value === form.role)?.description}</div>
              </div>
              <div>
                <label style={labelStyle}>Plant *</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.plant_id} onChange={e => setForm({ ...form, plant_id: e.target.value })}>
                  <option value="">Select Plant</option>
                  {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {editingId && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f9f9', borderRadius: 10, padding: '10px 14px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>Active</span>
                  <button onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: form.is_active ? '#2d6a4f' : '#D1D5DB', position: 'relative', transition: 'background 0.2s' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: form.is_active ? 21 : 3, transition: 'left 0.2s' }} />
                  </button>
                </div>
              )}
              <button onClick={saveEmployee} disabled={saving}
                style={{ width: '100%', padding: '13px 0', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1, marginTop: 4 }}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant App Access Modal */}
      {showAccess && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 24, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#2c2c2c' }}>Grant App Access</div>
              <button onClick={() => setShowAccess(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={22} color="#8a8d7a" /></button>
            </div>
            <div style={{ fontSize: 13, color: '#595c4a', marginBottom: 18 }}>
              Setting up login for <strong>{showAccess.name}</strong>. Create their email and password — share these with them directly.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} type="email" value={accessForm.email} onChange={e => setAccessForm({ ...accessForm, email: e.target.value })} placeholder="their@email.com" autoComplete="off" />
              </div>
              <div>
                <label style={labelStyle}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inputStyle, paddingRight: 44 }} type={showPw ? 'text' : 'password'} value={accessForm.password} onChange={e => setAccessForm({ ...accessForm, password: e.target.value })} placeholder="Minimum 6 characters" autoComplete="new-password" />
                  <button onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#8a8d7a', fontWeight: 600 }}>{showPw ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Confirm Password *</label>
                <input style={{ ...inputStyle, border: accessForm.confirmPassword && accessForm.confirmPassword !== accessForm.password ? '1.5px solid #d32f2f' : '1.5px solid #e5ddd0' }}
                  type={showPw ? 'text' : 'password'} value={accessForm.confirmPassword} onChange={e => setAccessForm({ ...accessForm, confirmPassword: e.target.value })} placeholder="Repeat password" autoComplete="new-password" />
                {accessForm.confirmPassword && accessForm.confirmPassword !== accessForm.password && (
                  <div style={{ fontSize: 11, color: '#d32f2f', marginTop: 3 }}>Passwords do not match</div>
                )}
              </div>
              <div style={{ background: '#fefae0', border: '1px solid #e5ddd0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#595c4a' }}>
                📋 Share the app URL + email + password with {showAccess.name} via WhatsApp or in person.
              </div>
              <button onClick={grantAccess} disabled={inviting}
                style={{ width: '100%', padding: '13px 0', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: inviting ? 0.7 : 1 }}>
                {inviting ? 'Creating Login...' : 'Create Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#d32f2f' : '#2d6a4f', color: 'white', padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function EmployeeCard({ emp, onEdit, onAccess }) {
  const badge = ROLE_BADGE[emp.role] || { bg: '#EBF4FF', text: '#3B82F6', label: emp.role }
  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: '12px 14px', opacity: emp.is_active ? 1 : 0.55 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* Left: name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#2c2c2c' }}>{emp.name}</span>
            {!emp.is_active && <span style={{ fontSize: 10, background: '#FED7D7', color: '#d32f2f', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>Inactive</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 8px', borderRadius: 20, background: badge.bg, color: badge.text }}>
              {badge.label}
            </span>
            {emp.plants && (
              <span style={{ fontSize: 11, color: '#8a8d7a', display: 'flex', alignItems: 'center', gap: 3 }}>
                <MapPin size={11} /> {emp.plants.name}
              </span>
            )}
            {emp.mobile && (
              <span style={{ fontSize: 11, color: '#8a8d7a', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Phone size={11} /> {emp.mobile}
              </span>
            )}
          </div>
          {/* Access status */}
          <div style={{ marginTop: 5, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            {emp.auth_user_id
              ? <span style={{ color: '#2d6a4f', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><Check size={11} /> App access active</span>
              : <span style={{ color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}><X size={11} /> No app access yet</span>
            }
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onEdit(emp)}
            style={{ width: 34, height: 34, borderRadius: 10, border: '1.5px solid #e5ddd0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Edit2 size={14} color="#595c4a" />
          </button>
          {!emp.auth_user_id && (
            <button onClick={onAccess}
              style={{ height: 34, padding: '0 12px', borderRadius: 10, border: 'none', background: '#2d6a4f', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <Key size={13} /> Set Login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
