import { useState, useEffect } from 'react'
import { Trash2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { showToast } from './Toast'

export default function DeleteRequestButton({ entityType, entityId, entityLabel, onRequestSent, containerStyle }) {
  const { employee, plant } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingRequest, setPendingRequest] = useState(null)

  // Check for existing pending request on mount
  useEffect(() => {
    const checkPendingRequest = async () => {
      if (!entityId || !entityType) return
      const { data } = await supabase
        .from('delete_requests')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('status', 'pending')
        .single()

      if (data) {
        setPendingRequest(data)
      }
    }

    checkPendingRequest()
  }, [entityType, entityId])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      showToast('Please provide a reason', 'error')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('delete_requests').insert([
        {
          entity_type: entityType,
          entity_id: entityId,
          requested_by: employee.id,
          reason: reason.trim(),
          org_id: plant.org_id,
          status: 'pending',
        },
      ])

      if (error) throw error

      showToast('Deletion request submitted', 'success')
      // Notify admins
      import('../lib/notifications').then(({ sendNotification }) => {
        sendNotification('delete_request_raised', {
          entity_type: entityType,
          entity_label: entityLabel,
          requested_by: employee?.name || 'Someone',
          plant: plant?.name || '',
        })
      }).catch(() => {})
      setReason('')
      setShowModal(false)
      setPendingRequest({
        entity_type: entityType,
        entity_id: entityId,
        reason: reason.trim(),
      })

      if (onRequestSent) {
        onRequestSent()
      }
    } catch (err) {
      console.error(err)
      showToast('Error submitting request', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Show pending badge if request exists
  if (pendingRequest) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px 12px',
            borderRadius: 12,
            background: '#ffd966',
            color: '#854d0e',
            fontSize: 13,
            fontWeight: 600,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <AlertCircle size={16} />
          <span>Deletion Requested</span>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <button
        onClick={() => setShowModal(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '14px 0',
          borderRadius: 12,
          background: '#FEE2E2',
          color: '#B91C1C',
          border: '1.5px solid #FECACA',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Trash2 size={14} />
        Request Delete
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !loading && setShowModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#2c2c2c',
                margin: '0 0 16px 0',
              }}
            >
              Request Deletion
            </h3>

            <div
              style={{
                marginBottom: 16,
                padding: 12,
                background: '#fefae0',
                borderRadius: 8,
                borderLeft: '4px solid #2d6a4f',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#595c4a',
                  marginBottom: 4,
                }}
              >
                Entity
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#2c2c2c',
                }}
              >
                {entityLabel}
              </div>
            </div>

            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#2c2c2c',
                marginBottom: 8,
              }}
            >
              Reason for deletion
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this item needs to be deleted"
              style={{
                width: '100%',
                height: 100,
                padding: 10,
                borderRadius: 8,
                border: `1px solid #e5ddd0`,
                fontSize: 13,
                fontFamily: 'inherit',
                color: '#2c2c2c',
                boxSizing: 'border-box',
                resize: 'none',
              }}
            />
            <div
              style={{
                fontSize: 12,
                color: '#595c4a',
                marginTop: 4,
                marginBottom: 20,
              }}
            >
              Reason is required
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: `1px solid #e5ddd0`,
                  background: '#fff',
                  color: '#2c2c2c',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !reason.trim()}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: !reason.trim() ? '#ccc' : '#d32f2f',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !reason.trim() || loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
