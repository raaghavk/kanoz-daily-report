import { isDemoMode } from '../lib/demo/mode'

const BAR_STYLE = {
  flexShrink: 0,
  background: '#c2410c',
  color: '#fff7ed',
  textAlign: 'center',
  padding: '7px 12px',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  borderBottom: '2px solid #9a3412',
  zIndex: 30000,
}

export function DemoBanner() {
  return (
    <div role="status" data-testid="demo-banner" style={BAR_STYLE}>
      DEMO — sample data only
    </div>
  )
}

/** Wraps the app so the watermark sits above every screen, including login and the shift wizard. */
export function DemoShell({ children }) {
  if (!isDemoMode()) return children
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DemoBanner />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  )
}
