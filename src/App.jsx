import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import { can } from './lib/permissions'
import Layout from './components/Layout'

const Login = lazy(() => import('./pages/Login'))
const Home = lazy(() => import('./pages/Home'))
const ShiftWizard = lazy(() => import('./pages/shift/ShiftWizard'))
const PurchaseList = lazy(() => import('./pages/purchase/PurchaseList'))
const PurchaseForm = lazy(() => import('./pages/purchase/PurchaseForm'))
const PurchaseDetail = lazy(() => import('./pages/purchase/PurchaseDetail'))
const SupplierList = lazy(() => import('./pages/suppliers/SupplierList'))
const SupplierDetail = lazy(() => import('./pages/suppliers/SupplierDetail'))
const DispatchForm = lazy(() => import('./pages/dispatch/DispatchForm'))
const DispatchDetail = lazy(() => import('./pages/dispatch/DispatchDetail'))
const ReportView = lazy(() => import('./pages/ReportView'))
const ReportList = lazy(() => import('./pages/ReportList'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))
const DeleteRequests = lazy(() => import('./pages/DeleteRequests'))
const DataInsights = lazy(() => import('./pages/DataInsights'))
const CustomerList = lazy(() => import('./pages/customers/CustomerList'))
const CustomerDetail = lazy(() => import('./pages/customers/CustomerDetail'))
const TransporterList = lazy(() => import('./pages/transporters/TransporterList'))
const TransporterDetail = lazy(() => import('./pages/transporters/TransporterDetail'))

function LoadingFallback() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #2d6a4f', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 13, color: '#595c4a' }}>Loading...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading, noEmployeeRecord, signOut } = useAuth()
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fefae0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #2d6a4f', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 14, color: '#595c4a' }}>Loading...</p>
        </div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (noEmployeeRecord) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fefae0' }}>
        <div style={{ textAlign: 'center', padding: 32, maxWidth: 360 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2c2c2c', marginBottom: 8 }}>No Access</h2>
          <p style={{ fontSize: 14, color: '#595c4a', marginBottom: 20, lineHeight: 1.5 }}>
            Your account is not linked to an employee profile. Please contact your admin to get access.
          </p>
          <button
            onClick={signOut}
            style={{ padding: '12px 32px', background: '#d32f2f', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }
  return children
}

function PermissionGuard({ action, children }) {
  const { employee } = useAuth()
  if (!can(employee?.role, action)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="reports" element={<PermissionGuard action="view_reports"><ReportList /></PermissionGuard>} />
        <Route path="reports/:id" element={<PermissionGuard action="view_reports"><ReportView /></PermissionGuard>} />
        <Route path="purchase" element={<PermissionGuard action="view_purchases"><PurchaseList /></PermissionGuard>} />
        <Route path="purchase/new" element={<PermissionGuard action="create_purchase"><PurchaseForm /></PermissionGuard>} />
        <Route path="purchase/:id" element={<PermissionGuard action="view_purchases"><PurchaseDetail /></PermissionGuard>} />
        <Route path="purchase/:id/edit" element={<PermissionGuard action="create_purchase"><PurchaseForm /></PermissionGuard>} />
        <Route path="dispatch" element={<PermissionGuard action="create_dispatch"><DispatchForm /></PermissionGuard>} />
        <Route path="dispatch/:id" element={<PermissionGuard action="view_dispatches"><DispatchDetail /></PermissionGuard>} />
        <Route path="suppliers" element={<SupplierList />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="insights" element={<DataInsights />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="transporters" element={<TransporterList />} />
        <Route path="transporters/:id" element={<TransporterDetail />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<PermissionGuard action="manage_users"><UserManagement /></PermissionGuard>} />
        <Route path="admin" element={<PermissionGuard action="plant_settings"><AdminPanel /></PermissionGuard>} />
        <Route path="delete-requests" element={<PermissionGuard action="manage_users"><DeleteRequests /></PermissionGuard>} />
      </Route>
      <Route
        path="/shift/new"
        element={
          <ProtectedRoute>
            <PermissionGuard action="create_report"><ShiftWizard /></PermissionGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/shift/edit/:id"
        element={
          <ProtectedRoute>
            <PermissionGuard action="create_report"><ShiftWizard /></PermissionGuard>
          </ProtectedRoute>
        }
      />
    </Routes>
    <SpeedInsights />
    </Suspense>
  )
}

function SettingsPage() {
  const { employee, plant, signOut, switchPlant } = useAuth()
  const nav = useNavigate()
  const [orgPlants, setOrgPlants] = useState([])
  const [switching, setSwitching] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)

  useEffect(() => {
    if (can(employee?.role, 'switch_plant') && plant?.org_id) {
      supabase.from('plants').select('id, name').eq('org_id', plant.org_id).order('name')
        .then(({ data }) => setOrgPlants(data || []))
        .catch(() => {})
    }
  }, [employee?.role, plant?.org_id])

  // Check current notification status
  useEffect(() => {
    import('./lib/notifications').then(({ isSubscribed }) => {
      isSubscribed().then(setNotifEnabled)
    })
  }, [])

  async function toggleNotifications() {
    setNotifLoading(true)
    try {
      const { getNotificationStatus, subscribeToPush, unsubscribeFromPush } = await import('./lib/notifications')
      const status = getNotificationStatus()
      if (status === 'unsupported') {
        alert('Push notifications are not supported on this device/browser.')
        return
      }
      if (status === 'not_configured') {
        alert('Push notifications are not configured yet. VAPID key is missing.')
        return
      }

      if (notifEnabled) {
        await unsubscribeFromPush(employee.id)
        setNotifEnabled(false)
      } else {
        const result = await subscribeToPush(employee.id)
        if (result.success) {
          setNotifEnabled(true)
        } else if (result.reason === 'denied') {
          alert('Notification permission was denied. Please enable it in your browser settings.')
        }
      }
    } catch (err) {
      console.error('Notification toggle error:', err)
    } finally {
      setNotifLoading(false)
    }
  }

  async function handlePlantSwitch(plantId) {
    if (plantId === plant?.id) return
    setSwitching(true)
    try {
      await switchPlant(plantId)
    } catch {
      alert('Failed to switch plant. Please try again.')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Settings</h2>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 14 }}><span style={{ color: '#595c4a' }}>Name:</span> {employee?.name}</div>
        <div style={{ fontSize: 14 }}><span style={{ color: '#595c4a' }}>Plant:</span> {plant?.name}</div>
        <div style={{ fontSize: 14 }}><span style={{ color: '#595c4a' }}>Role:</span> {employee?.role}</div>
      </div>
      {/* Plant switcher (admin only) */}
      {can(employee?.role, 'switch_plant') && orgPlants.length > 1 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8d7a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Switch Active Plant</label>
          <select
            value={plant?.id || ''}
            onChange={e => handlePlantSwitch(e.target.value)}
            disabled={switching}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', background: '#fefae0' }}
          >
            {orgPlants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {switching && <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 4 }}>Switching...</div>}
        </div>
      )}
      {/* Directory Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.5 }}>Directory</div>
        <button
          onClick={() => nav('/suppliers')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 16px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 18 }}>👤</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2c' }}>Suppliers</div>
            <div style={{ fontSize: 11, color: '#8a8d7a' }}>Raw material suppliers</div>
          </div>
        </button>
        <button
          onClick={() => nav('/customers')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 16px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 18 }}>🏭</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2c' }}>Customers</div>
            <div style={{ fontSize: 11, color: '#8a8d7a' }}>Dispatch destinations</div>
          </div>
        </button>
        <button
          onClick={() => nav('/transporters')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '14px 16px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 18 }}>🚛</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2c' }}>Transporters</div>
            <div style={{ fontSize: 11, color: '#8a8d7a' }}>Vehicle transport partners</div>
          </div>
        </button>
      </div>
      {can(employee?.role, 'manage_users') && (
        <button
          onClick={() => nav('/users')}
          style={{ width: '100%', padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          Manage Team Members
        </button>
      )}
      {can(employee?.role, 'plant_settings') && (
        <button
          onClick={() => nav('/admin')}
          style={{ width: '100%', padding: '14px 0', background: '#d4a373', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          Plant Settings (Admin)
        </button>
      )}
      {can(employee?.role, 'manage_users') && (
        <button
          onClick={() => nav('/delete-requests')}
          style={{ width: '100%', padding: '14px 0', background: '#DC2626', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          Delete Requests
        </button>
      )}
      {/* Notifications */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2c' }}>Push Notifications</div>
          <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>
            {notifEnabled ? 'Receiving alerts for reports & dispatches' : 'Enable to get shift alerts'}
          </div>
        </div>
        <button
          onClick={toggleNotifications}
          disabled={notifLoading}
          style={{
            width: 48, height: 28, borderRadius: 14, border: 'none', cursor: notifLoading ? 'not-allowed' : 'pointer',
            background: notifEnabled ? '#2d6a4f' : '#D1D5DB',
            position: 'relative', transition: 'background 0.2s',
            opacity: notifLoading ? 0.6 : 1,
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: '50%', background: 'white',
            position: 'absolute', top: 3,
            left: notifEnabled ? 23 : 3, transition: 'left 0.2s'
          }} />
        </button>
      </div>
      <button
        onClick={signOut}
        style={{ width: '100%', padding: '14px 0', background: '#d32f2f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
      >
        Sign Out
      </button>
    </div>
  )
}
