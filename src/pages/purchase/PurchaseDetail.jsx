import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { useAuth } from '../../context/AuthContext'
import { can } from '../../lib/permissions'
import { kgToMtStr } from '../../lib/units'
import PageHeader from '../../components/PageHeader'
import DeleteRequestButton from '../../components/DeleteRequestButton'
import { Loader2, Edit3, X, CheckCircle, Download, Trash2 } from 'lucide-react'

export default function PurchaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const queryClient = useQueryClient()
  const [showPhoto, setShowPhoto] = useState(false)
  const [markingLeg, setMarkingLeg] = useState(null)
  const [createdByName, setCreatedByName] = useState(null)

  const { data: purchase, isLoading, isError } = useQuery({
    queryKey: ['purchase', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_material_purchases')
        .select(`*, suppliers(id, name, mobile), raw_material_types(id, name), transporters(id, name)`)
        .eq('id', id)
        .eq('is_deleted', false)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (purchase?.created_by) {
      supabase.from('employees').select('name').eq('id', purchase.created_by).single()
        .then(({ data }) => { if (data) setCreatedByName(data.name) })
    }
  }, [purchase?.created_by])

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
          <PageHeader title="Purchase Detail" />
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
          <PageHeader title="Purchase Detail" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, textAlign: 'center', color: '#d32f2f' }}>Failed to load purchase. Please go back and try again.</div>
      </div>
    )
  }

  if (!purchase) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#fefae0' }}>
        <div style={{ flexShrink: 0 }}>
          <PageHeader title="Purchase Detail" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, textAlign: 'center', color: '#595c4a' }}>Purchase not found</div>
      </div>
    )
  }

  const avgRatePerKg = purchase.quantity_kg > 0
    ? (purchase.total_amount / purchase.quantity_kg)
    : 0

  const totalCharges = (parseFloat((purchase.loading_expense || purchase.loading_charges || 0)) || 0) +
    (parseFloat((purchase.unloading_expense || purchase.unloading_charges || 0)) || 0) +
    (parseFloat((purchase.transport_expense || purchase.transport_charges || 0)) || 0) +
    (parseFloat((purchase.other_expense || 0)) || 0)

  // Two independent payment legs: the raw-material supplier (paid when RM cost > 0)
  // and the transporter/vehicle owner (paid when transport cost > 0). Marking a leg
  // also recomputes the overall payment_status = every applicable leg is paid.
  async function markLegPaid(leg) {
    if (markingLeg) return
    try {
      setMarkingLeg(leg)
      const nowIso = new Date().toISOString()
      const rmApp = (parseFloat(purchase.total_rm_amount) || 0) > 0
      const trApp = (parseFloat(purchase.transport_expense || purchase.transport_charges || 0) || 0) > 0
      const rmPaidNext = leg === 'rm' ? true : purchase.rm_payment_status === 'Paid'
      const trPaidNext = leg === 'transport' ? true : purchase.transport_payment_status === 'Paid'
      const patch = {
        payment_status: ((!rmApp || rmPaidNext) && (!trApp || trPaidNext)) ? 'Paid' : 'Pending',
      }
      if (leg === 'rm') { patch.rm_payment_status = 'Paid'; patch.rm_paid_by = employee?.id || null; patch.rm_paid_at = nowIso }
      else { patch.transport_payment_status = 'Paid'; patch.transport_paid_by = employee?.id || null; patch.transport_paid_at = nowIso }
      const { error } = await supabase.from('raw_material_purchases').update(patch).eq('id', id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['purchase', id] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      showToast(leg === 'rm' ? 'Raw material payment marked Paid' : 'Transport payment marked Paid', 'success')
    } catch (err) {
      console.error('Error marking paid:', err)
      showToast('Failed to update status', 'error')
    } finally {
      setMarkingLeg(null)
    }
  }

  const labelStyle = { fontSize: 11, color: '#8a8d7a', fontWeight: 600 }
  const valueStyle = { fontSize: 14, fontWeight: 600, color: '#2c2c2c', marginTop: 2 }
  const rmCost = parseFloat(purchase.total_rm_amount) || 0
  const transportCost = parseFloat(purchase.transport_expense || purchase.transport_charges || 0) || 0
  const rmApplicable = rmCost > 0
  const transportApplicable = transportCost > 0
  const rmPaid = purchase.rm_payment_status === 'Paid'
  const transportPaid = purchase.transport_payment_status === 'Paid'
  const overallPaid = (!rmApplicable || rmPaid) && (!transportApplicable || transportPaid)
  const transportPayee = purchase.transporters?.name || (purchase.tractor_owner && purchase.tractor_owner !== 'Company Owned' && purchase.tractor_owner !== 'Other owner' ? purchase.tractor_owner : 'Transporter')
  const canPay = can(employee?.role, 'mark_purchase_paid')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#fefae0' }}>
      {/* Header (sticky) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader
          title={purchase.suppliers?.name || 'Purchase Detail'}
          subtitle={formatDate(purchase.date)}
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
            <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', gap: 4 }}>
              {overallPaid ? (<><CheckCircle size={12} /> Paid</>) : 'Pending'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>Final Qty</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{Math.round(purchase.quantity_kg || 0).toLocaleString('en-IN')} kg <span style={{ fontSize: 12, fontWeight: 600, color: '#8a8d7a' }}>· {kgToMtStr(purchase.quantity_kg)} MT</span></div>
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

        {/* Payments — split into raw-material supplier and transporter legs */}
        {(rmApplicable || transportApplicable) && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2d6a4f', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payments</div>
            {rmApplicable && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #f0ebe0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>Raw Material</div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>{purchase.suppliers?.name || 'Supplier'} · {formatCurrency(rmCost)}</div>
                </div>
                {rmPaid ? (
                  <div style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#e8f0ec', color: '#2d6a4f', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Paid</div>
                ) : canPay ? (
                  <button onClick={() => markLegPaid('rm')} disabled={markingLeg === 'rm'} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', opacity: markingLeg === 'rm' ? 0.6 : 1 }}>{markingLeg === 'rm' ? 'Updating...' : 'Mark Paid'}</button>
                ) : (
                  <div style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fdecec', color: '#b91c1c' }}>Pending</div>
                )}
              </div>
            )}
            {transportApplicable && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #f0ebe0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c' }}>Transport</div>
                  <div style={{ fontSize: 11, color: '#8a8d7a', marginTop: 2 }}>{transportPayee} · {formatCurrency(transportCost)}</div>
                </div>
                {transportPaid ? (
                  <div style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#e8f0ec', color: '#2d6a4f', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Paid</div>
                ) : canPay ? (
                  <button onClick={() => markLegPaid('transport')} disabled={markingLeg === 'transport'} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#DC2626', color: '#fff', border: 'none', cursor: 'pointer', opacity: markingLeg === 'transport' ? 0.6 : 1 }}>{markingLeg === 'transport' ? 'Updating...' : 'Mark Paid'}</button>
                ) : (
                  <div style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fdecec', color: '#b91c1c' }}>Pending</div>
                )}
              </div>
            )}
          </div>
        )}

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
            <div>
              <div style={labelStyle}>Serial / Parchi No</div>
              <div style={valueStyle}>{purchase.serial_no || 'N/A'}</div>
            </div>
            {(purchase.transporters?.name) && (
              <div>
                <div style={labelStyle}>Transporter</div>
                <div style={valueStyle}>{purchase.transporters.name}</div>
              </div>
            )}
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
              <div style={valueStyle}>{purchase.quantity_kg ? `${Math.round(purchase.quantity_kg).toLocaleString('en-IN')} kg · ${kgToMtStr(purchase.quantity_kg)} MT` : 'N/A'}</div>
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
            {((purchase.loading_expense || purchase.loading_charges || 0) > 0 || (purchase.unloading_expense || purchase.unloading_charges || 0) > 0 || (purchase.transport_expense || purchase.transport_charges || 0) > 0 || (purchase.other_expense || 0) > 0) && (
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
                {(purchase.other_expense || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#595c4a' }}>Other</span>
                    <span style={{ color: '#2c2c2c' }}>{formatCurrency(purchase.other_expense)}</span>
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

        {/* Created By */}
        {(createdByName || purchase.created_at) && (
          <div style={{ background: '#f5f0e1', borderRadius: 14, padding: '10px 14px', fontSize: 11, color: '#595c4a' }}>
            {createdByName ? 'Created by ' + createdByName : 'Created'}{purchase.created_at ? ' on ' + new Date(purchase.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
          </div>
        )}

        {/* PDF + Request Delete row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={async () => { const { exportPurchasePDF } = await import('../../lib/pdfExport'); exportPurchasePDF(purchase, createdByName); }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: '#e8f0ec', color: '#2d6a4f', border: '1.5px solid #b8d4c4', cursor: 'pointer'
            }}
          >
            <Download size={14} /> PDF
          </button>
          <DeleteRequestButton
            entityType="purchase"
            entityId={id}
            entityLabel={`${purchase.suppliers?.name || 'Purchase'} — ${formatDate(purchase.date)}`}
            onRequestSent={() => navigate('/purchase')}
            containerStyle={{ flex: 1 }}
          />
        </div>
      </div>
    </div>
  )
}
