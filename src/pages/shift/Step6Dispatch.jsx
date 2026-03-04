import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Loader2, TrendingUp, ExternalLink } from 'lucide-react'

export default function Step6Dispatch({ data, updateData, plant }) {
  const navigate = useNavigate()
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (plant?.id) {
      loadDispatches()
    }
  }, [plant])

  async function loadDispatches() {
    try {
      setLoading(true)
      const { data: dispatchData, error } = await supabase
        .from('vehicle_dispatches')
        .select(`
          *,
          dispatch_pellets(*),
          customers(name)
        `)
        .eq('plant_id', plant.id)
        .eq('date', today)
        .order('created_at', { ascending: false })

      if (error) throw error

      const processedDispatches = (dispatchData || []).map(d => ({
        ...d,
        total_mt: d.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0) || 0
      }))
      setDispatches(processedDispatches)

      // Store dispatch totals by pellet type for Step 7 auto-calculation
      const dispatchByPellet = {}
      ;(dispatchData || []).forEach(d => {
        (d.dispatch_pellets || []).forEach(dp => {
          const name = dp.pellet_type_name || ''
          dispatchByPellet[name] = (dispatchByPellet[name] || 0) + (parseFloat(dp.quantity_mt) || 0)
        })
      })
      updateData('dispatchTotals', dispatchByPellet)
    } catch (err) {
      console.error('Error loading dispatches:', err)
      setDispatches([])
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals
  const totalTrucks = dispatches.length
  const totalQuantity = dispatches.reduce((sum, d) => sum + (d.total_mt || 0), 0)

  // Group by pellet type from dispatch_pellets
  const pelletSummary = {}
  dispatches.forEach(d => {
    (d.dispatch_pellets || []).forEach(dp => {
      const name = dp.pellet_type_name || 'Unknown'
      pelletSummary[name] = (pelletSummary[name] || 0) + (parseFloat(dp.quantity_mt) || 0)
    })
  })

  function goToDispatchTab() {
    // Navigate with state so DispatchForm knows to come back here
    navigate('/dispatch', { state: { returnToShift: true } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Info Box */}
      <div style={{ background: '#E8F5EE', borderRadius: 12, padding: 14, border: '1.5px solid #1B7A45' }}>
        <p style={{ fontSize: 13, color: '#1A1A2E', margin: 0, lineHeight: '1.5' }}>
          Dispatches are managed in the <strong>Dispatch</strong> tab. This is a read-only summary of today's vehicle dispatches.
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
          <Loader2 size={20} style={{ color: '#1B7A45', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#5A6B62', fontSize: 14 }}>Loading dispatches...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && dispatches.length === 0 && (
        <div style={{ background: '#F5F7F6', borderRadius: 14, border: '2px dashed #E2E8E4', padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#5A6B62', fontSize: 14, marginBottom: 12 }}>No dispatches yet today.</div>
          <button
            onClick={goToDispatchTab}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: '#1B7A45',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={14} /> Go to Dispatch Tab
          </button>
        </div>
      )}

      {/* Dispatch Cards */}
      {!loading && dispatches.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dispatches.map((dispatch) => (
              <div
                key={dispatch.id}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: '1.5px solid #E2E8E4',
                  padding: 14,
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr auto',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {/* Truck Icon */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, background: '#E8F5EE', borderRadius: 10, fontSize: 20,
                }}>
                  🚛
                </div>

                {/* Details */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>
                    {dispatch.truck_number || 'Unknown Truck'}
                  </div>
                  <div style={{ fontSize: 12, color: '#5A6B62', marginBottom: 2 }}>
                    {dispatch.customers?.name || 'N/A'}
                  </div>
                  <div style={{ fontSize: 11, color: '#8A9B92' }}>
                    {(dispatch.dispatch_pellets || []).map(dp => `${dp.pellet_type_name}: ${parseFloat(dp.quantity_mt).toFixed(1)} MT`).join(', ')}
                  </div>
                </div>

                {/* Quantity Badge */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1B7A45' }}>
                    {(dispatch.total_mt || 0).toFixed(1)}
                  </div>
                  <div style={{ fontSize: 10, color: '#5A6B62' }}>MT</div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ background: '#F5F7F6', borderRadius: 12, border: '1.5px solid #E2E8E4', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <TrendingUp size={16} style={{ color: '#1B7A45' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', textTransform: 'uppercase' }}>
                Dispatch Summary
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(pelletSummary).map(([pelletType, qty]) => (
                <div key={pelletType} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#1A1A2E' }}>
                  <span>{pelletType}:</span>
                  <span style={{ fontWeight: 600, color: '#1B7A45' }}>{qty.toFixed(1)} MT</span>
                </div>
              ))}
              <div style={{ height: '1.5px', background: '#E2E8E4', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#1B7A45' }}>
                <span>GRAND TOTAL</span>
                <span>{totalQuantity.toFixed(1)} MT • {totalTrucks} truck{totalTrucks !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={goToDispatchTab}
            style={{
              width: '100%', padding: '12px 0',
              background: 'white', border: '1.5px solid #1B7A45',
              borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#1B7A45',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <ExternalLink size={14} /> Go to Dispatch Tab
          </button>
        </>
      )}

      {/* Refresh button */}
      <button
        onClick={loadDispatches}
        style={{
          width: '100%', padding: '10px 0',
          background: '#F5F7F6', border: '1px solid #E2E8E4',
          borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#5A6B62',
          cursor: 'pointer',
        }}
      >
        🔄 Refresh Dispatches
      </button>
    </div>
  )
}
