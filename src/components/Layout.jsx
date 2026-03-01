import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import Toast from './Toast'

export default function Layout() {
  const location = useLocation()
  const hideNav = location.pathname === '/login'

  return (
    <div className="h-full flex justify-center" style={{ background: '#E8EBE9' }}>
      <div className="h-full w-full flex flex-col relative" style={{ maxWidth: 430, background: '#F5F7F6', boxShadow: '0 0 40px rgba(0,0,0,0.08)' }}>
        <div className="flex-1 overflow-y-auto flex flex-col">
          <Outlet />
        </div>
        {!hideNav && <BottomNav />}
        <Toast />
      </div>
    </div>
  )
}
