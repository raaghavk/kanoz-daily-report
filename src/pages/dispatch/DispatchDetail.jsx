import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { Phone, MessageSquare, MapPin, Truck, Clock, FileText, Image } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function DispatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [dispatch, setDispatch] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchDispatch()
  }, [id])

  async function fetchDispatch() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vehicle_dispatches')
        .select('*, dispatch_pellets(*, pellet_types(name)), customers(name, address)')
        .eq('id', id)
        .single()

      if (error) {
        console.error('Dispatch fetch error:', error)
        if (error.code === 'PGRST116') {
          showToast('Dispatch not found', 'error')
          navigate('/dispatch')
          return
        }
        throw error
      }
      setDispatch(data)
    } catch (err) {
      console.error('Error fetching dispatch:', err)
      showToast('Failed to load dispatch', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: '#595c4a', fontSize: 13 }}>Loading dispatch...</div>
      </div>
    )
  }

  if (!dispatch) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: '#595c4a', fontSize: 13 }}>Dispatch not found</div>
      </div>
    )
  }

  const totalMT = dispatch.dispatch_pellets?.reduce((sum, p) => sum + (parseFloat(p.quantity_mt) || 0), 0) || 0
  const formattedDate = dispatch.date ? new Date(dispatch.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'

  return (
    <div style={{ paddingBottom: 80 }}>
      <PageHeader title="Dispatch Details" subtitle={`Truck ${dispatch.truck_number}`} backTo="/dispatch" />

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Main Info Card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#d4a373', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Truck size={24} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#2c2c2c' }}>{dispatch.truck_number}</div>
              <div style={{ fontSize: 12, color: '#8a8d7a', marginTop: 2 }}>{formattedDate}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2d6a4f' }}>{totalMT.toFixed(1)}</div>
              <div style={{ fontSize: 10, color: '#8a8d7a', fontWeight: 600 }}>MT</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <InfoRow label="Customer" value={dispatch.customers?.name || 'N/A'} />
            <InfoRow label="Destination" value={dispatch.destination || 'N/A'} />
            <InfoRow label="Transporter" value={dispatch.transporter || 'N/A'} />
            <InfoRow label="Invoice No" value={dispatch.invoice_no || 'N/A'} />
            <InfoRow label="Loading Time" value={dispatch.loading_time?.slice(0, 5) || 'N/A'} icon={<Clock size={12} />} />
            <InfoRow label="Dispatch Time" value={dispatch.dispatch_time?.slice(0, 5) || 'N/A'} icon={<Clock size={12} />} />
          </div>
        </div>

        {/* Driver Card */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Driver Info</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c', marginBottom: 8 }}>{dispatch.driver_name || 'N/A'}</div>
          {dispatch.driver_phone && (
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={`tel:${dispatch.driver_phone}`}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 0', borderRadius: 12, background: '#2d6a4f', color: 'white',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none'
                }}
              >
                <Phone size={16} /> Call
              </a>
              <a
                href={`sms:${dispatch.driver_phone}`}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 0', borderRadius: 12, background: '#e8f0ec', color: '#2d6a4f',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none', border: '1.5px solid #b8d4c4'
                }}
              >
                <MessageSquare size={16} /> SMS
              </a>
            </div>
          )}
        </div>

        {/* Pellet Details */}
        {dispatch.dispatch_pellets?.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5ddd0' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1 }}>Pellet Details</div>
            </div>
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead style={{ background: '#fefae0' }}>
                <tr>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>Type</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#2c2c2c', fontSize: 11 }}>Quantity (MT)</th>
                </tr>
              </thead>
              <tbody>
                {dispatch.dispatch_pellets.map((p, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #f0ebe0' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: '#2c2c2c', fontSize: 12 }}>{p.pellet_types?.name || p.pellet_type_name || 'N/A'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#2d6a4f', fontSize: 13 }}>{parseFloat(p.quantity_mt || 0).toFixed(1)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #e5ddd0', background: '#fefae0' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 800, color: '#2c2c2c', fontSize: 12 }}>Total</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: '#2d6a4f', fontSize: 14 }}>{totalMT.toFixed(1)} MT</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Katta Parchi Photo */}
        {dispatch.katta_parchi_url && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Katta Parchi</div>
            <img
              src={dispatch.katta_parchi_url}
              alt="Katta Parchi"
              style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 300 }}
              onError={e => { e.target.style.display = 'none' }}
            />
          </div>
        )}

        {/* Remarks */}
        {dispatch.remarks && (
          <div style={{ background: '#fefae0', border: '1.5px solid #e9c46a', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8a8d7a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Remarks</div>
            <p style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5, margin: 0 }}>{dispatch.remarks}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, icon }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#8a8d7a', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: '#2c2c2c' }}>
        {icon}
        {value}
      </div>
    </div>
  )
}
