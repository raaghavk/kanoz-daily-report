import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Compact prev/next controls for detail screens.
 * Left = older record, Right = newer (matches newest-first lists).
 * Uses replace so flipping records does not stack history.
 */
export default function RecordNav({ newerId, olderId, basePath, position, total }) {
  const navigate = useNavigate()

  function go(id) {
    if (!id) return
    navigate(`${basePath}/${id}`, { replace: true })
  }

  const btn = (disabled) => ({
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.2)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    padding: 0,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        aria-label="Older record"
        title="Older"
        disabled={!olderId}
        onClick={() => go(olderId)}
        style={btn(!olderId)}
      >
        <ChevronLeft size={18} color="white" />
      </button>
      {position != null && total > 0 && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, minWidth: 44, textAlign: 'center' }}>
          {position}/{total}
        </span>
      )}
      <button
        type="button"
        aria-label="Newer record"
        title="Newer"
        disabled={!newerId}
        onClick={() => go(newerId)}
        style={btn(!newerId)}
      >
        <ChevronRight size={18} color="white" />
      </button>
    </div>
  )
}
