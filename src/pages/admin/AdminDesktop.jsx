import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard, ClipboardList, Package, Truck,
  LogOut, ChevronRight, AlertCircle, Settings, Trash2, Users
} from 'lucide-react'
import Overview from './Overview'
import ReportsTable from './ReportsTable'
import PurchasesTable from './PurchasesTable'
import DispatchesTable from './DispatchesTable'

const PAGES = ['overview', 'reports', 'purchases', 'dispatches']

const NAV_ITEMS = [
  { id: 'overview',   label: 'Overview',       icon: LayoutDashboard },
  { id: 'reports',    label: 'Shift Reports',   icon: ClipboardList },
  { id: 'purchases',  label: 'Purchases',       icon: Package },
  { id: 'dispatches', label: 'Dispatches',      icon: Truck },
]

const EXTERNAL_ITEMS = [
  { id: 'delete-requests', label: 'Delete Requests', icon: Trash2,   path: '/delete-requests' },
  { id: 'users',           label: 'Users',            icon: Users,    path: '/users' },
  { id: 'admin',           label: 'Plant Settings',   icon: Settings, path: '/admin' },
]

export default function AdminDesktop() {
  const { employee, plant, signOut } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState('overview')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Fetch pending delete request count for sidebar badge
  useEffect(() => {
    if (!plant?.org_id) return
    supabase.from('delete_requests')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', plant.org_id)
      .eq('status', 'pending')
      .then(({ count }) => setPendingCount(count || 0))
  }, [plant?.org_id])

  if (employee?.role !== 'admin') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fefae0' }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={40} color="#d97706" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#2c2c2c' }}>Admin access required</p>
          <button onClick={() => navigate('/')} style={{ marginTop: 12, padding: '10px 20px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Go to App
          </button>
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fefae0', padding: 32, textAlign: 'center' }}>
        <AlertCircle size={48} color="#d97706" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#2c2c2c', margin: '0 0 10px' }}>Desktop Only</h2>
        <p style={{ fontSize: 14, color: '#595c4a', margin: '0 0 28px', lineHeight: 1.6, maxWidth: 300 }}>
          The admin dashboard is designed for wider screens. Please open it on a laptop or desktop.
        </p>
        <button onClick={() => navigate('/')} style={{ padding: '13px 28px', background: '#2d6a4f', color: '#fff', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
          Back to App
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, sans-serif', background: '#f5f4ef' }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 232, flexShrink: 0,
        background: '#1b4332',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Branding */}
        <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>Kanoz Admin</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{employee?.name} · {plant?.name}</div>
        </div>

        {/* Primary nav */}
        <nav style={{ flex: 1, padding: '10px 10px 0' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase', padding: '10px 8px 6px' }}>Analytics</div>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = page === id
            return (
              <button key={id} onClick={() => setPage(id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                marginBottom: 2, textAlign: 'left',
                background: active ? 'rgba(255,255,255,0.13)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.62)',
                fontSize: 13, fontWeight: active ? 700 : 500,
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon size={15} />
                {label}
                {active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#52b788' }} />}
              </button>
            )
          })}

          {/* External links */}
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase', padding: '16px 8px 6px' }}>Management</div>
          {EXTERNAL_ITEMS.map(({ id, label, icon: Icon, path }) => (
            <button key={id} onClick={() => navigate(path)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
              marginBottom: 2, textAlign: 'left',
              background: 'transparent',
              color: 'rgba(255,255,255,0.62)',
              fontSize: 13, fontWeight: 500,
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.62)' }}
            >
              <Icon size={15} />
              {label}
              {id === 'delete-requests' && pendingCount > 0 && (
                <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, background: '#ef4444', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', padding: '0 5px' }}>
                  {pendingCount}
                </span>
              )}
              {(!pendingCount || id !== 'delete-requests') && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '12px 10px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={signOut} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13,
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f5f4ef' }}>
        {page === 'overview'   && <Overview />}
        {page === 'reports'    && <ReportsTable />}
        {page === 'purchases'  && <PurchasesTable />}
        {page === 'dispatches' && <DispatchesTable />}
      </div>
    </div>
  )
}
