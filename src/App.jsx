import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
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
const ReportView = lazy(() => import('./pages/ReportView'))
const ReportList = lazy(() => import('./pages/ReportList'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))

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
  const { user, loading } = useAuth()
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
  return user ? children : <Navigate to="/login" replace />
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
        <Route path="reports" element={<ReportList />} />
        <Route path="reports/:id" element={<ReportView />} />
        <Route path="purchase" element={<PurchaseList />} />
        <Route path="purchase/new" element={<PurchaseForm />} />
        <Route path="purchase/:id" element={<PurchaseDetail />} />
        <Route path="purchase/:id/edit" element={<PurchaseForm />} />
        <Route path="dispatch" element={<DispatchForm />} />
        <Route path="suppliers" element={<SupplierList />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="admin" element={<AdminPanel />} />
      </Route>
      <Route
        path="/shift/new"
        element={
          <ProtectedRoute>
            <ShiftWizard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shift/edit/:id"
        element={
          <ProtectedRoute>
            <ShiftWizard />
          </ProtectedRoute>
        }
      />
    </Routes>
    </Suspense>
  )
}

function SettingsPage() {
  const { employee, plant, signOut, switchPlant } = useAuth()
  const nav = useNavigate()
  const [orgPlants, setOrgPlants] = useState([])
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (employee?.role === 'admin' && plant?.org_id) {
      supabase.from('plants').select('id, name').eq('org_id', plant.org_id).order('name')
        .then(({ data }) => setOrgPlants(data || []))
    }
  }, [employee?.role, plant?.org_id])

  async function handlePlantSwitch(plantId) {
    if (plantId === plant?.id) return
    setSwitching(true)
    await switchPlant(plantId)
    setSwitching(false)
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Settings</h2>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 14 }}><span style={{ color: '#595c4a' }}>Name:</span> {employee?.name}</div>
        <div style={{ fontSize: 14 }}><span style={{ color: '#595c4a' }}>Plant:</span> {plant?.name}</div>
        <div style={{ fontSize: 14 }}><span style={{ color: '#595c4a' }}>Role:</span> {employee?.role}</div>
      </div>
      {/* Admin plant switcher */}
      {employee?.role === 'admin' && orgPlants.length > 1 && (
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
      {/* History Links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.5 }}>View History</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <button onClick={() => nav('/reports')} style={{ padding: '14px 8px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2d6a4f' }}>Reports</div>
          </button>
          <button onClick={() => nav('/dispatch')} style={{ padding: '14px 8px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#d4a373' }}>Dispatches</div>
          </button>
          <button onClick={() => nav('/purchase')} style={{ padding: '14px 8px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#595c4a' }}>Purchases</div>
          </button>
        </div>
      </div>
      <button
        onClick={() => nav('/suppliers')}
        style={{ width: '100%', padding: '14px 0', background: '#fff', color: '#2c2c2c', borderRadius: 14, fontSize: 14, fontWeight: 600, border: '1.5px solid #e5ddd0', cursor: 'pointer' }}
      >
        View Suppliers
      </button>
      {employee?.role === 'admin' && (
        <>
          <button
            onClick={() => nav('/users')}
            style={{ width: '100%', padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            Manage Team Members
          </button>
          <button
            onClick={() => nav('/admin')}
            style={{ width: '100%', padding: '14px 0', background: '#d4a373', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            Plant Settings (Admin)
          </button>
        </>
      )}
      <button
        onClick={signOut}
        style={{ width: '100%', padding: '14px 0', background: '#d32f2f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
      >
        Sign Out
      </button>
    </div>
  )
}
