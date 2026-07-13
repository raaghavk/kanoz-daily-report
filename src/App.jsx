import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { useAuth } from './context/AuthContext'
import { can } from './lib/permissions'
import Layout from './components/Layout'

const Login = lazy(() => import('./pages/Login'))
const AssetsHome = lazy(() => import('./pages/assets/AssetsHome'))
const AssetCatalogue = lazy(() => import('./pages/assets/AssetCatalogue'))
const AddAsset = lazy(() => import('./pages/assets/AddAsset'))
const AssetDetail = lazy(() => import('./pages/assets/AssetDetail'))
const LogEvent = lazy(() => import('./pages/assets/LogEvent'))
const AssetByCode = lazy(() => import('./pages/assets/AssetByCode'))
const ScanAsset = lazy(() => import('./pages/assets/ScanAsset'))
const AssetSuppliers = lazy(() => import('./pages/assets/AssetSuppliers'))
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard'))
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
const SettingsPage = lazy(() => import('./pages/Settings'))
const AdminDesktop = lazy(() => import('./pages/admin/AdminDesktop'))
const StockHome = lazy(() => import('./pages/stock/StockHome'))

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
        <Route path="stock" element={<StockHome />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<PermissionGuard action="manage_users"><UserManagement /></PermissionGuard>} />
        <Route path="admin" element={<PermissionGuard action="plant_settings"><AdminPanel /></PermissionGuard>} />
        <Route path="delete-requests" element={<PermissionGuard action="manage_users"><DeleteRequests /></PermissionGuard>} />
      </Route>
      <Route path="/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <PermissionGuard action="plant_settings"><AdminDesktop /></PermissionGuard>
          </ProtectedRoute>
        }
      />
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

