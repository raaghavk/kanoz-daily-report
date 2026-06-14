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
const SparePartsHome = lazy(() => import('./pages/spareparts/SparePartsHome'))
const SparePartsListPage = lazy(() => import('./pages/spareparts/SparePartsListPage'))
const SparePartsSuppliersPage = lazy(() => import('./pages/spareparts/SparePartsSuppliersPage'))
const StockInPage = lazy(() => import('./pages/spareparts/StockInPage'))
const IssuePartPage = lazy(() => import('./pages/spareparts/IssuePartPage'))
const PartDetailPage = lazy(() => import('./pages/spareparts/PartDetailPage'))
const SparePartsPurchaseHistoryPage = lazy(() => import('./pages/spareparts/SparePartsPurchaseHistoryPage'))
const SparePartsUsageHistoryPage = lazy(() => import('./pages/spareparts/SparePartsUsageHistoryPage'))
const ReorderRequestsPage = lazy(() => import('./pages/spareparts/ReorderRequestsPage'))
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'))
const AssetsHome = lazy(() => import('./pages/assets/AssetsHome'))
const AssetCatalogue = lazy(() => import('./pages/assets/AssetCatalogue'))
const AddAsset = lazy(() => import('./pages/assets/AddAsset'))
const AssetDetail = lazy(() => import('./pages/assets/AssetDetail'))
const LogEvent = lazy(() => import('./pages/assets/LogEvent'))
const AssetByCode = lazy(() => import('./pages/assets/AssetByCode'))
const ScanAsset = lazy(() => import('./pages/assets/ScanAsset'))
const AssetSuppliers = lazy(() => import('./pages/assets/AssetSuppliers'))

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
        <Route path="spare-parts" element={<PermissionGuard action="view_spare_parts"><SparePartsHome /></PermissionGuard>} />
        <Route path="spare-parts/parts" element={<PermissionGuard action="view_spare_parts"><SparePartsListPage /></PermissionGuard>} />
        <Route path="spare-parts/parts/:id" element={<PermissionGuard action="view_spare_parts"><PartDetailPage /></PermissionGuard>} />
        <Route path="spare-parts/suppliers" element={<PermissionGuard action="view_spare_parts"><SparePartsSuppliersPage /></PermissionGuard>} />
        <Route path="spare-parts/stock-in" element={<PermissionGuard action="create_spare_parts"><StockInPage /></PermissionGuard>} />
        <Route path="spare-parts/issue" element={<PermissionGuard action="create_spare_parts"><IssuePartPage /></PermissionGuard>} />
        <Route path="spare-parts/purchase-history" element={<PermissionGuard action="view_spare_parts"><SparePartsPurchaseHistoryPage /></PermissionGuard>} />
        <Route path="spare-parts/usage-history" element={<PermissionGuard action="view_spare_parts"><SparePartsUsageHistoryPage /></PermissionGuard>} />
        <Route path="spare-parts/reorder" element={<PermissionGuard action="view_spare_parts"><ReorderRequestsPage /></PermissionGuard>} />
        <Route path="assets" element={<PermissionGuard action="view_spare_parts"><AssetsHome /></PermissionGuard>} />
        <Route path="assets/catalogue" element={<PermissionGuard action="view_spare_parts"><AssetCatalogue /></PermissionGuard>} />
        <Route path="assets/scan" element={<PermissionGuard action="view_spare_parts"><ScanAsset /></PermissionGuard>} />
        <Route path="assets/suppliers" element={<PermissionGuard action="view_spare_parts"><AssetSuppliers /></PermissionGuard>} />
        <Route path="assets/new" element={<PermissionGuard action="create_spare_parts"><AddAsset /></PermissionGuard>} />
        <Route path="assets/:id" element={<PermissionGuard action="view_spare_parts"><AssetDetail /></PermissionGuard>} />
        <Route path="assets/:id/log" element={<PermissionGuard action="create_spare_parts"><LogEvent /></PermissionGuard>} />
        <Route path="a/:code" element={<PermissionGuard action="view_spare_parts"><AssetByCode /></PermissionGuard>} />
        <Route path="tasks" element={<TasksPage />} />
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

function MiniToggle({ on, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        width: 44, height: 26, borderRadius: 13, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: on ? '#2d6a4f' : '#D1D5DB',
        position: 'relative', transition: 'background 0.2s',
        opacity: disabled ? 0.4 : 1, flexShrink: 0,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 3,
        left: on ? 21 : 3, transition: 'left 0.2s',
      }} />
    </button>
  )
}

function SettingsPage() {
  const { employee, plant, signOut, switchPlant } = useAuth()
  const nav = useNavigate()
  const [orgPlants, setOrgPlants] = useState([])
  const [switching, setSwitching] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  // Map of event_type → boolean
  const [prefs, setPrefs] = useState({})
  const [prefLoading, setPrefLoading] = useState({})

  const isAdmin = employee?.role === 'admin'

  useEffect(() => {
    if (can(employee?.role, 'switch_plant') && plant?.org_id) {
      supabase.from('plants').select('id, name').eq('org_id', plant.org_id).order('name')
        .then(({ data }) => setOrgPlants(data || []))
        .catch(() => {})
    }
  }, [employee?.role, plant?.org_id])

  // Check push subscription status and load preferences
  useEffect(() => {
    if (!employee?.id) return
    import('./lib/notifications').then(async ({ isSubscribed, getNotificationPreferences, EVENT_TYPES }) => {
      const subscribed = await isSubscribed()
      setPushEnabled(subscribed)
      if (subscribed) {
        const rows = await getNotificationPreferences(employee.id)
        const map = {}
        for (const et of EVENT_TYPES) map[et.key] = false // default OFF
        for (const row of rows) if (row.enabled) map[row.event_type] = true
        setPrefs(map)
      }
    }).catch(() => {})
  }, [employee?.id])

  async function togglePush() {
    setPushLoading(true)
    try {
      const { getNotificationStatus, subscribeToPush, unsubscribeFromPush } = await import('./lib/notifications')
      const status = getNotificationStatus()
      if (status === 'unsupported') { alert('Push notifications are not supported on this device/browser.'); return }
      if (status === 'not_configured') { alert('Push notifications are not configured yet.'); return }

      if (pushEnabled) {
        await unsubscribeFromPush(employee.id)
        setPushEnabled(false)
        setPrefs({})
      } else {
        const result = await subscribeToPush(employee.id)
        if (result.success) {
          setPushEnabled(true)
          // Load prefs after enabling
          const { getNotificationPreferences, EVENT_TYPES } = await import('./lib/notifications')
          const rows = await getNotificationPreferences(employee.id)
          const map = {}
          for (const et of EVENT_TYPES) map[et.key] = false
          for (const row of rows) if (row.enabled) map[row.event_type] = true
          setPrefs(map)
        } else if (result.reason === 'denied') {
          alert('Notification permission was denied. Please enable it in your browser settings.')
        }
      }
    } catch (err) {
      console.error('Push toggle error:', err)
    } finally {
      setPushLoading(false)
    }
  }

  async function togglePref(eventType) {
    if (!pushEnabled) return
    const newVal = !prefs[eventType]
    setPrefLoading(prev => ({ ...prev, [eventType]: true }))
    setPrefs(prev => ({ ...prev, [eventType]: newVal }))
    try {
      const { setNotificationPreference } = await import('./lib/notifications')
      await setNotificationPreference(employee.id, eventType, newVal)
    } catch {
      // Revert on error
      setPrefs(prev => ({ ...prev, [eventType]: !newVal }))
    } finally {
      setPrefLoading(prev => ({ ...prev, [eventType]: false }))
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, flexShrink: 0, background: '#1b4332', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div style={{ padding: '14px 20px' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'white', margin: 0 }}>Settings</h2>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {plant?.name || 'Plant'} {'\u00B7'} {employee?.role || 'User'}
          </div>
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Profile card */}
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
      {(() => {
        const role = employee?.role
        const dirItems = [
          { path: '/suppliers', emoji: '👤', label: 'Suppliers', show: true },
          { path: '/customers', emoji: '🏭', label: 'Customers', show: role !== 'purchase_manager' },
          { path: '/transporters', emoji: '🚛', label: 'Transporters', show: role !== 'purchase_manager' },
          { path: '/spare-parts', emoji: '🔧', label: 'Spare Parts', show: can(role, 'view_spare_parts') },
          { path: '/assets', emoji: '🏷️', label: 'Assets', show: can(role, 'view_spare_parts') },
        ].filter(i => i.show)
        if (!dirItems.length) return null
        return (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Directory</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {dirItems.map(item => (
                <button key={item.path} onClick={() => nav(item.path)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '16px 8px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', cursor: 'pointer' }}>
                  <span style={{ fontSize: 24 }}>{item.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#2c2c2c' }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })()}
      {/* Admin action buttons */}
      {(can(employee?.role, 'manage_users') || can(employee?.role, 'plant_settings')) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {can(employee?.role, 'manage_users') && (
            <button onClick={() => nav('/users')} style={{ flex: 1, padding: '12px 6px', background: '#2d6a4f', color: 'white', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Team
            </button>
          )}
          {can(employee?.role, 'plant_settings') && (
            <button onClick={() => nav('/admin')} style={{ flex: 1, padding: '12px 6px', background: '#d4a373', color: 'white', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Plant Settings
            </button>
          )}
          {can(employee?.role, 'manage_users') && (
            <button onClick={() => nav('/delete-requests')} style={{ flex: 1, padding: '12px 6px', background: '#DC2626', color: 'white', borderRadius: 12, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Deletions
            </button>
          )}
        </div>
      )}
      {/* ── Notifications — only for admin, plant_manager, supervisor ── */}
      {['admin', 'plant_manager', 'supervisor'].includes(employee?.role) && (
        <NotificationsSection
          pushEnabled={pushEnabled}
          pushLoading={pushLoading}
          onTogglePush={togglePush}
          prefs={prefs}
          prefLoading={prefLoading}
          onTogglePref={togglePref}
          isAdmin={isAdmin}
        />
      )}
      <button
        onClick={signOut}
        style={{ width: '100%', padding: '14px 0', background: '#d32f2f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
      >
        Sign Out
      </button>
      </div>
    </div>
  )
}

function NotificationsSection({ pushEnabled, pushLoading, onTogglePush, prefs, prefLoading, onTogglePref, isAdmin }) {
  const [eventTypes, setEventTypes] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    import('./lib/notifications').then(({ EVENT_TYPES }) => setEventTypes(EVENT_TYPES))
  }, [])

  const visible = eventTypes.filter(et => !et.admin_only || isAdmin)

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
      {/* Collapsed header row — tap to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🔔</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>Notifications</div>
            <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 1 }}>
              {pushEnabled ? 'Push enabled' : 'Tap to configure'}
            </div>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#8a8d7a' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Expanded body */}
      {open && (
        <>
          {/* Push on/off row */}
          <div style={{ borderTop: '1px solid #f0ebe0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f7f0' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>Push Notifications</div>
              <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>
                {pushEnabled ? 'Enabled — choose what to receive below' : 'Enable to get alerts on this device'}
              </div>
            </div>
            <MiniToggle on={pushEnabled} onToggle={onTogglePush} disabled={pushLoading} />
          </div>

          {/* Per-event toggles */}
          {!pushEnabled ? (
            <div style={{ padding: '12px 16px', fontSize: 12, color: '#8a8d7a', textAlign: 'center', borderTop: '1px solid #f0ebe0' }}>
              Enable push notifications above to configure alerts
            </div>
          ) : (
            <div>
              {visible.map((et) => (
                <div
                  key={et.key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 16px',
                    borderTop: '1px solid #f0ebe0',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>{et.label}</div>
                    <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>{et.description}</div>
                  </div>
                  <MiniToggle
                    on={!!prefs[et.key]}
                    onToggle={() => onTogglePref(et.key)}
                    disabled={!!prefLoading[et.key]}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
