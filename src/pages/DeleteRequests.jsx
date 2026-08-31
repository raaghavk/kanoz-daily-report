import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import { showToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

const ENTITY_BADGES = {
  purchase: { bg: '#2d6a4f', label: 'Purchase' },
  dispatch: { bg: '#ff9800', label: 'Dispatch' },
  shift_report: { bg: '#2196f3', label: 'Shift Report' },
  asset: { bg: '#dbeafe', color: '#1e40af', label: 'Asset' },
  spare_part: { bg: '#fce7f3', color: '#9d174d', label: 'Spare Part' },
}

const TABLE_MAP = {
  purchase: 'raw_material_purchases',
  dispatch: 'vehicle_dispatches',
  shift_report: 'shift_reports',
  asset: 'assets',
  spare_part: 'spare_part_items',
}

const DETAIL_PATH = {
  purchase: id => `/purchase/${id}`,
  dispatch: id => `/dispatch/${id}`,
  shift_report: id => `/reports/${id}`,
  asset: id => `/assets/${id}`,
  spare_part: id => `/spare-parts/parts/${id}`,
}

async function enrichRequests(rows) {
  const byType = {}
  for (const r of rows) {
    if (!r.entity_type || !r.entity_id) continue
    if (!byType[r.entity_type]) byType[r.entity_type] = []
    byType[r.entity_type].push(r.entity_id)
  }

  const summaries = {}

  if (byType.purchase?.length) {
    const { data } = await supabase
      .from('raw_material_purchases')
      .select('id, date, quantity_kg, total_amount, vehicle_number, raw_material_type, suppliers(name), is_deleted')
      .in('id', byType.purchase)
    for (const p of data || []) {
      const mt = ((Number(p.quantity_kg) || 0) / 1000).toFixed(2)
      summaries[`purchase:${p.id}`] = {
        title: p.raw_material_type || 'Raw material',
        lines: [
          p.date,
          p.suppliers?.name || 'No supplier',
          `${mt} MT`,
          p.total_amount != null ? `₹${Math.round(Number(p.total_amount)).toLocaleString('en-IN')}` : null,
          p.vehicle_number,
          p.is_deleted ? 'Already deleted' : null,
        ].filter(Boolean),
      }
    }
  }

  if (byType.dispatch?.length) {
    const { data } = await supabase
      .from('vehicle_dispatches')
      .select('id, dispatch_date, truck_number, invoice_no, customers(name), dispatch_pellets(quantity_mt), is_deleted')
      .in('id', byType.dispatch)
    for (const d of data || []) {
      const qty = (d.dispatch_pellets || []).reduce((s, x) => s + (Number(x.quantity_mt) || 0), 0)
      summaries[`dispatch:${d.id}`] = {
        title: d.customers?.name || 'Dispatch',
        lines: [
          d.dispatch_date,
          d.truck_number ? `Truck ${d.truck_number}` : null,
          qty ? `${qty} MT` : null,
          d.invoice_no ? `Inv ${d.invoice_no}` : null,
          d.is_deleted ? 'Already deleted' : null,
        ].filter(Boolean),
      }
    }
  }

  if (byType.shift_report?.length) {
    const { data } = await supabase
      .from('shift_reports')
      .select('id, date, shift, pellet_production_mt, is_deleted')
      .in('id', byType.shift_report)
    for (const s of data || []) {
      summaries[`shift_report:${s.id}`] = {
        title: `Shift ${s.shift || '?'}`,
        lines: [
          s.date,
          s.pellet_production_mt != null ? `${s.pellet_production_mt} MT produced` : null,
          s.is_deleted ? 'Already deleted' : null,
        ].filter(Boolean),
      }
    }
  }

  if (byType.asset?.length) {
    const { data } = await supabase.from('assets').select('id, code, name, status, is_deleted').in('id', byType.asset)
    for (const a of data || []) {
      summaries[`asset:${a.id}`] = {
        title: a.name || a.code || 'Asset',
        lines: [a.code, a.status, a.is_deleted ? 'Already deleted' : null].filter(Boolean),
      }
    }
  }

  if (byType.spare_part?.length) {
    const { data } = await supabase.from('spare_part_items').select('id, name, part_number, is_deleted').in('id', byType.spare_part)
    for (const s of data || []) {
      summaries[`spare_part:${s.id}`] = {
        title: s.name || 'Spare part',
        lines: [s.part_number, s.is_deleted ? 'Already deleted' : null].filter(Boolean),
      }
    }
  }

  return rows.map(r => ({
    ...r,
    entitySummary: summaries[`${r.entity_type}:${r.entity_id}`] || null,
  }))
}

export default function DeleteRequests() {
  const { employee, plant } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const [approving, setApproving] = useState(null)
  const [rejecting, setRejecting] = useState(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const status = showResolved ? ['approved', 'rejected'] : ['pending']
      const { data, error } = await supabase
        .from('delete_requests')
        .select(`*, employees!requested_by(id, name)`)
        .eq('org_id', plant.org_id)
        .in('status', status)
        .order('created_at', { ascending: false })
      if (error) throw error
      const enriched = await enrichRequests(data || [])
      setRequests(enriched)
    } catch (err) {
      console.error(err)
      showToast('Error loading requests', 'error')
    } finally {
      setLoading(false)
    }
  }, [showResolved, plant?.org_id])

  useEffect(() => {
    if (plant?.org_id) fetchRequests()
  }, [fetchRequests, plant?.org_id])

  const handleApprove = async (request) => {
    if (!can(employee.role, 'manage_users')) {
      showToast('Only admins can approve delete requests', 'error')
      return
    }
    setApproving(request.id)
    try {
      const { error: updateError } = await supabase
        .from('delete_requests')
        .update({ status: 'approved', reviewed_by: employee.id, reviewed_at: new Date().toISOString() })
        .eq('id', request.id)
      if (updateError) throw updateError

      const table = TABLE_MAP[request.entity_type]
      if (table) {
        const { error: deleteError } = await supabase
          .from(table)
          .update({ is_deleted: true, deleted_by: employee.id, deleted_at: new Date().toISOString() })
          .eq('id', request.entity_id)
        if (deleteError) throw deleteError
      }
      showToast('Request approved', 'success')
      await fetchRequests()
    } catch (err) {
      console.error(err)
      showToast('Error approving request', 'error')
    } finally {
      setApproving(null)
    }
  }

  const handleReject = async (request) => {
    if (!can(employee.role, 'manage_users')) {
      showToast('Only admins can reject delete requests', 'error')
      return
    }
    setRejecting(request.id)
    try {
      const { error } = await supabase
        .from('delete_requests')
        .update({ status: 'rejected', reviewed_by: employee.id, reviewed_at: new Date().toISOString() })
        .eq('id', request.id)
      if (error) throw error
      showToast('Request rejected', 'success')
      await fetchRequests()
    } catch (err) {
      console.error(err)
      showToast('Error rejecting request', 'error')
    } finally {
      setRejecting(null)
    }
  }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <PageHeader title="Delete Requests" backTo="/settings" />
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#2c2c2c', margin: 0 }}>
            {showResolved ? 'Resolved Requests' : 'Pending Requests'}
          </h3>
          <button
            onClick={() => setShowResolved(!showResolved)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #e5ddd0',
              background: showResolved ? '#2d6a4f' : '#fff',
              color: showResolved ? '#fff' : '#2c2c2c',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {showResolved ? 'Show Pending' : 'Show Resolved'}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#595c4a', fontSize: 14 }}>Loading...</div>
        ) : requests.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#595c4a' }}>
            <CheckCircle size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p style={{ fontSize: 16, fontWeight: 500, margin: '0 0 4px 0' }}>
              {showResolved ? 'No resolved requests' : 'No pending delete requests'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {requests.map((request) => {
              const summary = request.entitySummary
              const pathFn = DETAIL_PATH[request.entity_type]
              return (
                <div key={request.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5ddd0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 6,
                        background: ENTITY_BADGES[request.entity_type]?.bg || '#2c2c2c',
                        color: ENTITY_BADGES[request.entity_type]?.color || '#fff',
                        fontSize: 11, fontWeight: 600, marginBottom: 8,
                      }}>
                        {ENTITY_BADGES[request.entity_type]?.label || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 13, color: '#595c4a' }}>
                        Requested by <strong>{request.employees?.name || 'Unknown'}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        {new Date(request.created_at).toLocaleDateString()} at{' '}
                        {new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {request.status === 'pending' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#fff3cd', borderRadius: 6, color: '#856404', fontSize: 12, fontWeight: 500 }}>
                        <Clock size={14} /> Pending
                      </div>
                    )}
                    {request.status === 'approved' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#d4edda', borderRadius: 6, color: '#155724', fontSize: 12, fontWeight: 500 }}>
                        <CheckCircle size={14} /> Approved
                      </div>
                    )}
                    {request.status === 'rejected' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f8d7da', borderRadius: 6, color: '#721c24', fontSize: 12, fontWeight: 500 }}>
                        <XCircle size={14} /> Rejected
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 12, padding: 12, background: '#e8f0ec', borderRadius: 8, border: '1px solid #c5d9ce' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Record to delete</div>
                    {summary ? (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{summary.title}</div>
                        <div style={{ fontSize: 12, color: '#595c4a', marginTop: 4 }}>{summary.lines.join(' · ')}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: '#8a8d7a' }}>Record not found (may already be deleted).</div>
                    )}
                    {pathFn && (
                      <button
                        onClick={() => navigate(pathFn(request.entity_id))}
                        style={{ marginTop: 8, padding: '6px 10px', background: '#fff', border: '1px solid #b8d4c4', borderRadius: 8, color: '#2d6a4f', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Open record
                      </button>
                    )}
                  </div>

                  <div style={{ marginBottom: 12, padding: 10, background: '#f9f8f4', borderRadius: 8, borderLeft: '3px solid #2d6a4f' }}>
                    <div style={{ fontSize: 12, color: '#595c4a', marginBottom: 4, fontWeight: 600 }}>Reason</div>
                    <div style={{ fontSize: 13, color: '#2c2c2c' }}>{request.reason || '—'}</div>
                  </div>

                  {request.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => handleApprove(request)}
                        disabled={approving === request.id}
                        style={{ flex: 1, padding: '11px 0', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: approving === request.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <CheckCircle size={16} /> {approving === request.id ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(request)}
                        disabled={rejecting === request.id}
                        style={{ flex: 1, padding: '11px 0', background: '#fff', color: '#b91c1c', border: '1.5px solid #fecaca', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: rejecting === request.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <XCircle size={16} /> {rejecting === request.id ? '…' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
