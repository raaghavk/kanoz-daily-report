import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import Toast from './Toast'

export default function Layout() {
  const location = useLocation()
  const hideNav = location.pathname === '/login'

  return (
    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', background: '#E8EBE9' }}>
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative', maxWidth: 480, background: '#F5F7F6', boxShadow: '0 0 40px rgba(0,0,0,0.08)' }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </div>
        {!hideNav && <BottomNav />}
        <Toast />
      </div>
    </div>
  )
}
