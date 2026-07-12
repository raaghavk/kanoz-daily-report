import { useState, useEffect } from 'react'
import AddTransporterModal from '../../components/AddTransporterModal'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import Modal from '../../components/Modal'
import { Search, Plus, Phone, MessageSquare, Loader2, AlertCircle } from 'lucide-react'
import PageHeader from '../../components/PageHeader'

export default function TransporterList() {
  const { plant } = useAuth()
  const navigate = useNavigate()
  const [transporters, setTransporters] = useState([])
  const [filteredTransporters, setFilteredTransporters] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', category: '', vehicle_number: '', driver_name: '', driver_phone: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (plant?.org_id) fetchTransporters()
  }, [plant]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      setFilteredTransporters(transporters.filter(t => t.name.toLowerCase().includes(q) || (t.phone || '').includes(q)))
    } else {
      setFilteredTransporters(transporters)
    }
  }, [searchQuery, transporters])

  async function fetchTransporters() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('transporters').select('*').eq('org_id', plant.org_id).eq('is_active', true).order('name')
      if (error) throw error
      setTransporters(data || [])
    } catch (err) {
      console.error('Error fetching transporters:', err)
      showToast('Failed to load transporters', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleCall(phone) { window.location.href = `tel:${phone}` }
  function handleSMS(phone) { window.location.href = `sms:${phone}` }

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader title="Transporters" subtitle="Vehicle transport partners" backTo="/settings" />
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a8d7a' }} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, outline: 'none', background: '#fffdf5', border: '1.5px solid #e5ddd0', color: '#2c2c2c', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', paddingBottom: 100 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <Loader2 size={32} style={{ color: '#2d6a4f', marginBottom: 8, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#595c4a' }}>Loading transporters...</p>
          </div>
        ) : filteredTransporters.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e5ddd0', padding: 32, textAlign: 'center' }}>
            <AlertCircle size={32} style={{ color: '#b5b8a8', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: '#595c4a', marginBottom: 4 }}>
              {searchQuery ? 'No transporters found' : 'No transporters added yet'}
            </p>
            <p style={{ fontSize: 12, color: '#b5b8a8', marginBottom: 16 }}>
              {searchQuery ? 'Try a different search' : 'Add your first transporter to get started'}
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
            {filteredTransporters.map((transporter, idx) => (
              <div key={transporter.id} style={{ borderTop: idx > 0 ? '1px solid #f0ebe0' : 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                <button
                  onClick={() => navigate(`/transporters/${transporter.id}`)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {transporter.name}
                  </div>
                  {(transporter.category || transporter.vehicle_number) && (
                    <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>
                      {[transporter.category, transporter.vehicle_number].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {transporter.phone && (
                    <a href={`tel:${transporter.phone}`} onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: '#2d6a4f', textDecoration: 'none', display: 'block', marginTop: 1 }}>
                      📞 {transporter.phone.replace('+91', '')}
                    </a>
                  )}
                  {transporter.address && (
                    <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {transporter.address}
                    </div>
                  )}
                </button>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); handleCall(transporter.phone) }} style={{ width: 34, height: 34, borderRadius: 8, background: '#e8f0ec', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Phone size={14} style={{ color: '#2d6a4f' }} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleSMS(transporter.phone) }} style={{ width: 34, height: 34, borderRadius: 8, background: '#EEF2FF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={14} style={{ color: '#2563EB' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB — fixed bottom right */}
      <button
        onClick={() => setShowAddModal(true)}
        style={{
          position: 'fixed',
          bottom: 88,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#2d6a4f',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(45,106,79,0.35)',
          zIndex: 50,
        }}
        title="Add Transporter"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <AddTransporterModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        orgId={plant?.org_id}
        onAdded={() => fetchTransporters()}
      />
    </div>
  )
}
