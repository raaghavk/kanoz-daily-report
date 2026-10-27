import { useState, useEffect } from 'react'
import { Factory } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function PlantPicker() {
  const { employee, switchPlant, signOut } = useAuth()
  const [plants, setPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [switchingId, setSwitchingId] = useState(null)
  const [error, setError] = useState('')

  const orgId = employee?.org_id ?? employee?.plants?.org_id

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const { data, error: loadError } = await supabase
          .from('plants')
          .select('id, name')
          .eq('org_id', orgId)
          .eq('is_active', true)
          .order('name')
        if (loadError) throw loadError
        if (!cancelled) setPlants(data || [])
      } catch {
        if (!cancelled) setError('Could not load plants. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orgId])

  async function handleSelect(plantId) {
    if (switchingId) return
    setSwitchingId(plantId)
    setError('')
    try {
      await switchPlant(plantId)
    } catch {
      setError('Failed to select plant. Please try again.')
      setSwitchingId(null)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', background: '#fefae0' }}>
      <div style={{
        height: '100%',
        width: '100%',
        maxWidth: 430,
        display: 'flex',
        flexDirection: 'column',
        background: '#fefae0',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{ background: '#1b4332', padding: '18px 20px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: 0 }}>Select plant</h2>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6, lineHeight: 1.4 }}>
            Production, stock, and purchases are plant-specific. Choose where you are working this session.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {employee?.name && (
            <div style={{ fontSize: 13, color: '#8a8d7a' }}>
              Signed in as <span style={{ fontWeight: 600, color: '#2c2c2c' }}>{employee.name}</span>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ width: 32, height: 32, border: '3px solid #2d6a4f', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 13, color: '#595c4a' }}>Loading plants...</p>
            </div>
          )}

          {!loading && plants.map((p) => {
            const busy = switchingId === p.id
            return (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                disabled={!!switchingId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  width: '100%',
                  textAlign: 'left',
                  padding: '16px 18px',
                  background: '#fff',
                  border: '1.5px solid #e5ddd0',
                  borderRadius: 14,
                  cursor: switchingId ? 'not-allowed' : 'pointer',
                  opacity: switchingId && !busy ? 0.55 : 1,
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: '#e8f5e9',
                  color: '#2d6a4f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Factory size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#2c2c2c' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 2 }}>
                    {busy ? 'Opening...' : 'Tap to continue'}
                  </div>
                </div>
              </button>
            )
          })}

          {!loading && !error && plants.length === 0 && (
            <div style={{
              background: '#fff',
              borderRadius: 14,
              border: '1.5px solid #e5ddd0',
              padding: 20,
              fontSize: 14,
              color: '#595c4a',
              lineHeight: 1.5,
            }}>
              No active plants found for your organisation. Contact an admin.
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: '#d32f2f', padding: '4px 2px' }}>{error}</div>
          )}
        </div>

        <div style={{ padding: '12px 20px 20px' }}>
          <button
            onClick={signOut}
            style={{
              width: '100%',
              padding: '12px',
              background: 'none',
              border: '1.5px solid #e5ddd0',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              color: '#8a8d7a',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
