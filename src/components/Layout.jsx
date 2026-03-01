import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import Toast from './Toast'

export default function Layout() {
  const location = useLocation()
  const hideNav = location.pathname === '/login'

  return (
    <div className="h-full flex flex-col" style={{ background: '#F5F7F6' }}>
      <div className="flex-1 overflow-y-auto flex flex-col">
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
      <Toast />
    </div>
  )
}
