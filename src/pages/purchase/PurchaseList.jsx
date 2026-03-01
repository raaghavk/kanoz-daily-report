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
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState('today')
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
        .from('rm_purchases')
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

      setPurchases(data || [])
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
    } else {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      return {
        start: start.toISOString().split('T')[0],
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
    <div style={{ minHeight: '100vh', background: '#F5F7F6', paddingBottom: 80 }}>
      <PageHeader title="RM Purchase" subtitle="Raw Material Purchases" backTo="/" />

      {/* Filter Tabs */}
      <div className="sticky top-0 z-20 flex gap-2 overflow-x-auto" style={{ background: '#F5F7F6', borderBottom: '1px solid #E2E8E4', padding: '10px 20px' }}>
        {['today', 'week', 'month'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all"
            style={filterTab === tab
              ? { background: '#1B7A45', color: 'white' }
              : { background: 'white', color: '#1A1A2E', border: '1px solid #E2E8E4' }
            }
          >
            {tab === 'today' ? 'Today' : tab === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin" style={{ color: '#1B7A45' }} />
          </div>
        ) : dateKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-2">📋</div>
            <p style={{ color: '#5A6B62', fontWeight: 500 }}>No purchases found</p>
            <p style={{ color: '#C5CFC8', fontSize: 13, marginTop: 4 }}>Start by adding your first raw material purchase</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {dateKeys.map(date => (
              <div key={date}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#C5CFC8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                  {formatDate(date)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupedPurchases[date].map(purchase => (
                    <button
                      key={purchase.id}
                      onClick={() => navigate(`/purchase/${purchase.id}`)}
                      className="w-full text-left"
                      style={{ background: '#fff', border: '1.5px solid #E2E8E4', borderRadius: 14, padding: 16 }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{purchase.suppliers?.name || 'Unknown Supplier'}</div>
                          <div style={{ fontSize: 12, color: '#C5CFC8', marginTop: 2 }}>{purchase.raw_material_types?.name || 'N/A'}</div>
                        </div>
                        <div style={
                          purchase.payment_status === 'Paid'
                            ? { background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }
                            : { background: '#FEE2E2', color: '#DC2626', padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700 }
                        }>
                          {purchase.payment_status || 'Pending'}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div style={{ color: '#C5CFC8' }}>Quantity</div>
                          <div style={{ fontWeight: 700, color: '#1A1A2E' }}>{(purchase.final_quantity || 0).toFixed(2)} t</div>
                        </div>
                        <div>
                          <div style={{ color: '#C5CFC8' }}>Rate</div>
                          <div style={{ fontWeight: 700, color: '#1A1A2E' }}>₹{(purchase.rate_per_kg || 0).toFixed(2)}/kg</div>
                        </div>
                        <div>
                          <div style={{ color: '#C5CFC8' }}>Amount</div>
                          <div style={{ fontWeight: 700, color: '#1A1A2E' }}>{formatCurrency(purchase.total_amount)}</div>
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
        className="fixed flex items-center justify-center"
        style={{ bottom: 96, right: 16, width: 56, height: 56, borderRadius: '50%', background: '#1B7A45', color: 'white', boxShadow: '0 4px 14px rgba(27,122,69,0.3)' }}
        aria-label="New purchase"
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
