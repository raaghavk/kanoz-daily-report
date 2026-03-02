import { ChevronDown } from 'lucide-react'

export default function Step5Diesel({ data, updateData }) {
  const EQUIPMENT_LIST = ['Generator', 'Tractor-Diwakar', 'Loader', 'JCB']

  // Initialize diesel_stock if not exists
  if (!data.diesel_stock) {
    data.diesel_stock = { opening: 0, purchased: 0, purchase_cost: 0, closing: 0 }
  }

  // Initialize diesel array with all equipment if empty
  if (!data.diesel || data.diesel.length === 0) {
    data.diesel = EQUIPMENT_LIST.map(name => ({
      id: name,
      equipment_name: name,
      opening: 0,
      added: 0,
      used: 0,
      closing: 0,
      hours: 0,
      avg_per_hr: 0,
      collapsed: false
    }))
  }

  // Calculate total used from all equipment
  const totalUsed = (data.diesel || []).reduce((sum, eq) => sum + (eq.used || 0), 0)

  function updateDieselStock(field, value) {
    const numValue = parseFloat(value) || 0
    const stock = { ...data.diesel_stock }
    stock[field] = numValue

    // Auto-calculate closing stock: opening + purchased - used (from equipment)
    stock.closing = (stock.opening || 0) + (stock.purchased || 0) - totalUsed

    updateData('diesel_stock', stock)
  }

  function updateEntry(idx, field, value) {
    const entries = [...data.diesel]
    const numValue = parseFloat(value) || 0
    entries[idx] = { ...entries[idx], [field]: numValue }

    // Auto-calculate closing: opening + added - used
    if (field === 'opening' || field === 'added' || field === 'used') {
      entries[idx].closing = (entries[idx].opening || 0) + (entries[idx].added || 0) - (entries[idx].used || 0)
    }

    // Auto-calculate avg_per_hr: used / hours
    if (field === 'used' || field === 'hours') {
      const hours = entries[idx].hours || 0
      entries[idx].avg_per_hr = hours > 0 ? (entries[idx].used || 0) / hours : 0
    }

    updateData('diesel', entries)
  }

  function toggleCollapse(idx) {
    const entries = [...data.diesel]
    entries[idx] = { ...entries[idx], collapsed: !entries[idx].collapsed }
    updateData('diesel', entries)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Diesel Stock Card */}
      <div style={{
        background: '#FFF8E6',
        borderRadius: 14,
        border: '1.5px solid #F0D98C',
        padding: 16
      }}>
        {/* Header with Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#D4960A', margin: 0 }}>DIESEL STOCK</h3>
          <div style={{
            background: '#D4960A',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: 4
          }}>
            Today
          </div>
        </div>

        {/* Big Numbers Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>Open L</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E' }}>
              {data.diesel_stock?.opening || 0}
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>+Purch L</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1B7A45' }}>
              {data.diesel_stock?.purchased || 0}
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>-Used L</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#E53E3E' }}>
              {totalUsed}
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>Close L</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#D4960A' }}>
              {data.diesel_stock?.closing || 0}
            </div>
          </div>
        </div>

        {/* Input Fields Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
              DIESEL PURCHASED (L)
            </label>
            <input
              type="number"
              value={data.diesel_stock?.purchased || 0}
              onChange={e => updateDieselStock('purchased', e.target.value)}
              placeholder="0"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1.5px solid #E2E8E4',
                fontSize: 13,
                outline: 'none',
                background: '#fff'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
              PURCHASE COST (₹)
            </label>
            <input
              type="number"
              value={data.diesel_stock?.purchase_cost || 0}
              onChange={e => updateDieselStock('purchase_cost', e.target.value)}
              placeholder="0"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1.5px solid #E2E8E4',
                fontSize: 13,
                outline: 'none',
                background: '#fff'
              }}
            />
          </div>
        </div>
      </div>

      {/* Equipment Cards */}
      {data.diesel.map((entry, idx) => (
        <div key={entry.id} style={{
          background: '#fff',
          borderRadius: 14,
          border: '1.5px solid #E2E8E4',
          padding: 0,
          overflow: 'hidden'
        }}>
          {/* Equipment Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: entry.collapsed ? 'none' : '1.5px solid #E2E8E4',
            background: '#fff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
                {entry.equipment_name}
              </h4>
              <div style={{
                background: '#1B7A45',
                color: '#fff',
                fontSize: 9,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 3
              }}>
                Running
              </div>
            </div>
            <button
              onClick={() => toggleCollapse(idx)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#5A6B62',
                padding: 0
              }}
            >
              <ChevronDown
                size={20}
                style={{
                  transform: entry.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              />
            </button>
          </div>

          {/* Equipment Details - Hidden if Collapsed */}
          {!entry.collapsed && (
            <div style={{ padding: '16px' }}>
              {/* Row 1: Opening | Added */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
                    OPENING (L)
                  </label>
                  <div
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #E2E8E4',
                      fontSize: 12,
                      background: '#F5F7F6',
                      color: '#1A1A2E',
                      fontWeight: 600
                    }}
                  >
                    {entry.opening || 0}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
                    ADDED (L)
                  </label>
                  <input
                    type="number"
                    value={entry.added || 0}
                    onChange={e => updateEntry(idx, 'added', e.target.value)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #E2E8E4',
                      fontSize: 12,
                      outline: 'none',
                      background: '#fff'
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Used | Closing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
                    USED (L)
                  </label>
                  <input
                    type="number"
                    value={entry.used || 0}
                    onChange={e => updateEntry(idx, 'used', e.target.value)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #E2E8E4',
                      fontSize: 12,
                      outline: 'none',
                      background: '#fff'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
                    CLOSING (L)
                  </label>
                  <div
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #E2E8E4',
                      fontSize: 12,
                      background: '#F5F7F6',
                      color: '#1A1A2E',
                      fontWeight: 600
                    }}
                  >
                    {entry.closing || 0}
                  </div>
                </div>
              </div>

              {/* Row 3: Hrs Worked | Avg L/Hr */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
                    HRS WORKED
                  </label>
                  <input
                    type="number"
                    value={entry.hours || 0}
                    onChange={e => updateEntry(idx, 'hours', e.target.value)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1.5px solid #E2E8E4',
                      fontSize: 12,
                      outline: 'none',
                      background: '#fff'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
                    AVG L/HR
                  </label>
                  <div
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #E2E8E4',
                      fontSize: 12,
                      background: '#F5F7F6',
                      color: '#1A1A2E',
                      fontWeight: 600
                    }}
                  >
                    {entry.avg_per_hr ? entry.avg_per_hr.toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
