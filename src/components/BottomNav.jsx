import { useLocation, useNavigate } from 'react-router-dom'
import { Home, ClipboardList, Truck, Package, Settings } from 'lucide-react'

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/reports', icon: ClipboardList, label: 'Reports' },
  { path: '/dispatch', icon: Truck, label: 'Dispatch' },
  { path: '/purchase', icon: Package, label: 'Purchase' },
  { path: '/settings', icon: Settings, label: 'More' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="flex-shrink-0 flex pb-[env(safe-area-inset-bottom)]"
      style={{
        height: 68,
        background: '#FFFFFF',
        borderTop: '1px solid #E2E8E4',
        paddingBottom: 6,
      }}
    >
      {tabs.map(tab => {
        const isActive = location.pathname === tab.path ||
          (tab.path !== '/' && location.pathname.startsWith(tab.path))
        const Icon = tab.icon
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{ color: isActive ? '#1B7A45' : '#8A9B92' }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
            <span className="text-[10px]" style={{ fontWeight: isActive ? 700 : 600 }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
