import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Loader2, Filter, ChevronDown, ChevronRight } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'
import { getLocalDate } from '../../lib/dateUtils'

export default function PurchaseList() {
  const navigate = useNavigate()
  const { plant } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [groupedPurchases, setGroupedPurchases] = useState({})
  const [collapsedDates, setCollapsedDates] = useState({})

  // Persist filter tab in URL
  const filterTab = searchParams.get('tab') || 'month'
  function setFilterTab(tab) {
    setSearchParams({ tab }, { replace: true })
  }

  // Filter state for 'all' tab
  const [showFilters, setShowFilters] = useState(false)
  const [filterSupplier, setFilterSupplier] = useState('')
  const [filterRMType, setFilterRMType] = useState('')
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [rmTypes, setRmTypes] = useState([])

  // Load filter options
  useEffect(() => {
    if (plant?.id) {
      supabase.from('suppliers').select('id, name').eq('plant_id', plant.id).eq('is_active', true).order('name')
        .then(({ data, error }) => { if (error) console.error('Failed to load suppliers:', error); setSuppliers(data || []) })
      supabase.from('raw_material_types').select('id, name').eq('plant_id', plant.id).eq('is_active', true).order('name')
        .then(({ data, error }) => { if (error) console.error('Failed to load RM types:', error); setRmTypes(data || []) })
    }
  }, [plant?.id])

  useEffect(() => {
    if (plant?.id) {
      fetchPurchases()
    }
  }, [plant?.id, filterTab, filterSupplier, filterRMType, filterPaymentStatus, filterDateFrom, filterDateTo]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPurchases() {
    try {
      setLoading(true)
      const dateFilter = getDateFilter(filterTab)

      let query = supabase
        .from('raw_material_purchases')
        .select(`
          *,
          suppliers (id, name, mobile),
          raw_material_types (id, name)
        `)
        .eq('plant_id', plant?.id)
        .eq('is_deleted', false)
        .order('date', { ascending: false })

      // Apply date filter
      if (filterTab === 'all' && filterDateFrom) {
        query = query.gte('date', filterDateFrom)
      } else {
        query = query.gte('date', dateFilter.start)
      }
      if (filterTab === 'all' && filterDateTo) {
        query = query.lte('date', filterDateTo)
      } else {
        query = query.lte('date', dateFilter.end)
      }

      // Apply supplier/RM type/payment filters for 'all' tab
      if (filterTab === 'all' && filterSupplier) {
        query = query.eq('supplier_id', filterSupplier)
      }
      if (filterTab === 'all' && filterRMType) {
        query = query.eq('raw_material_type_id', filterRMType)
      }
      if (filterTab === 'all' && filterPaymentStatus) {
        query = query.eq('payment_status', filterPaymentStatus)
      }

      const { data, error } = await query
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
      return {
        start: getLocalDate(today),
        end: getLocalDate(today),
      }
    } else if (tab === 'week') {
      start.setDate(today.getDate() - today.getDay())
      return {
        start: getLocalDate(start),
        end: getLocalDate(today),
      }
    } else if (tab === 'month') {
      start.setDate(1)
      return {
        start: getLocalDate(start),
        end: getLocalDate(today),
      }
    } else {
      return {
        start: '2024-01-01',
        end: getLocalDate(today),
      }
    }
  }

  function groupPurchasesByDate(data) {
    const grouped = {}
    data.forEach(purchase => {
      const date = purchase.date || ''
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(purchase)
    })
    setGroupedPurchases(grouped)

    // Collapse all dates except the most recent one
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a))
    const collapsed = {}
    sortedDates.forEach((date, idx) => {
      if (idx > 0) collapsed[date] = true
    })
    setCollapsedDates(collapsed)
  }

  function toggleDateCollapse(date) {
    setCollapsedDates(prev => ({ ...prev, [date]: !prev[date] }))
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function formatCurrency(amount) {
    return '\u20B9' + (Math.round(amount) || 0).toLocaleString('en-IN')
  }

  function getDateTotal(purchases) {
    return purchases.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0)
  }

  function clearFilters() {
    setFilterSupplier('')
    setFilterRMType('')
    setFilterPaymentStatus('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const dateKeys = Object.keys(groupedPurchases).sort((a, b) => new Date(b) - new Date(a))
  const hasActiveFilters = filterSupplier || filterRMType || filterPaymentStatus || filterDateFrom || filterDateTo

  return (
    <div style={{ minHeight: '100%', background: '#fefae0' }}>
      {/* Sticky Header + Tabs */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <PageHeader title="RM Purchase" subtitle="Raw Material Purchases" backTo="/" />

        {/* Filter Tabs */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          background: '#fefae0', borderBottom: '1px solid #e5ddd0', padding: '10px 20px',
        }}>
        {['week', 'month', 'all'].map(tab => (
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
            {tab === 'week' ? 'This Week' : tab === 'month' ? 'This Month' : 'All'}
          </button>
        ))}
        {filterTab === 'all' && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '8px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700,
              whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              background: hasActiveFilters ? '#d4a373' : 'white',
              color: hasActiveFilters ? 'white' : '#2c2c2c',
              borderColor: hasActiveFilters ? '#d4a373' : '#e5ddd0',
            }}
          >
            <Filter size={12} /> Filters
          </button>
        )}
      </div>

        {/* Filters Panel */}
        {filterTab === 'all' && showFilters && (
          <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5ddd0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>Supplier</label>
                <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">All Suppliers</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>RM Type</label>
                <select value={filterRMType} onChange={e => setFilterRMType(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">All Types</option>
                  {rmTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>Status</label>
                <select value={filterPaymentStatus} onChange={e => setFilterPaymentStatus(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">All</option>
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>From</label>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ width: '100%', padding: '8px 6px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8d7a', marginBottom: 4 }}>To</label>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ width: '100%', padding: '8px 6px', borderRadius: 8, border: '1px solid #e5ddd0', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ padding: '6px 12px', background: '#fefae0', border: '1px solid #e5ddd0', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#595c4a', cursor: 'pointer', alignSelf: 'flex-start' }}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
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
            {dateKeys.map(date => {
              const isCollapsed = collapsedDates[date]
              const purchases = groupedPurchases[date]
              const dateTotal = getDateTotal(purchases)

              return (
                <div key={date}>
                  {/* Date Header — clickable to collapse/expand */}
                  <button
                    onClick={() => toggleDateCollapse(date)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '0 0 10px 0', textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isCollapsed
                        ? <ChevronRight size={14} style={{ color: '#8a8d7a' }} />
                        : <ChevronDown size={14} style={{ color: '#8a8d7a' }} />
                      }
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#b5b8a8', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {formatDate(date)}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#2d6a4f' }}>
                      {formatCurrency(dateTotal)} · {purchases.length} entries
                    </span>
                  </button>

                  {/* Purchases — shown only when not collapsed */}
                  {!isCollapsed && (
                    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5ddd0', overflow: 'hidden' }}>
                      {purchases.map((purchase, pIdx) => (
                        <button
                          key={purchase.id}
                          onClick={() => navigate(`/purchase/${purchase.id}`)}
                          style={{
                            width: '100%', textAlign: 'left', cursor: 'pointer',
                            background: 'transparent', border: 'none', padding: '10px 12px',
                            borderTop: pIdx > 0 ? '1px solid #f0ebe0' : 'none',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}
                        >
                          {/* Supplier + Material + Qty */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#2c2c2c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {purchase.suppliers?.name || 'Unknown'}
                            </div>
                            <div style={{ fontSize: 10, color: '#8a8d7a', marginTop: 1 }}>
                              {purchase.raw_material_types?.name || 'N/A'} · {Math.round(purchase.final_quantity || 0).toLocaleString('en-IN')} kg
                            </div>
                          </div>
                          {/* Amount + Status */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#2c2c2c' }}>{formatCurrency(purchase.total_amount)}</div>
                            <div style={{
                              fontSize: 9, fontWeight: 700, marginTop: 2,
                              color: purchase.payment_status === 'Paid' ? '#15803D' : '#DC2626'
                            }}>
                              {purchase.payment_status || 'Pending'}
                            </div>
                          </div>
                        </button>
                      ))}
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
