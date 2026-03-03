import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import ShiftWizard from './pages/shift/ShiftWizard'
import PurchaseList from './pages/purchase/PurchaseList'
import PurchaseForm from './pages/purchase/PurchaseForm'
import SupplierList from './pages/suppliers/SupplierList'
import SupplierDetail from './pages/suppliers/SupplierDetail'
import DispatchForm from './pages/dispatch/DispatchForm'
import ReportView from './pages/ReportView'
import ReportList from './pages/ReportList'
import UserManagement from './pages/UserManagement'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7F6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #1B7A45', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 14, color: '#5A6B62' }}>Loading...</p>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
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
  )
}

function SettingsPage() {
  const { employee, plant, signOut } = useAuth()
  const nav = useNavigate()
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700 }}>Settings</h2>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 14 }}><span style={{ color: '#5A6B62' }}>Name:</span> {employee?.name}</div>
        <div style={{ fontSize: 14 }}><span style={{ color: '#5A6B62' }}>Plant:</span> {plant?.name}</div>
        <div style={{ fontSize: 14 }}><span style={{ color: '#5A6B62' }}>Role:</span> {employee?.role}</div>
      </div>
      {employee?.role === 'admin' && (
        <button
          onClick={() => nav('/users')}
          style={{ width: '100%', padding: '14px 0', background: '#1B7A45', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          Manage Team Members
        </button>
      )}
      <button
        onClick={signOut}
        style={{ width: '100%', padding: '14px 0', background: '#E53E3E', color: 'white', borderRadius: 14, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
      >
        Sign Out
      </button>
    </div>
  )
}
