import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import { Html5Qrcode } from 'html5-qrcode'

function extractCode(t) {
  if (!t) return null
  const m = String(t).match(/\/a\/([A-Za-z0-9-]+)/)
  return (m ? m[1] : String(t)).trim().toUpperCase()
}

export default function ScanAsset() {
  const navigate = useNavigate()
  const [err, setErr] = useState(null)
  const [manual, setManual] = useState('')
  const qrRef = useRef(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const qr = new Html5Qrcode('asset-scanner')
    qrRef.current = qr
    const config = { fps: 10, qrbox: { width: 230, height: 230 } }
    qr.start({ facingMode: 'environment' }, config, onScan, () => {})
      .then(() => { startedRef.current = true })
      .catch(() => setErr('Could not open the camera. Allow camera access, or type the code below.'))
    return () => { try { if (startedRef.current) qr.stop().then(() => qr.clear()).catch(() => {}) } catch { /* */ } }
  }, []) // eslint-disable-line

  async function onScan(text) {
    const code = extractCode(text)
    if (!code) return
    try { if (startedRef.current && qrRef.current) { await qrRef.current.stop(); startedRef.current = false } } catch { /* */ }
    navigate('/a/' + code)
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Scan a tag" subtitle="Point the camera at the QR tag" onBack={() => navigate('/assets')} />
      <div style={{ padding: '16px 20px', paddingBottom: 100, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div id="asset-scanner" style={{ width: '100%', borderRadius: 16, overflow: 'hidden', background: '#000', minHeight: 240 }} />
        {err && <div style={{ background: '#fff', border: '1.5px solid #fde68a', borderRadius: 12, padding: 12, fontSize: 12, color: '#b45309' }}>{err}</div>}
        <div style={{ fontSize: 12, color: '#8a8d7a', textAlign: 'center' }}>Tag too dirty to scan? Type the code:</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={manual} onChange={e => setManual(e.target.value)} placeholder="e.g. MTR-0427"
            style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: '1.5px solid #e5ddd0', fontSize: 14, outline: 'none', background: '#fff' }} />
          <button onClick={() => manual.trim() && navigate('/a/' + manual.trim().toUpperCase())}
            style={{ padding: '0 18px', borderRadius: 12, background: '#2d6a4f', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}>Go</button>
        </div>
      </div>
    </div>
  )
}
