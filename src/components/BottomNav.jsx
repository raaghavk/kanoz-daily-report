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
    <nav className="flex-shrink-0 bg-kanoz-card border-t border-kanoz-border flex">
      {tabs.map(tab => {
        const isActive = location.pathname === tab.path ||
          (tab.path !== '/' && location.pathname.startsWith(tab.path))
        const Icon = tab.icon
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
              isActive ? 'text-kanoz-green' : 'text-kanoz-text-tertiary'
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
