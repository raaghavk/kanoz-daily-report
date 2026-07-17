import { useState, useRef, useCallback, useEffect } from 'react'

// Finds the nearest scrollable ancestor of `el` (the element the ref is on).
// The ref is placed on a page's root div, but the element that actually
// scrolls is usually a parent (e.g. Layout's overflow container). We must read
// scrollTop from THAT element — otherwise scrollTop is always 0, the hook
// thinks the user is always at the top, and preventDefault() blocks all scroll.
function getScrollParent(el) {
  let node = el?.parentElement
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return el // fallback: the element itself
}

export default function usePullToRefresh(onRefresh) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const containerRef = useRef(null)
  const scrollElRef = useRef(null)
  const refreshing = useRef(false)
  const THRESHOLD = 80

  const scrollTopNow = () => (scrollElRef.current ? scrollElRef.current.scrollTop : 0)

  const handleTouchStart = useCallback((e) => {
    if (refreshing.current) return
    if (scrollTopNow() > 0) return
    startY.current = e.touches[0].clientY
    setPulling(true)
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (!pulling || refreshing.current) return
    if (scrollTopNow() > 0) {
      setPulling(false)
      setPullDistance(0)
      return
    }
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) {
      // Only hijack the gesture once it's clearly a downward pull from the top.
      // Small deltas are left alone so normal scrolling is never blocked.
      if (delta > 6) e.preventDefault()
      setPullDistance(Math.min(delta * 0.5, 120))
    } else {
      // Upward / neutral movement: let the browser scroll normally.
      setPulling(false)
      setPullDistance(0)
    }
  }, [pulling])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return
    if (pullDistance >= THRESHOLD && !refreshing.current) {
      refreshing.current = true
      try {
        await onRefresh()
      } finally {
        refreshing.current = false
      }
    }
    setPulling(false)
    setPullDistance(0)
  }, [pulling, pullDistance, onRefresh])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    scrollElRef.current = getScrollParent(container)
    const opts = { passive: false }
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, opts)
    container.addEventListener('touchend', handleTouchEnd)
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const PullIndicator = pullDistance > 0 ? (
    <div style={{
      height: pullDistance,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: pulling ? 'none' : 'height 0.2s ease',
      overflow: 'hidden',
    }}>
      <div style={{
        width: 24,
        height: 24,
        border: '2.5px solid #2d6a4f',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: pullDistance >= THRESHOLD ? 'spin 0.7s linear infinite' : 'none',
        transform: `rotate(${Math.min(pullDistance / THRESHOLD, 1) * 360}deg)`,
        opacity: Math.min(pullDistance / THRESHOLD, 1),
      }} />
    </div>
  ) : null

  return { containerRef, PullIndicator }
}
