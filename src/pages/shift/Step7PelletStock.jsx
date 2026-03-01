export default function Step7PelletStock({ data, updateData }) {
  function updateStock(idx, field, value) {
    const stock = [...data.pelletStock]
    stock[idx] = { ...stock[idx], [field]: parseFloat(value) || 0 }
    stock[idx].closing = stock[idx].opening + stock[idx].production - stock[idx].dispatch - stock[idx].wastage
    updateData('pelletStock', stock)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: '#5A6B62' }}>Production and dispatch auto-fill from previous steps. Only enter wastage.</p>

      {data.pelletStock.map((ps, idx) => (
        <div key={ps.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#1A1A2E' }}>{ps.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {[
              { key: 'opening', label: 'OPEN', auto: true },
              { key: 'production', label: 'PROD', auto: true },
              { key: 'dispatch', label: 'DISP', auto: true },
              { key: 'wastage', label: 'WASTE', auto: false },
              { key: 'closing', label: 'CLOSE', auto: true, highlight: true },
            ].map(col => (
              <div key={col.key}>
                <label style={{ display: 'block', fontSize: 8, fontWeight: 600, marginBottom: 4, textAlign: 'center', color: col.highlight ? '#1B7A45' : '#C5CFC8' }}>{col.label}</label>
                {col.auto ? (
                  <div style={{ padding: '8px 4px', borderRadius: 8, textAlign: 'center', fontSize: 12, fontWeight: col.highlight ? 700 : 500, background: col.highlight ? '#E8F5EE' : '#F5F7F6', border: col.highlight ? '1px solid #C6F6D5' : '1px solid #E2E8E4', color: col.highlight ? '#1B7A45' : '#1A1A2E' }}>
                    {ps[col.key]?.toFixed?.(1) || '0.0'}
                  </div>
                ) : (
                  <input
                    type="number"
                    step="0.1"
                    value={ps[col.key] || ''}
                    onChange={e => updateStock(idx, col.key, e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', padding: '10px 4px', borderRadius: 8, border: '1.5px solid #E2E8E4', textAlign: 'center', fontSize: 12, outline: 'none' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
