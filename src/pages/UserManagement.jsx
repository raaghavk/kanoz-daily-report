import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { UserPlus, Edit2, Shield, ShieldOff, Eye, EyeOff, ChevronLeft, Phone, Mail, MapPin, Check, X, Loader2, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function UserManagement() {
  const { employee } = useAuth()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [plants, setPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showInvite, setShowInvite] = useState(null) // employee id
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [toast, setToast] = useState(null)

  // Form state
  const [form, setForm] = useState({ name: '', mobile: '', role: 'supervisor', plant_id: '', is_active: true })
  // Invite form state
  const [inviteForm, setInviteForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)

  const isAdmin = employee?.role === 'admin'

  useEffect(() => {
    if (isAdmin) loadData()
  }, [isAdmin])

  // Check admin access (after all hooks)
  if (!isAdmin) {
    return (
      <div style={{ padding: 20, textAlign: 'center', paddingTop: 80 }}>
        <Shield size={48} color="#E53E3E" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>Access Denied</h2>
        <p style={{ fontSize: 14, color: '#5A6B62' }}>Only admins can manage users.</p>
      </div>
    )
  }

  async function loadData() {
    setLoading(true)
    try {
      const [empRes, plantRes] = await Promise.all([
        supabase.from('employees').select('*, plants(name)').eq('org_id', employee.org_id).order('name'),
        supabase.from('plants').select('*').eq('org_id', employee.org_id).eq('is_active', true).order('name')
      ])
      if (empRes.data) setEmployees(empRes.data)
      if (plantRes.data) setPlants(plantRes.data)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
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
          name: form.name.trim(),
          mobile: form.mobile.trim() || null,
          role: form.role,
          plant_id: form.plant_id,
          is_active: form.is_active,
          updated_at: new Date().toISOString()
        }).eq('id', editingId)
        if (error) throw error
        showToast('Employee updated')
      } else {
        const { error } = await supabase.from('employees').insert({
          name: form.name.trim(),
          mobile: form.mobile.trim() || null,
          role: form.role,
          plant_id: form.plant_id,
          org_id: employee.org_id,
          is_active: form.is_active
        })
        if (error) throw error
        showToast('Employee added')
      }
      setShowForm(false)
      loadData()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function inviteUser() {
    if (!inviteForm.email.trim()) { showToast('Email is required', 'error'); return }
    if (!inviteForm.password || inviteForm.password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return }

    setInviting(true)
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteForm.email.trim(),
          password: inviteForm.password,
          employee_id: showInvite
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      showToast('Login credentials created!')
      setShowInvite(null)
      setInviteForm({ email: '', password: '' })
      loadData()
    } catch (err) {
      showToast(err.message || 'Failed to create login', 'error')
    } finally {
      setInviting(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1.5px solid #E2E8E4', background: 'white', color: '#1A1A2E',
    fontSize: 14, outline: 'none'
  }

  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', paddingTop: 80 }}>
        <Loader2 size={32} color="#1B7A45" style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        <p style={{ fontSize: 14, color: '#5A6B62', marginTop: 12 }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#E8EBE9', display: 'flex', justifyContent: 'center' }}>
    <div style={{ minHeight: '100vh', background: '#F5F7F6', width: '100%', maxWidth: 480, boxShadow: '0 0 40px rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1B7A45 0%, #15603A 100%)', color: 'white', padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }}>
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>User Management</h1>
            <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>{employees.length} team member{employees.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Add User Button */}
        <button
          onClick={openAddForm}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '12px 16px', background: '#1B7A45', color: 'white',
            borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <UserPlus size={18} /> Add Team Member
        </button>

        {/* Employee List */}
        {employees.map(emp => (
          <div key={emp.id} style={{
            background: 'white', borderRadius: 14, border: '1.5px solid #E2E8E4',
            padding: 16, opacity: emp.is_active ? 1 : 0.6
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{emp.name}</span>
                  {!emp.is_active && (
                    <span style={{ fontSize: 10, background: '#FED7D7', color: '#E53E3E', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Inactive</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                    padding: '2px 8px', borderRadius: 20,
                    background: emp.role === 'admin' ? '#E8F5EE' : emp.role === 'purchase_manager' ? '#FFF8E6' : emp.role === 'accountant' ? '#F3E8FF' : '#EBF4FF',
                    color: emp.role === 'admin' ? '#1B7A45' : emp.role === 'purchase_manager' ? '#D4960A' : emp.role === 'accountant' ? '#7C3AED' : '#3B82F6'
                  }}>
                    {emp.role === 'purchase_manager' ? 'Purchase Mgr' : emp.role}
                  </span>
                  {emp.plants && (
                    <span style={{ fontSize: 12, color: '#5A6B62' }}>
                      <MapPin size={12} style={{ verticalAlign: -2 }} /> {emp.plants.name}
                    </span>
                  )}
                </div>
                {emp.mobile && (
                  <div style={{ fontSize: 12, color: '#5A6B62', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={12} /> {emp.mobile}
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 11 }}>
                  {emp.auth_user_id ? (
                    <span style={{ color: '#1B7A45', fontWeight: 600 }}>
                      <Check size={12} style={{ verticalAlign: -2 }} /> Can log in to app
                    </span>
                  ) : (
                    <span style={{ color: '#E8960C', fontWeight: 600 }}>
                      <X size={12} style={{ verticalAlign: -2 }} /> No app access yet — tap Invite
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => openEditForm(emp)}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E2E8E4',
                    background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                >
                  <Edit2 size={16} color="#5A6B62" />
                </button>
                {!emp.auth_user_id && (
                  <button
                    onClick={() => { setShowInvite(emp.id); setInviteForm({ email: '', password: '' }) }}
                    style={{
                      height: 36, padding: '0 12px', borderRadius: 10, border: 'none',
                      background: '#E8F5EE', color: '#1B7A45', fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'
                    }}
                  >
                    <Mail size={14} /> Invite
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Employee Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 24, maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editingId ? 'Edit' : 'Add'} Team Member</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={24} color="#5A6B62" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Name <span style={{ color: '#E53E3E' }}>*</span></label>
                <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </div>

              <div>
                <label style={labelStyle}>Mobile</label>
                <input style={inputStyle} type="tel" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="Phone number" />
              </div>

              <div>
                <label style={labelStyle}>Role <span style={{ color: '#E53E3E' }}>*</span></label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                  <option value="purchase_manager">Purchase Manager</option>
                  <option value="accountant">Accountant</option>
                  <option value="worker">Worker</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Plant <span style={{ color: '#E53E3E' }}>*</span></label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.plant_id} onChange={e => setForm({ ...form, plant_id: e.target.value })}>
                  <option value="">Select Plant</option>
                  {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {editingId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Active</label>
                  <button
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    style={{
                      width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                      background: form.is_active ? '#1B7A45' : '#D1D5DB',
                      position: 'relative', transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', background: 'white',
                      position: 'absolute', top: 3,
                      left: form.is_active ? 23 : 3, transition: 'left 0.2s'
                    }} />
                  </button>
                </div>
              )}

              <button
                onClick={saveEmployee}
                disabled={saving}
                style={{
                  width: '100%', padding: '14px 0', background: '#1B7A45', color: 'white',
                  borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? 'Saving...' : editingId ? 'Update Employee' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite (Create Login) Modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Create Login</h2>
              <button onClick={() => setShowInvite(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={24} color="#5A6B62" />
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#5A6B62', marginBottom: 16 }}>
              For: <strong>{employees.find(e => e.id === showInvite)?.name}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Email <span style={{ color: '#E53E3E' }}>*</span></label>
                <input style={inputStyle} type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="user@example.com" />
              </div>

              <div>
                <label style={labelStyle}>Password <span style={{ color: '#E53E3E' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={inputStyle}
                    type={showPassword ? 'text' : 'password'}
                    value={inviteForm.password}
                    onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                    placeholder="Min 6 characters"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    {showPassword ? <EyeOff size={16} color="#5A6B62" /> : <Eye size={16} color="#5A6B62" />}
                  </button>
                </div>
              </div>

              <button
                onClick={inviteUser}
                disabled={inviting}
                style={{
                  width: '100%', padding: '14px 0', background: '#1B7A45', color: 'white',
                  borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  opacity: inviting ? 0.7 : 1
                }}
              >
                {inviting ? 'Creating...' : 'Create Login Credentials'}
              </button>

              <p style={{ fontSize: 11, color: '#999', textAlign: 'center' }}>
                Share these credentials with the team member so they can log in to the app.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#E53E3E' : '#1B7A45', color: 'white',
          padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
          zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
    </div>
  )
}
