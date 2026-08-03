import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import { showToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import { CheckCircle, XCircle, Clock, Shield } from 'lucide-react'

const ENTITY_BADGES = {
  purchase: { bg: '#2d6a4f', label: 'Purchase' },
  dispatch: { bg: '#ff9800', label: 'Dispatch' },
  shift_report: { bg: '#2196f3', label: 'Shift Report' },
  asset: { bg: '#dbeafe', color: '#1e40af', label: 'Asset' },
  spare_part: { bg: '#fce7f3', color: '#9d174d', label: 'Spare Part' },
}

export default function DeleteRequests() {
  const { employee, plant } = useAuth()
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
        .select(`
          *,
          employees!requested_by(id, name)
        `)
        .eq('org_id', plant.org_id)
        .in('status', status)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequests(data || [])
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
        .update({
          status: 'approved',
          reviewed_by: employee.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      const tableMap = { purchase: 'raw_material_purchases', dispatch: 'vehicle_dispatches', shift_report: 'shift_reports', asset: 'assets', spare_part: 'spare_part_items' }
      const table = tableMap[request.entity_type]
      const { error: deleteError } = await supabase
        .from(table)
        .update({ is_deleted: true, deleted_by: employee.id, deleted_at: new Date().toISOString() })
        .eq('id', request.entity_id)

      if (deleteError) throw deleteError

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
        .update({
          status: 'rejected',
          reviewed_by: employee.id,
          reviewed_at: new Date().toISOString(),
        })
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
    <div
      style={{
        minHeight: '100%',
        background: '#fefae0',
      }}
    >
      <PageHeader title="Delete Requests" backTo="/settings" />

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
        }}
      >
        {/* Toggle for resolved requests */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#2c2c2c',
              margin: 0,
            }}
          >
            {showResolved ? 'Resolved Requests' : 'Pending Requests'}
          </h3>
          <button
            onClick={() => setShowResolved(!showResolved)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid #e5ddd0`,
              background: showResolved ? '#2d6a4f' : '#fff',
              color: showResolved ? '#fff' : '#2c2c2c',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              if (!showResolved) e.target.style.background = '#f5f5f5'
            }}
            onMouseOut={(e) => {
              if (!showResolved) e.target.style.background = '#fff'
            }}
          >
            {showResolved ? 'Show Pending' : 'Show Resolved'}
          </button>
        </div>

        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              color: '#595c4a',
              fontSize: 14,
            }}
          >
            Loading...
          </div>
        ) : requests.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
              color: '#595c4a',
            }}
          >
            <CheckCircle size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                margin: '0 0 4px 0',
              }}
            >
              {showResolved ? 'No resolved requests' : 'No pending delete requests'}
            </p>
            <p
              style={{
                fontSize: 13,
                color: '#595c4a',
                margin: 0,
              }}
            >
              {showResolved ? 'All requests have been resolved' : 'Everything is up to date'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 12,
            }}
          >
            {requests.map((request) => (
              <div
                key={request.id}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 16,
                  border: `1px solid #e5ddd0`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {/* Header with badge and requestor */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: ENTITY_BADGES[request.entity_type]?.bg || '#2c2c2c',
                        color: ENTITY_BADGES[request.entity_type]?.color || '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        marginBottom: 8,
                      }}
                    >
                      {ENTITY_BADGES[request.entity_type]?.label || 'Unknown'}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: '#595c4a',
                      }}
                    >
                      Requested by <strong>{request.employees?.name || 'Unknown'}</strong>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#999',
                        marginTop: 2,
                      }}
                    >
                      {new Date(request.created_at).toLocaleDateString()} at{' '}
                      {new Date(request.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Status indicator */}
                  {request.status === 'pending' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        background: '#fff3cd',
                        borderRadius: 6,
                        color: '#856404',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      <Clock size={14} />
                      Pending
                    </div>
                  )}
                  {request.status === 'approved' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        background: '#d4edda',
                        borderRadius: 6,
                        color: '#155724',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      <CheckCircle size={14} />
                      Approved
                    </div>
                  )}
                  {request.status === 'rejected' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        background: '#f8d7da',
                        borderRadius: 6,
                        color: '#721c24',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      <XCircle size={14} />
                      Rejected
                    </div>
                  )}
                </div>

                {/* Reason */}
                <div
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    background: '#f9f8f4',
                    borderRadius: 8,
                    borderLeft: '3px solid #2d6a4f',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#595c4a',
                      marginBottom: 4,
                      fontWeight: 600,
                    }}
                  >
                    Reason
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: '#2c2c2c',
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}
                  >
                    {request.reason}
                  </div>
                </div>

                {/* Entity ID reference */}
                <div
                  style={{
                    fontSize: 11,
                    color: '#999',
                    marginBottom: 12,
                    fontFamily: 'monospace',
                  }}
                >
                  ID: {request.entity_id}
                </div>

                {/* Action buttons - only show for pending requests */}
                {request.status === 'pending' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                    }}
                  >
                    <button
                      onClick={() => handleApprove(request)}
                      disabled={approving === request.id}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#2d6a4f',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: approving === request.id ? 'not-allowed' : 'pointer',
                        opacity: approving === request.id ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => {
                        if (approving !== request.id) e.target.style.background = '#1b4332'
                      }}
                      onMouseOut={(e) => {
                        if (approving !== request.id) e.target.style.background = '#2d6a4f'
                      }}
                    >
                      <CheckCircle size={16} />
                      {approving === request.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(request)}
                      disabled={rejecting === request.id}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#d32f2f',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: rejecting === request.id ? 'not-allowed' : 'pointer',
                        opacity: rejecting === request.id ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'background 0.2s',
                      }}
                      onMouseOver={(e) => {
                        if (rejecting !== request.id) e.target.style.background = '#b71c1c'
                      }}
                      onMouseOut={(e) => {
                        if (rejecting !== request.id) e.target.style.background = '#d32f2f'
                      }}
                    >
                      <XCircle size={16} />
                      {rejecting === request.id ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                )}

                {/* Show reviewer info for resolved requests */}
                {request.status !== 'pending' && request.reviewed_at && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#999',
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px solid #e5ddd0',
                    }}
                  >
                    Reviewed on {new Date(request.reviewed_at).toLocaleDateString()} at{' '}
                    {new Date(request.reviewed_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
