import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2 } from 'lucide-react'
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
    <div className="min-h-screen bg-kanoz-bg pb-20">
      <div className="sticky top-0 z-20 bg-kanoz-card border-b border-kanoz-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-kanoz-text mb-4">Raw Material Purchases</h1>

          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {['today', 'week', 'month'].map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  filterTab === tab
                    ? 'bg-kanoz-green text-white'
                    : 'bg-kanoz-bg border border-kanoz-border text-kanoz-text-secondary'
                }`}
              >
                {tab === 'today' ? 'Today' : tab === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-kanoz-green animate-spin" />
          </div>
        ) : dateKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-kanoz-text-secondary font-medium">No purchases found</p>
            <p className="text-kanoz-text-tertiary text-sm mt-1">Start by adding your first raw material purchase</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dateKeys.map(date => (
              <div key={date}>
                <div className="text-xs font-bold text-kanoz-text-tertiary uppercase tracking-wider mb-2.5">
                  {formatDate(date)}
                </div>
                <div className="space-y-2">
                  {groupedPurchases[date].map(purchase => (
                    <button
                      key={purchase.id}
                      onClick={() => navigate(`/purchase/${purchase.id}`)}
                      className="w-full bg-kanoz-card border border-kanoz-border rounded-xl p-4 text-left hover:border-kanoz-green hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-bold text-kanoz-text text-sm">{purchase.suppliers?.name || 'Unknown Supplier'}</div>
                          <div className="text-xs text-kanoz-text-tertiary mt-0.5">{purchase.raw_material_types?.name || 'N/A'}</div>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          purchase.payment_status === 'Paid'
                            ? 'bg-kanoz-green/20 text-kanoz-green'
                            : 'bg-kanoz-red/20 text-kanoz-red'
                        }`}>
                          {purchase.payment_status || 'Pending'}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-kanoz-text-tertiary">Quantity</div>
                          <div className="font-bold text-kanoz-text">{(purchase.final_quantity || 0).toFixed(2)} t</div>
                        </div>
                        <div>
                          <div className="text-kanoz-text-tertiary">Rate</div>
                          <div className="font-bold text-kanoz-text">₹{(purchase.rate_per_kg || 0).toFixed(2)}/kg</div>
                        </div>
                        <div>
                          <div className="text-kanoz-text-tertiary">Amount</div>
                          <div className="font-bold text-kanoz-text">{formatCurrency(purchase.total_amount)}</div>
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
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-kanoz-green text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        aria-label="New purchase"
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
