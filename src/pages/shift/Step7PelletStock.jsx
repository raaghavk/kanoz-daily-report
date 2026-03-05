import { useEffect, memo } from 'react'

export default memo(function Step7PelletStock({ data, updateData }) {
  // Auto-populate production from Step 3 and dispatch from Step 6
  useEffect(() => {
    if (!data.pelletStock || data.pelletStock.length === 0) return

    const dispatchTotals = data.dispatchTotals || {}

    const stock = data.pelletStock.map(ps => {
      // Sum production from Step 3 matching this pellet type name
      const prodTotal = (data.production || [])
        .filter(p => p.pellet_type === ps.name)
        .reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)

      // Dispatch total from Step 6 (loaded from today's vehicle_dispatches)
      const dispTotal = dispatchTotals[ps.name] || 0

      return {
        ...ps,
        production: prodTotal,
        dispatch: dispTotal,
        closing: (ps.opening || 0) + prodTotal - dispTotal - (ps.wastage || 0),
      }
    })

    // Only update if production or dispatch values actually changed
    const hasChanged = stock.some((s, i) =>
      s.production !== data.pelletStock[i].production ||
      s.dispatch !== data.pelletStock[i].dispatch
    )
    if (hasChanged) {
      updateData('pelletStock', stock)
    }
  }, [data.production, data.dispatchTotals])

  function updateStock(idx, field, value) {
    const stock = [...data.pelletStock]
    stock[idx] = { ...stock[idx], [field]: parseFloat(value) || 0 }
    stock[idx].closing = stock[idx].opening + stock[idx].production - stock[idx].dispatch - stock[idx].wastage
    updateData('pelletStock', stock)
  }

  const totalProduction = data.pelletStock.reduce((sum, ps) => sum + (ps.production || 0), 0)
  const totalDispatch = data.pelletStock.reduce((sum, ps) => sum + (ps.dispatch || 0), 0)
  const netChange = totalProduction - totalDispatch

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Table Container */}
      <div style={{ overflowX: 'auto', marginBottom: 10, borderRadius: 10, border: '1px solid #e5ddd0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit' }}>
          <thead>
            <tr style={{ background: '#fefae0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Pellet</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Open</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Prod</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Disp</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2c2c2c', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Waste</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#2d6a4f', textTransform: 'uppercase', borderBottom: '1px solid #e5ddd0' }}>Close</th>
            </tr>
          </thead>
          <tbody>
            {data.pelletStock.map((ps, idx) => (
              <tr key={ps.id} style={{ borderBottom: '1px solid #e5ddd0' }}>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#2c2c2c', fontWeight: 500 }}>{ps.name}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#2d6a4f', background: '#e8f0ec' }}>
                  {(ps.opening || 0).toFixed(1)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#2d6a4f', background: '#e8f0ec' }}>
                  {(ps.production || 0).toFixed(1)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#d4a373', background: '#fefae0', fontWeight: 600 }}>
                  {(ps.dispatch || 0).toFixed(1)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <input
                    type="number"
                    step="0.1"
                    value={ps.wastage || ''}
                    onChange={e => updateStock(idx, 'wastage', e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', maxWidth: 70, padding: '6px 8px', borderRadius: 4, border: '1px solid #e5ddd0', textAlign: 'center', fontSize: 12, outline: 'none', background: '#ffffff' }}
                  />
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, color: '#2d6a4f', fontWeight: 700, background: '#e8f0ec' }}>
                  {(ps.closing || 0).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div style={{ background: '#e8f0ec', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#2d6a4f', lineHeight: 1.6 }}>
        <b>Prod auto-fills from Step 3. Dispatch auto-fills from Step 6.</b> Close = Open + Prod - Disp - Waste
      </div>

      {/* Summary Card */}
      <div style={{ background: '#fefae0', borderRadius: 8, marginTop: 8, padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #e5ddd0' }}>
          <span style={{ fontSize: 13, color: '#595c4a', fontWeight: 500 }}>Total Production</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#2d6a4f' }}>{totalProduction.toFixed(1)} MT</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 12, borderBottom: '1px solid #e5ddd0' }}>
          <span style={{ fontSize: 13, color: '#595c4a', fontWeight: 500 }}>Total Dispatch</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#d4a373' }}>{totalDispatch.toFixed(1)} MT</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
          <span style={{ fontSize: 13, color: '#595c4a', fontWeight: 500 }}>Net Change</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: netChange < 0 ? '#d32f2f' : '#2d6a4f' }}>
            {(netChange >= 0 ? '+' : '') + netChange.toFixed(1)} MT
          </span>
        </div>
      </div>
    </div>
  )
})
