import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { Search, Plus, Phone, MessageSquare, Loader2, AlertCircle } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

const TransporterList = () => {
  const { plant } = useAuth()
  const [transporters, setTransporters] = useState([])
  const [filteredTransporters, setFilteredTransporters] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchTransporters()
  }, [])

  const fetchTransporters = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('transporters')
        .select('*')
        .eq('org_id', plant.org_id)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setTransporters(data || [])
      setFilteredTransporters(data || [])
    } catch (err) {
      console.error('Error fetching transporters:', err)
      showToast('Failed to load transporters', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value) => {
    setSearchTerm(value)
    const filtered = transporters.filter(
      (transporter) =>
        transporter.name.toLowerCase().includes(value.toLowerCase()) ||
        transporter.phone.includes(value)
    )
    setFilteredTransporters(filtered)
  }

  const handleAddTransporter = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      showToast('Name and phone are required', 'error')
      return
    }

    try {
      setSubmitting(true)
      const { error } = await supabase.from('transporters').insert([
        {
          org_id: plant.org_id,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim() || null,
          is_active: true,
        },
      ])

      if (error) throw error

      showToast('Transporter added successfully', 'success')
      setFormData({ name: '', phone: '', address: '' })
      setShowAddModal(false)
      fetchTransporters()
    } catch (err) {
      console.error('Error adding transporter:', err)
      showToast('Failed to add transporter', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCall = (phone) => {
    window.location.href = `tel:${phone}`
  }

  const handleSMS = (phone) => {
    window.location.href = `sms:${phone}`
  }

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    background: '#fefae0',
    fontFamily: 'Inter, sans-serif',
  }

  const headerStyle = {
    flexShrink: 0,
    padding: '0 16px',
  }

  const searchContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#fff',
    border: `1px solid #e5ddd0`,
    borderRadius: '12px',
    padding: '12px 16px',
    margin: '16px',
    marginBottom: '0',
  }

  const searchInputStyle = {
    flex: 1,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '16px',
    color: '#2c2c2c',
    fontFamily: 'Inter, sans-serif',
  }

  const listContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
  }

  const rowStyle = {
    background: '#fff',
    border: `1px solid #e5ddd0`,
    borderRadius: '14px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  }

  const rowInfoStyle = {
    flex: 1,
    minWidth: 0,
  }

  const rowNameStyle = {
    fontSize: '16px',
    fontWeight: '500',
    color: '#2c2c2c',
    margin: '0 0 4px 0',
  }

  const rowAddressStyle = {
    fontSize: '13px',
    color: '#595c4a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    margin: 0,
  }

  const rowButtonsStyle = {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  }

  const phoneButtonStyle = {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: '#e8f0ec',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  const smsButtonStyle = {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: '#EEF2FF',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  const fabStyle = {
    position: 'fixed',
    bottom: '80px',
    right: '16px',
    background: '#2d6a4f',
    border: 'none',
    borderRadius: '50%',
    width: '56px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(45, 106, 79, 0.3)',
    zIndex: 40,
  }

  const emptyStateStyle = {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#595c4a',
  }

  const emptyIconStyle = {
    width: '48px',
    height: '48px',
    margin: '0 auto 16px',
    opacity: 0.5,
  }

  const modalButtonsStyle = {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  }

  const cancelButtonStyle = {
    flex: 1,
    padding: '12px 16px',
    border: `1px solid #e5ddd0`,
    background: '#fff',
    borderRadius: '12px',
    color: '#2c2c2c',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: 'Inter, sans-serif',
  }

  const submitButtonStyle = {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    background: '#2d6a4f',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: 'Inter, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: `1px solid #e5ddd0`,
    borderRadius: '12px',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    color: '#2c2c2c',
    marginBottom: '16px',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#2c2c2c',
    marginBottom: '6px',
    display: 'block',
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <PageHeader title="Transporters" subtitle="Vehicle transport partners" backTo="/settings" />
        </div>
        <div style={{ textAlign: 'center', padding: '48px 24px', flex: 1, overflowY: 'auto' }}>
          <Loader2 style={{ width: '32px', height: '32px', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          button:hover {
            opacity: 0.9;
          }
        `}
      </style>

      {/* Header + Search (sticky) */}
      <div style={{ flexShrink: 0 }}>
        <div style={headerStyle}>
          <PageHeader title="Transporters" subtitle="Vehicle transport partners" backTo="/settings" />
        </div>

        <div style={searchContainerStyle}>
          <Search size={20} color="#595c4a" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredTransporters.length === 0 ? (
          <div style={emptyStateStyle}>
            <AlertCircle style={emptyIconStyle} />
            <p style={{ margin: 0 }}>
              {searchTerm ? 'No transporters match your search' : 'No transporters yet. Add one to get started.'}
            </p>
          </div>
        ) : (
          <div style={listContainerStyle}>
          {filteredTransporters.map((transporter) => (
            <div key={transporter.id} style={rowStyle}>
              <div style={rowInfoStyle}>
                <h3 style={rowNameStyle}>{transporter.name}</h3>
                {transporter.address && <p style={rowAddressStyle}>{transporter.address}</p>}
              </div>
              <div style={rowButtonsStyle}>
                <button
                  onClick={() => handleCall(transporter.phone)}
                  style={phoneButtonStyle}
                  title="Call"
                  aria-label="Call transporter"
                >
                  <Phone size={14} style={{ color: '#2d6a4f' }} />
                </button>
                <button
                  onClick={() => handleSMS(transporter.phone)}
                  style={smsButtonStyle}
                  title="SMS"
                  aria-label="Send SMS to transporter"
                >
                  <MessageSquare size={14} style={{ color: '#2563EB' }} />
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowAddModal(true)}
        style={{ ...fabStyle, zIndex: 50 }}
        title="Add transporter"
        aria-label="Add transporter"
      >
        <Plus size={28} color="#fff" />
      </button>

      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setFormData({ name: '', phone: '', address: '' })
        }}
        title="Add Transporter"
      >
        <div>
          <label style={labelStyle}>
            Name <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Transporter name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={inputStyle}
          />

          <label style={labelStyle}>
            Phone <span style={{ color: '#d32f2f' }}>*</span>
          </label>
          <input
            type="tel"
            placeholder="Phone number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            style={inputStyle}
          />

          <label style={labelStyle}>Address</label>
          <textarea
            placeholder="Address (optional)"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          />

          <div style={modalButtonsStyle}>
            <button
              onClick={() => {
                setShowAddModal(false)
                setFormData({ name: '', phone: '', address: '' })
              }}
              style={cancelButtonStyle}
            >
              Cancel
            </button>
            <button onClick={handleAddTransporter} style={submitButtonStyle} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Adding...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Add Transporter
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default TransporterList
