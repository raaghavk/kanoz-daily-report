import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Loader2, TrendingUp } from 'lucide-react'

export default function Step6Dispatch({ data, plant }) {
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
        .select('*')
        .eq('plant_id', plant.id)
        .eq('date', today)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDispatches(dispatchData || [])
    } catch (err) {
      console.error('Error loading dispatches:', err)
      setDispatches([])
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals by pellet type
  const calculateSummary = () => {
    const summary = {}
    let totalTrucks = 0
    let totalQuantity = 0

    dispatches.forEach(d => {
      totalTrucks += 1
      // Assume dispatches have a pellet_type and quantity field
      if (d.pellet_type && d.quantity) {
        const qty = parseFloat(d.quantity) || 0
        summary[d.pellet_type] = (summary[d.pellet_type] || 0) + qty
        totalQuantity += qty
      }
    })

    return { summary, totalTrucks, totalQuantity }
  }

  const { summary, totalTrucks, totalQuantity } = calculateSummary()

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
            onClick={() => navigate('/dispatch')}
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
            Go to Dispatch Tab →
          </button>
        </div>
      )}

      {/* Dispatch Cards */}
      {!loading && dispatches.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dispatches.map((dispatch, idx) => (
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    background: '#E8F5EE',
                    borderRadius: 10,
                    fontSize: 20,
                  }}
                >
                  🚛
                </div>

                {/* Details */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>
                    Truck {dispatch.truck_number || `#${idx + 1}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#5A6B62', marginBottom: 2 }}>
                    Destination: {dispatch.destination || 'N/A'}
                  </div>
                  <div style={{ fontSize: 12, color: '#5A6B62' }}>
                    {dispatch.pellet_type || 'Pellet'}: {dispatch.quantity ? `${parseFloat(dispatch.quantity).toFixed(1)} MT` : 'N/A'}
                  </div>
                </div>

                {/* Quantity Badge */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1B7A45' }}>
                    {dispatch.quantity ? `${parseFloat(dispatch.quantity).toFixed(1)}` : '0'}
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
              {/* Pellet Type Breakdown */}
              {Object.entries(summary).map(([pelletType, qty]) => (
                <div
                  key={pelletType}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: '#1A1A2E',
                  }}
                >
                  <span>{pelletType}:</span>
                  <span style={{ fontWeight: 600, color: '#1B7A45' }}>{qty.toFixed(1)} MT</span>
                </div>
              ))}

              {/* Divider */}
              <div style={{ height: '1.5px', background: '#E2E8E4', margin: '8px 0' }} />

              {/* Grand Total */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1B7A45',
                }}
              >
                <span>GRAND TOTAL</span>
                <span>
                  {totalQuantity.toFixed(1)} MT • {totalTrucks} truck{totalTrucks !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => navigate('/dispatch')}
            style={{
              width: '100%',
              padding: '12px 0',
              background: 'white',
              border: '1.5px solid #1B7A45',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              color: '#1B7A45',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.target.style.background = '#E8F5EE'
            }}
            onMouseLeave={e => {
              e.target.style.background = 'white'
            }}
          >
            Go to Dispatch Tab →
          </button>
        </>
      )}
    </div>
  )
}
