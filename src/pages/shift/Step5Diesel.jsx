import { memo } from 'react'
import { ChevronDown, Plus, X, Camera } from 'lucide-react'
import PhotoUpload from '../../components/PhotoUpload'

// Helper: format number for display, avoid leading zeros
function numVal(v) {
  if (v === '' || v === null || v === undefined) return ''
  const n = parseFloat(v)
  return isNaN(n) ? '' : n
}

export default memo(function Step5Diesel({ data, updateData }) {
  // Initialize diesel_stock if not exists (via updateData, not prop mutation)
  const dieselStock = data.diesel_stock || { opening: 0, purchases: [], closing: 0 }
  if (!data.diesel_stock) {
    updateData('diesel_stock', dieselStock)
  } else if (!data.diesel_stock.purchases) {
    updateData('diesel_stock', { ...data.diesel_stock, purchases: [] })
  }

  // Equipment list is loaded from Supabase in ShiftWizard
  if (!data.diesel || data.diesel.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#5A6B62' }}>Loading equipment...</div>
  }

  // Calculate totals from purchases
  const purchases = data.diesel_stock.purchases || []
  const totalPurchased = purchases.reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
  const totalCost = purchases.reduce((sum, p) => {
    const l = parseFloat(p.litres) || 0
    const c = parseFloat(p.cost_per_litre) || 0
    return sum + (l * c)
  }, 0)

  // Calculate total used from all equipment
  const totalUsed = (data.diesel || []).reduce((sum, eq) => sum + (parseFloat(eq.used) || 0), 0)

  // Closing stock
  const opening = parseFloat(data.diesel_stock?.opening) || 0
  const closingStock = opening + totalPurchased - totalUsed

  function addPurchase() {
    const stock = { ...data.diesel_stock }
    stock.purchases = [...(stock.purchases || []), { litres: '', cost_per_litre: '', receipt_url: null }]
    updateData('diesel_stock', stock)
  }

  function updatePurchase(idx, field, value) {
    const stock = { ...data.diesel_stock }
    const purchases = [...(stock.purchases || [])]
    purchases[idx] = { ...purchases[idx], [field]: value }
    stock.purchases = purchases
    // Recalculate total purchased and closing
    const tp = purchases.reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
    stock.purchased = tp
    stock.closing = (parseFloat(stock.opening) || 0) + tp - totalUsed
    updateData('diesel_stock', stock)
  }

  function removePurchase(idx) {
    const stock = { ...data.diesel_stock }
    stock.purchases = (stock.purchases || []).filter((_, i) => i !== idx)
    const tp = stock.purchases.reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
    stock.purchased = tp
    stock.closing = (parseFloat(stock.opening) || 0) + tp - totalUsed
    updateData('diesel_stock', stock)
  }

  function updateEntry(idx, field, value) {
    const entries = [...data.diesel]
    const numValue = value === '' ? 0 : (parseFloat(value) || 0)
    entries[idx] = { ...entries[idx], [field]: numValue }

    // Auto-calculate closing: opening + added - used
    if (field === 'opening' || field === 'added' || field === 'used') {
      entries[idx].closing = (entries[idx].opening || 0) + (entries[idx].added || 0) - (entries[idx].used || 0)
    }

    // Auto-calculate avg_per_hr
    if (field === 'used' || field === 'hours') {
      const hours = entries[idx].hours || 0
      entries[idx].avg_per_hr = hours > 0 ? (entries[idx].used || 0) / hours : 0
    }

    updateData('diesel', entries)

    // Recalculate closing stock (total used may have changed)
    if (field === 'used') {
      const newTotalUsed = entries.reduce((sum, eq) => sum + (parseFloat(eq.used) || 0), 0)
      const stock = { ...data.diesel_stock }
      const tp = (stock.purchases || []).reduce((sum, p) => sum + (parseFloat(p.litres) || 0), 0)
      stock.closing = (parseFloat(stock.opening) || 0) + tp - newTotalUsed
      updateData('diesel_stock', stock)
    }
  }

  function toggleCollapse(idx) {
    const entries = [...data.diesel]
    entries[idx] = { ...entries[idx], collapsed: !entries[idx].collapsed }
    updateData('diesel', entries)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid #E2E8E4', fontSize: 13, outline: 'none', background: '#fff'
  }
  const readOnlyStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #E2E8E4', fontSize: 12, background: '#F5F7F6',
    color: '#1A1A2E', fontWeight: 600
  }
  const labelStyle = { display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Diesel Stock Summary Card */}
      <div style={{
        background: '#FFF8E6', borderRadius: 14, border: '1.5px solid #F0D98C', padding: 16
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#D4960A', margin: 0 }}>DIESEL STOCK</h3>
          <div style={{ background: '#D4960A', color: '#fff', fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 4 }}>
            Tank
          </div>
        </div>

        {/* Big Numbers Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 10, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>Open L</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>{opening}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 10, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>+Purch L</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1B7A45' }}>{totalPurchased}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 10, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>-Used L</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E53E3E' }}>{totalUsed}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 10, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>Close L</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#D4960A' }}>{closingStock}</div>
          </div>
        </div>

        {totalCost > 0 && (
          <div style={{ textAlign: 'center', padding: '6px 0', background: '#FEF3C7', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#92400E' }}>
            Total Purchase Cost: ₹{totalCost.toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {/* Diesel Purchases Section */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>Diesel Purchases</h3>
          <button
            onClick={addPurchase}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              background: '#E8F5EE', color: '#1B7A45', border: 'none', borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {purchases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: 12 }}>
            No diesel purchased this shift. Tap "Add" to log a purchase.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {purchases.map((p, idx) => (
              <div key={idx} style={{
                background: '#FAFAFA', borderRadius: 10, border: '1px solid #E8E8E8', padding: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#5A6B62' }}>Purchase #{idx + 1}</span>
                  <button onClick={() => removePurchase(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <X size={16} color="#E53E3E" />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={labelStyle}>Litres</label>
                    <input
                      type="number" inputMode="decimal" step="any"
                      value={numVal(p.litres)}
                      onChange={e => updatePurchase(idx, 'litres', e.target.value)}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Cost per Litre (₹)</label>
                    <input
                      type="number" inputMode="decimal" step="any"
                      value={numVal(p.cost_per_litre)}
                      onChange={e => updatePurchase(idx, 'cost_per_litre', e.target.value)}
                      placeholder="0"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Total Cost (₹)</label>
                  <div style={readOnlyStyle}>
                    ₹{((parseFloat(p.litres) || 0) * (parseFloat(p.cost_per_litre) || 0)).toLocaleString('en-IN')}
                  </div>
                </div>
                <PhotoUpload
                  label="Receipt Photo"
                  value={p.receipt_url}
                  onChange={url => updatePurchase(idx, 'receipt_url', url)}
                  bucket="photos"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipment Cards */}
      {data.diesel.map((entry, idx) => (
        <div key={entry.id} style={{
          background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', overflow: 'hidden'
        }}>
          {/* Equipment Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px',
            borderBottom: entry.collapsed ? 'none' : '1.5px solid #E2E8E4'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>{entry.equipment_name}</h4>
              <div style={{ background: '#1B7A45', color: '#fff', fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 3 }}>
                Running
              </div>
            </div>
            <button onClick={() => toggleCollapse(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A6B62', padding: 0 }}>
              <ChevronDown size={20} style={{ transform: entry.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
          </div>

          {!entry.collapsed && (
            <div style={{ padding: 16 }}>
              {/* Row 1: Opening | Added */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>OPENING (L)</label>
                  <div style={readOnlyStyle}>{entry.opening || 0}</div>
                </div>
                <div>
                  <label style={labelStyle}>ADDED (L)</label>
                  <input type="number" inputMode="decimal" step="any"
                    value={numVal(entry.added)} onChange={e => updateEntry(idx, 'added', e.target.value)}
                    placeholder="0" style={inputStyle} />
                </div>
              </div>
              {/* Row 2: Used | Closing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>USED (L)</label>
                  <input type="number" inputMode="decimal" step="any"
                    value={numVal(entry.used)} onChange={e => updateEntry(idx, 'used', e.target.value)}
                    placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CLOSING (L)</label>
                  <div style={readOnlyStyle}>{entry.closing || 0}</div>
                </div>
              </div>
              {/* Row 3: Hrs Worked | Avg L/Hr */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>HRS WORKED</label>
                  <input type="number" inputMode="decimal" step="any"
                    value={numVal(entry.hours)} onChange={e => updateEntry(idx, 'hours', e.target.value)}
                    placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>AVG L/HR</label>
                  <div style={readOnlyStyle}>{entry.avg_per_hr ? entry.avg_per_hr.toFixed(2) : '0.00'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
})
