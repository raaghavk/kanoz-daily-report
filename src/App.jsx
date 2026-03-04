import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'

const Login = lazy(() => import('./pages/Login'))
const Home = lazy(() => import('./pages/Home'))
const ShiftWizard = lazy(() => import('./pages/shift/ShiftWizard'))
const PurchaseList = lazy(() => import('./pages/purchase/PurchaseList'))
const PurchaseForm = lazy(() => import('./pages/purchase/PurchaseForm'))
const SupplierList = lazy(() => import('./pages/suppliers/SupplierList'))
const SupplierDetail = lazy(() => import('./pages/suppliers/SupplierDetail'))
const DispatchForm = lazy(() => import('./pages/dispatch/DispatchForm'))
const ReportView = lazy(() => import('./pages/ReportView'))
const ReportList = lazy(() => import('./pages/ReportList'))
const UserManagement = lazy(() => import('./pages/UserManagement'))

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
        <Route path="purchase/:id" element={<PurchaseForm />} />
        <Route path="dispatch" element={<DispatchForm />} />
        <Route path="suppliers" element={<SupplierList />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<UserManagement />} />
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
  const { employee, plant, signOut } = useAuth()
  const nav = useNavigate()
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Settings</h2>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 14 }}><span style={{ color: '#595c4a' }}>Name:</span> {employee?.name}</div>
        <div style={{ fontSize: 14 }}><span style={{ color: '#595c4a' }}>Plant:</span> {plant?.name}</div>
        <div style={{ fontSize: 14 }}><span style={{ color: '#595c4a' }}>Role:</span> {employee?.role}</div>
      </div>
      {employee?.role === 'admin' && (
        <button
          onClick={() => nav('/users')}
          style={{ width: '100%', padding: '14px 0', background: '#2d6a4f', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          Manage Team Members
        </button>
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
