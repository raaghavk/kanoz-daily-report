import { useState, useEffect } from 'react'
import { Factory } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

export default function PlantPicker() {
  const { employee, plant, switchPlant, confirmPlant, signOut } = useAuth()
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
    if (plant?.id && plantId === plant.id) {
      confirmPlant()
      return
    }
    setSwitchingId(plantId)
    setError('')
    try {
      await switchPlant(plantId)
    } catch {
      setError('Failed to select plant. Please try again.')
      setSwitchingId(null)
    }
  }

  const otherPlants = plants.filter(p => p.id !== plant?.id)

  return (
    <div style={{ height: '100vh', background: '#fefae0' }}>
      <Modal isOpen dismissible={false} onClose={() => {}} title="Confirm plant">
        <p style={{ fontSize: 13, color: '#595c4a', margin: '0 0 16px', lineHeight: 1.45 }}>
          Production, stock, and purchases are plant-specific. Confirm where you are working.
        </p>

        {employee?.name && (
          <div style={{ fontSize: 12, color: '#8a8d7a', marginBottom: 14 }}>
            Signed in as <span style={{ fontWeight: 600, color: '#2c2c2c' }}>{employee.name}</span>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ width: 28, height: 28, border: '3px solid #2d6a4f', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 10px', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#595c4a' }}>Loading plants...</p>
          </div>
        )}

        {!loading && plant && (
          <button
            onClick={() => handleSelect(plant.id)}
            disabled={!!switchingId}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: '#2d6a4f',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: switchingId ? 'not-allowed' : 'pointer',
              marginBottom: otherPlants.length ? 16 : 0,
            }}
          >
            Continue at {plant.name}
          </button>
        )}

        {!loading && otherPlants.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {plant ? 'Or switch to' : 'Select plant'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {otherPlants.map((p) => {
                const busy = switchingId === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p.id)}
                    disabled={!!switchingId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      background: '#fefae0',
                      border: '1.5px solid #e5ddd0',
                      borderRadius: 12,
                      cursor: switchingId ? 'not-allowed' : 'pointer',
                      opacity: switchingId && !busy ? 0.55 : 1,
                    }}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: '#e8f5e9',
                      color: '#2d6a4f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Factory size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#2c2c2c' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 1 }}>
                        {busy ? 'Switching...' : 'Tap to switch'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!loading && !error && plants.length === 0 && (
          <div style={{ fontSize: 14, color: '#595c4a', lineHeight: 1.5 }}>
            No active plants found for your organisation. Contact an admin.
          </div>
        )}

        {error && (
          <div style={{ fontSize: 13, color: '#d32f2f', marginTop: 12 }}>{error}</div>
        )}

        <button
          onClick={signOut}
          style={{
            width: '100%',
            marginTop: 20,
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
      </Modal>
    </div>
  )
}
