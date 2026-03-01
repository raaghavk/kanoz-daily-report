export default function Step7PelletStock({ data, updateData }) {
  function updateStock(idx, field, value) {
    const stock = [...data.pelletStock]
    stock[idx] = { ...stock[idx], [field]: parseFloat(value) || 0 }
    stock[idx].closing = stock[idx].opening + stock[idx].production - stock[idx].dispatch - stock[idx].wastage
    updateData('pelletStock', stock)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-kanoz-text-secondary">Production and dispatch auto-fill from previous steps. Only enter wastage.</p>

      {data.pelletStock.map((ps, idx) => (
        <div key={ps.id} className="bg-kanoz-card rounded-xl border border-kanoz-border p-4">
          <div className="font-bold text-sm mb-3 text-kanoz-text">{ps.name}</div>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { key: 'opening', label: 'OPEN', auto: true },
              { key: 'production', label: 'PROD', auto: true },
              { key: 'dispatch', label: 'DISP', auto: true },
              { key: 'wastage', label: 'WASTE', auto: false },
              { key: 'closing', label: 'CLOSE', auto: true, highlight: true },
            ].map(col => (
              <div key={col.key}>
                <label className={`block text-[8px] font-semibold mb-1 text-center ${col.highlight ? 'text-kanoz-green' : 'text-kanoz-text-tertiary'}`}>{col.label}</label>
                {col.auto ? (
                  <div className={`px-1 py-2 rounded-lg text-center text-xs font-medium ${
                    col.highlight ? 'bg-kanoz-green-light/30 border border-kanoz-green-light text-kanoz-green font-bold' : 'bg-kanoz-bg border border-kanoz-border'
                  }`}>
                    {ps[col.key]?.toFixed?.(1) || '0.0'}
                  </div>
                ) : (
                  <input
                    type="number"
                    step="0.1"
                    value={ps[col.key] || ''}
                    onChange={e => updateStock(idx, col.key, e.target.value)}
                    placeholder="0"
                    className="w-full px-1 py-2 rounded-lg border border-kanoz-border text-center text-xs focus:outline-none focus:ring-2 focus:ring-kanoz-green"
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
