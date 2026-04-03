import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { showToast } from '../../components/Toast'
import PageHeader from '../../components/PageHeader'
import DeleteRequestButton from '../../components/DeleteRequestButton'
import { Loader2, Edit3, X, CheckCircle } from 'lucide-react'

export default function PurchaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { plant } = useAuth()
  const [showPhoto, setShowPhoto] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)

  const { data: purchase, isLoading, isError } = useQuery({
    queryKey: ['purchase', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_material_purchases')
        .select(`*, suppliers(id, name, mobile), raw_material_types(id, name)`)
        .eq('id', id)
        .eq('plant_id', plant.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id && !!plant?.id,
  })

  function formatCurrency(amount) {
    return '\u20B9' + (Math.round(amount) || 0).toLocaleString('en-IN')
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#fefae0' }}>
        <div style={{ flexShrink: 0 }}>
          <PageHeader title="Purchase Detail" onBack={() => navigate(-1)} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#fefae0' }}>
        <div style={{ flexShrink: 0 }}>
          <PageHeader title="Purchase Detail" onBack={() => navigate(-1)} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, textAlign: 'center', color: '#d32f2f' }}>Failed to load purchase. Please go back and try again.</div>
      </div>
    )
  }

  if (!purchase) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#fefae0' }}>
        <div style={{ flexShrink: 0 }}>
          <PageHeader title="Purchase Detail" onBack={() => navigate(-1)} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, textAlign: 'center', color: '#595c4a' }}>Purchase not found</div>
      </div>
    )
  }

  const avgRatePerKg = (purchase.quantity_kg) > 0
    ? (purchase.total_amount / (purchase.quantity_kg))
    : 0

  const totalCharges = (parseFloat((purchase.loading_expense || purchase.loading_charges || 0)) || 0) +
    (parseFloat((purchase.unloading_expense || purchase.unloading_charges || 0)) || 0) +
    (parseFloat((purchase.transport_expense || purchase.transport_charges || 0)) || 0)

  async function markAsPaid() {
    if (markingPaid) return
    if (purchase.payment_status === 'Paid') return
    try {
      setMarkingPaid(true)
      const { error } = await supabase
        .from('raw_material_purchases')
        .update({ payment_status: 'Paid' })
        .eq('id', id)
        .eq('plant_id', plant.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['purchase', id] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      showToast('Marked as Paid', 'success')
    } catch (err) {
      console.error('Error marking paid:', err)
      showToast('Failed to update status', 'error')
    } finally {
      setMarkingPaid(false)
    }
  }

  const labelStyle = { fontSize: 11, color: '#8a8d7a', fontWeight: 600 }
  const valueStyle = { fontSize: 14, fontWeight: 600, color: '#2c2c2c', marginTop: 2 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#fefae0' }}>
      {/* Header (sticky) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader
          title={purchase.suppliers?.name || 'Purchase Detail'}
          subtitle={formatDate(purchase.date)}
          onBack={() => navigate(-1)}
          rightAction={
            <button
              onClick={() => navigate(`/purchase/${id}/edit`)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <Edit3 size={14} /> Edit
            </button>
          }
        />
      </div>

      {/* Scrollable Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Summary Card */}
        <div style={{ background: '#2d6a4f', borderRadius: 14, padding: 20, color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Total Amount</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{formatCurrency(purchase.total_amount)}</div>
            </div>
            {purchase.payment_status === 'Paid' ? (
              <div style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: 'rgba(255,255,255,0.2)', color: 'white',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <CheckCircle size={12} /> Paid
              </div>
            ) : (
              <button
                onClick={markAsPaid}
                disabled={markingPaid}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: '#DC2626', color: 'white', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  opacity: markingPaid ? 0.6 : 1,
                }}
              >
                {markingPaid ? 'Updating...' : 'Pending \u2014 Tap to mark Paid'}
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>Final Qty</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{Math.round((purchase.quantity_kg) || 0).toLocaleString('en-IN')} kg</div>
            </div>
            <div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>RM Rate</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{'\u20B9'}{(purchase.rate_per_kg || 0).toFixed(2)}/kg</div>
            </div>
            <div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>Avg Cost/kg</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{'\u20B9'}{avgRatePerKg.toFixed(2)}/kg</div>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Purchase Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={labelStyle}>Supplier</div>
              <div style={valueStyle}>{purchase.suppliers?.name || 'N/A'}</div>
            </div>
            <div>
              <div style={labelStyle}>Raw Material</div>
              <div style={valueStyle}>{purchase.raw_material_types?.name || 'N/A'}</div>
            </div>
            <div>
              <div style={labelStyle}>Date</div>
              <div style={valueStyle}>{formatDate(purchase.date)}</div>
            </div>
            <div>
              <div style={labelStyle}>Time</div>
              <div style={valueStyle}>{purchase.purchase_time ? purchase.purchase_time.slice(0, 5) : 'N/A'}</div>
            </div>
            <div>
              <div style={labelStyle}>Vehicle</div>
              <div style={valueStyle}>{purchase.vehicle_number || 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Weight & Quality */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Weight & Quality</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={labelStyle}>Net Weight</div>
              <div style={valueStyle}>{purchase.net_weight ? `${parseFloat(purchase.net_weight).toLocaleString('en-IN')} kg` : 'N/A'}</div>
            </div>
            <div>
              <div style={labelStyle}>Moisture %</div>
              <div style={valueStyle}>{purchase.moisture_percent ? `${purchase.moisture_percent}%` : 'N/A'}</div>
            </div>
            <div>
              <div style={labelStyle}>Deduction</div>
              <div style={valueStyle}>{purchase.deduction_kg ? `${parseFloat(purchase.deduction_kg).toLocaleString('en-IN')} kg` : 'N/A'}</div>
            </div>
            <div>
              <div style={labelStyle}>Final Quantity</div>
              <div style={valueStyle}>{(purchase.quantity_kg) ? `${Math.round((purchase.quantity_kg)).toLocaleString('en-IN')} kg` : 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pricing</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#595c4a' }}>RM Amount</span>
              <span style={{ fontWeight: 600, color: '#2c2c2c' }}>{formatCurrency(purchase.total_rm_amount)}</span>
            </div>
            {((purchase.loading_expense || purchase.loading_charges || 0) > 0 || (purchase.unloading_expense || purchase.unloading_charges || 0) > 0 || (purchase.transport_expense || purchase.transport_charges || 0) > 0) && (
              <>
                {(purchase.loading_expense || purchase.loading_charges || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#595c4a' }}>Loading</span>
                    <span style={{ color: '#2c2c2c' }}>{formatCurrency((purchase.loading_expense || purchase.loading_charges || 0))}</span>
                  </div>
                )}
                {(purchase.unloading_expense || purchase.unloading_charges || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#595c4a' }}>Unloading</span>
                    <span style={{ color: '#2c2c2c' }}>{formatCurrency((purchase.unloading_expense || purchase.unloading_charges || 0))}</span>
                  </div>
                )}
                {(purchase.transport_expense || purchase.transport_charges || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#595c4a' }}>Transport</span>
                    <span style={{ color: '#2c2c2c' }}>{formatCurrency((purchase.transport_expense || purchase.transport_charges || 0))}</span>
                  </div>
                )}
                <div style={{ height: 1, background: '#e5ddd0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#595c4a' }}>Total Charges</span>
                  <span style={{ fontWeight: 600, color: '#2c2c2c' }}>{formatCurrency(totalCharges)}</span>
                </div>
              </>
            )}
            <div style={{ height: 1, background: '#e5ddd0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ fontWeight: 700, color: '#2d6a4f' }}>Total Amount</span>
              <span style={{ fontWeight: 700, color: '#2d6a4f' }}>{formatCurrency(purchase.total_amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, background: '#e8f0ec', padding: '8px 12px', borderRadius: 8 }}>
              <span style={{ fontWeight: 600, color: '#2d6a4f' }}>Avg Cost per kg</span>
              <span style={{ fontWeight: 700, color: '#2d6a4f' }}>{'\u20B9'}{avgRatePerKg.toFixed(2)}/kg</span>
            </div>
          </div>
        </div>

        {/* Photo */}
        {(purchase.katta_parchi_url || purchase.katta_parchi_photo) && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Weight Bridge Photo</div>
            <img
              src={(purchase.katta_parchi_url || purchase.katta_parchi_photo)}
              alt="Weight bridge"
              style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', cursor: 'pointer' }}
              onClick={() => setShowPhoto(true)}
            />
          </div>
        )}

        {/* Fullscreen Photo Overlay */}
        {showPhoto && (purchase.katta_parchi_url || purchase.katta_parchi_photo) && (
          <div
            onClick={() => setShowPhoto(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}
          >
            <button
              onClick={() => setShowPhoto(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10000,
              }}
            >
              <X size={22} color="white" />
            </button>
            <img
              src={(purchase.katta_parchi_url || purchase.katta_parchi_photo)}
              alt="Weight bridge"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '100%', maxHeight: '90vh',
                objectFit: 'contain', borderRadius: 8,
              }}
            />
          </div>
        )}

        {/* Remarks */}
        {purchase.remarks && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Remarks</div>
            <p style={{ fontSize: 13, color: '#595c4a', margin: 0, lineHeight: 1.5 }}>{purchase.remarks}</p>
          </div>
        )}

        <DeleteRequestButton
          entityType="purchase"
          entityId={id}
          entityLabel={`${purchase.suppliers?.name || 'Purchase'} \u2014 ${formatDate(purchase.date)}`}
          onRequestSent={() => navigate('/purchase')}
        />
      </div>
    </div>
  )
}
