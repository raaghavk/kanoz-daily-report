import { Routes, Route, Navigate } from 'react-router-dom'
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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-kanoz-bg">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-kanoz-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-kanoz-text-secondary">Loading...</p>
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
      </Route>
      <Route
        path="/shift/new"
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
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">Settings</h2>
      <div className="bg-kanoz-card rounded-xl p-4 space-y-2">
        <div className="text-sm"><span className="text-kanoz-text-secondary">Name:</span> {employee?.name}</div>
        <div className="text-sm"><span className="text-kanoz-text-secondary">Plant:</span> {plant?.name}</div>
        <div className="text-sm"><span className="text-kanoz-text-secondary">Role:</span> {employee?.role}</div>
      </div>
      <button
        onClick={signOut}
        className="w-full py-3 bg-kanoz-red text-white rounded-xl text-sm font-bold"
      >
        Sign Out
      </button>
    </div>
  )
}
