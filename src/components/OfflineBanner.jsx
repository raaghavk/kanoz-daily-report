import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: '#d32f2f',
        color: 'white',
        textAlign: 'center',
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      You are offline. Changes will sync when connection returns.
    </div>
  )
}
