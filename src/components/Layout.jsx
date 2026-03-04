import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import OfflineBanner from './OfflineBanner'

export default function Layout() {
  const location = useLocation()
  const hideNav = location.pathname === '/login'

  return (
    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', background: '#f5edd6' }}>
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative', maxWidth: 480, background: '#fefae0', boxShadow: '0 0 40px rgba(0,0,0,0.08)' }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </div>
        {!hideNav && <BottomNav />}
        <OfflineBanner />
      </div>
    </div>
  )
}
