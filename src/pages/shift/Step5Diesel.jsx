import { Plus, Trash2 } from 'lucide-react'

export default function Step5Diesel({ data, updateData }) {
  const equipment = ['Generator', 'Tractor', 'Loader', 'JCB']

  // Initialize diesel_stock if not exists
  if (!data.diesel_stock) {
    data.diesel_stock = { opening: 0, purchased: 0, purchase_cost: 0, used: 0, closing: 0 }
  }

  // Initialize diesel array if not exists
  if (!data.diesel) {
    data.diesel = []
  }

  function updateDieselStock(field, value) {
    const numValue = parseFloat(value) || 0
    const stock = { ...data.diesel_stock }
    stock[field] = numValue

    // Auto-calculate closing stock: opening + purchased - used
    if (field === 'opening' || field === 'purchased' || field === 'used') {
      stock.closing = (stock.opening || 0) + (stock.purchased || 0) - (stock.used || 0)
    }

    updateData('diesel_stock', stock)
  }

  function addEntry() {
    updateData('diesel', [...data.diesel, {
      id: Date.now(),
      equipment_name: '',
      opening: 0,
      added: 0,
      used: 0,
      closing: 0,
      hours: 0,
      avg_per_hr: 0
    }])
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

  function removeEntry(idx) {
    updateData('diesel', data.diesel.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: '#5A6B62' }}>Track diesel usage for each equipment.</p>

      {/* Diesel Stock Summary Card */}
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
            <div style={{ fontSize: 11, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>Purch L</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E' }}>
              {data.diesel_stock?.purchased || 0}
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>Used L</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E' }}>
              {data.diesel_stock?.used || 0}
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 11, color: '#5A6B62', fontWeight: 600, marginBottom: 4 }}>Close L</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E' }}>
              {data.diesel_stock?.closing || 0}
            </div>
          </div>
        </div>

        {/* Input Fields Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
              OPENING (L)
            </label>
            <input
              type="number"
              value={data.diesel_stock?.opening || 0}
              onChange={e => updateDieselStock('opening', e.target.value)}
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
              PURCHASED (L)
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
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#5A6B62', marginBottom: 6 }}>
              USED (L)
            </label>
            <input
              type="number"
              value={data.diesel_stock?.used || 0}
              onChange={e => updateDieselStock('used', e.target.value)}
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
          padding: 16,
          position: 'relative'
        }}>
          <button
            onClick={() => removeEntry(idx)}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              color: '#E53E3E',
              opacity: 0.5,
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={16} />
          </button>

          {/* Equipment Selection with Status Badge */}
          <div style={{ marginBottom: 14, paddingRight: 30 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>
              EQUIPMENT
            </label>
            <select
              value={entry.equipment_name}
              onChange={e => updateEntry(idx, 'equipment_name', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1.5px solid #E2E8E4',
                fontSize: 14,
                outline: 'none'
              }}
            >
              <option value="">Select...</option>
              {equipment.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
            {entry.equipment_name && (
              <div style={{
                marginTop: 8,
                display: 'inline-block',
                background: '#1B7A45',
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 4
              }}>
                Active
              </div>
            )}
          </div>

          {/* Opening, Added, Used, Closing Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
            {/* Opening (readonly) */}
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' }}>
                Opening (L)
              </label>
              <input
                type="number"
                value={entry.opening || 0}
                onChange={e => updateEntry(idx, 'opening', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 8px',
                  borderRadius: 8,
                  border: '1.5px solid #E2E8E4',
                  fontSize: 12,
                  textAlign: 'center',
                  outline: 'none',
                  background: '#fff'
                }}
              />
            </div>

            {/* Added (editable) */}
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' }}>
                Added (L)
              </label>
              <input
                type="number"
                value={entry.added || 0}
                onChange={e => updateEntry(idx, 'added', e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 8px',
                  borderRadius: 8,
                  border: '1.5px solid #E2E8E4',
                  fontSize: 12,
                  textAlign: 'center',
                  outline: 'none',
                  background: '#fff'
                }}
              />
            </div>

            {/* Used (editable) */}
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' }}>
                Used (L)
              </label>
              <input
                type="number"
                value={entry.used || 0}
                onChange={e => updateEntry(idx, 'used', e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 8px',
                  borderRadius: 8,
                  border: '1.5px solid #E2E8E4',
                  fontSize: 12,
                  textAlign: 'center',
                  outline: 'none',
                  background: '#fff'
                }}
              />
            </div>

            {/* Closing (readonly/auto) */}
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' }}>
                Closing (L)
              </label>
              <div
                style={{
                  width: '100%',
                  padding: '8px 8px',
                  borderRadius: 8,
                  border: '1px solid #E2E8E4',
                  fontSize: 12,
                  textAlign: 'center',
                  background: '#F5F7F6',
                  color: '#1A1A2E',
                  fontWeight: 600
                }}
              >
                {entry.closing || 0}
              </div>
            </div>
          </div>

          {/* Hours and Avg L/Hr Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Hours Worked (editable) */}
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' }}>
                Hrs Worked
              </label>
              <input
                type="number"
                value={entry.hours || 0}
                onChange={e => updateEntry(idx, 'hours', e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 8px',
                  borderRadius: 8,
                  border: '1.5px solid #E2E8E4',
                  fontSize: 12,
                  textAlign: 'center',
                  outline: 'none',
                  background: '#fff'
                }}
              />
            </div>

            {/* Avg L/Hr (readonly/auto) */}
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' }}>
                Avg L/Hr
              </label>
              <div
                style={{
                  width: '100%',
                  padding: '8px 8px',
                  borderRadius: 8,
                  border: '1px solid #E2E8E4',
                  fontSize: 12,
                  textAlign: 'center',
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
      ))}

      {/* Add Equipment Button */}
      <button
        onClick={addEntry}
        style={{
          width: '100%',
          padding: '12px 0',
          border: '2px dashed #C6F6D5',
          borderRadius: 14,
          fontSize: 14,
          fontWeight: 600,
          color: '#1B7A45',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: 'transparent',
          cursor: 'pointer'
        }}
      >
        <Plus size={18} /> Add Equipment
      </button>
    </div>
  )
}
