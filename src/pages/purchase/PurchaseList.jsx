import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2 } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'

export default function PurchaseList() {
  const navigate = useNavigate()
  const { plant } = useAuth()
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState('month')
  const [groupedPurchases, setGroupedPurchases] = useState({})

  useEffect(() => {
    if (plant?.id) {
      fetchPurchases()
    }
  }, [plant?.id, filterTab])

  async function fetchPurchases() {
    try {
      setLoading(true)
      const dateFilter = getDateFilter(filterTab)

      const { data, error } = await supabase
        .from('raw_material_purchases')
        .select(`
          *,
          suppliers (id, name, mobile),
          raw_material_types (id, name)
        `)
        .eq('plant_id', plant?.id)
        .gte('date', dateFilter.start)
        .lte('date', dateFilter.end)
        .order('date', { ascending: false })

      if (error) throw error

      groupPurchasesByDate(data || [])
    } catch (err) {
      console.error('Error fetching purchases:', err)
      showToast('Failed to load purchases', 'error')
    } finally {
      setLoading(false)
    }
  }

  function getDateFilter(tab) {
    const today = new Date()
    const start = new Date(today)

    if (tab === 'today') {
      start.setHours(0, 0, 0, 0)
      return {
        start: today.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
      }
    } else if (tab === 'week') {
      start.setDate(today.getDate() - today.getDay())
      start.setHours(0, 0, 0, 0)
      return {
        start: start.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
      }
    } else if (tab === 'month') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      return {
        start: start.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
      }
    } else {
      // 'all' — show everything from 2024 onwards
      return {
        start: '2024-01-01',
        end: today.toISOString().split('T')[0],
      }
    }
  }

  function groupPurchasesByDate(data) {
    const grouped = {}
    data.forEach(purchase => {
      const date = purchase.date || ''
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(purchase)
    })
    setGroupedPurchases(grouped)
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  function formatCurrency(amount) {
    return '₹' + (Math.round(amount) || 0).toLocaleString('en-IN')
  }

  const dateKeys = Object.keys(groupedPurchases).sort((a, b) => new Date(b) - new Date(a))

  return (
    <div style={{ minHeight: '100vh', background: '#fefae0', paddingBottom: 80 }}>
      <PageHeader title="RM Purchase" subtitle="Raw Material Purchases" backTo="/" />

      {/* Filter Tabs */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        display: 'flex', gap: 8, overflowX: 'auto',
        background: '#fefae0', borderBottom: '1px solid #e5ddd0', padding: '10px 20px',
      }}>
        {['today', 'week', 'month', 'all'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            style={{
              padding: '8px 16px', borderRadius: 12, fontSize: 12, fontWeight: 700,
              whiteSpace: 'nowrap', transition: 'all 0.2s', border: 'none', cursor: 'pointer',
              ...(filterTab === tab
                ? { background: '#2d6a4f', color: 'white' }
                : { background: 'white', color: '#2c2c2c', border: '1.5px solid #e5ddd0' })
            }}
          >
            {tab === 'today' ? 'Today' : tab === 'week' ? 'This Week' : tab === 'month' ? 'This Month' : 'All'}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <Loader2 size={32} style={{ color: '#2d6a4f', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : dateKeys.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <p style={{ color: '#595c4a', fontWeight: 500 }}>No purchases found</p>
            <p style={{ color: '#b5b8a8', fontSize: 13, marginTop: 4 }}>Start by adding your first raw material purchase</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {dateKeys.map(date => (
              <div key={date}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b5b8a8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                  {formatDate(date)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupedPurchases[date].map(purchase => (
                    <button
                      key={purchase.id}
                      onClick={() => navigate(`/purchase/${purchase.id}`)}
                      style={{ background: '#fff', border: '1.5px solid #e5ddd0', borderRadius: 14, padding: 16, width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#2c2c2c' }}>{purchase.suppliers?.name || 'Unknown Supplier'}</div>
                          <div style={{ fontSize: 12, color: '#b5b8a8', marginTop: 2 }}>{purchase.raw_material_types?.name || 'N/A'}</div>
                        </div>
                        <div style={
                          purchase.payment_status === 'Paid'
                            ? { background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }
                            : { background: '#FEE2E2', color: '#DC2626', padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }
                        }>
                          {purchase.payment_status || 'Pending'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                        <div>
                          <div style={{ color: '#b5b8a8' }}>Quantity</div>
                          <div style={{ fontWeight: 700, color: '#2c2c2c' }}>{Math.round(purchase.final_quantity || 0).toLocaleString('en-IN')} kg</div>
                        </div>
                        <div>
                          <div style={{ color: '#b5b8a8' }}>Rate</div>
                          <div style={{ fontWeight: 700, color: '#2c2c2c' }}>₹{(purchase.rate_per_kg || 0).toFixed(2)}/kg</div>
                        </div>
                        <div>
                          <div style={{ color: '#b5b8a8' }}>Amount</div>
                          <div style={{ fontWeight: 700, color: '#2c2c2c' }}>{formatCurrency(purchase.total_amount)}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/purchase/new')}
        style={{
          position: 'fixed', bottom: 96, right: 16, width: 56, height: 56,
          borderRadius: '50%', background: '#2d6a4f', color: 'white',
          boxShadow: '0 4px 14px rgba(45,106,79,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer',
        }}
        aria-label="New purchase"
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
