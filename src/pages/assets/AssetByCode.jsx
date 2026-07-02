import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

// Deep link target for a scanned QR tag: /a/:code  ->  /assets/:id
export default function AssetByCode() {
  const { code } = useParams()
  const { plant } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!plant?.org_id) return
    supabase.from('assets').select('id').eq('org_id', plant.org_id).eq('code', code).maybeSingle()
      .then(({ data }) => navigate(data ? `/assets/${data.id}` : '/assets', { replace: true }))
      .catch(() => navigate('/assets', { replace: true }))
  }, [plant, code]) // eslint-disable-line
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fefae0' }}>
      <p style={{ fontSize: 14, color: '#595c4a' }}>Opening {code}…</p>
    </div>
  )
}
