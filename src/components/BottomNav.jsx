import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Settings, Plus, ClipboardList, Truck, Package, X } from 'lucide-react'

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showSheet, setShowSheet] = useState(false)

  const isHome = location.pathname === '/'
  const isMore = location.pathname === '/settings' ||
    location.pathname.startsWith('/suppliers') ||
    location.pathname.startsWith('/users') ||
    location.pathname.startsWith('/admin')

  function handleAction(path) {
    setShowSheet(false)
    navigate(path)
  }

  return (
    <>
      {/* Bottom Sheet Overlay */}
      {showSheet && (
        <div
          onClick={() => setShowSheet(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              background: '#fff', borderRadius: '20px 20px 0 0',
              padding: '20px 20px 28px',
              boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#2c2c2c' }}>Create New</span>
              <button onClick={() => setShowSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color="#8a8d7a" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => handleAction('/shift/new')} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                background: '#e8f0ec', borderRadius: 14, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>New Shift Report</div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 1 }}>Log production & operations</div>
                </div>
              </button>
              <button onClick={() => handleAction('/dispatch')} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                background: '#fefae0', borderRadius: 14, border: '1px solid #e5ddd0', cursor: 'pointer', width: '100%', textAlign: 'left',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#d4a373', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>New Dispatch</div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 1 }}>Record vehicle dispatch</div>
                </div>
              </button>
              <button onClick={() => handleAction('/purchase/new')} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                background: '#fefae0', borderRadius: 14, border: '1px solid #e5ddd0', cursor: 'pointer', width: '100%', textAlign: 'left',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#595c4a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>New Purchase</div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 1 }}>Log raw material purchase</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav style={{
        flexShrink: 0, display: 'flex', height: 68,
        background: '#FFFFFF', borderTop: '1px solid #e5ddd0',
        paddingBottom: 6, alignItems: 'center',
      }}>
        <button onClick={() => navigate('/')} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer',
          color: isHome ? '#2d6a4f' : '#8a8d7a',
        }}>
          <Home size={22} strokeWidth={isHome ? 2.5 : 1.5} />
          <span style={{ fontSize: 10, fontWeight: isHome ? 700 : 600 }}>Home</span>
        </button>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => setShowSheet(!showSheet)} style={{
            width: 52, height: 52, borderRadius: '50%',
            background: showSheet ? '#1b4332' : '#2d6a4f',
            color: 'white', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(45,106,79,0.3)',
            marginTop: -16, transition: 'background 0.2s, transform 0.2s',
            transform: showSheet ? 'rotate(45deg)' : 'none',
          }}>
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>

        <button onClick={() => navigate('/settings')} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer',
          color: isMore ? '#2d6a4f' : '#8a8d7a',
        }}>
          <Settings size={22} strokeWidth={isMore ? 2.5 : 1.5} />
          <span style={{ fontSize: 10, fontWeight: isMore ? 700 : 600 }}>More</span>
        </button>
      </nav>
    </>
  )
}
