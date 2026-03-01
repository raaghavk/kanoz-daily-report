export default function Step4RawMaterial({ data, updateData }) {
  function updateRM(idx, field, value) {
    const mats = [...data.rawMaterials]
    mats[idx] = { ...mats[idx], [field]: parseFloat(value) || 0 }
    // Auto-calculate closing
    mats[idx].closing = mats[idx].opening + mats[idx].purchased - mats[idx].used
    updateData('rawMaterials', mats)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-kanoz-text-secondary">Opening stock auto-carries from previous shift. Purchased auto-fills from Purchase app.</p>

      {data.rawMaterials.map((rm, idx) => (
        <div key={rm.id} className="bg-kanoz-card rounded-xl border border-kanoz-border p-4">
          <div className="font-bold text-sm mb-3 text-kanoz-text">{rm.name}</div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[9px] font-semibold text-kanoz-text-tertiary mb-1 text-center">OPENING</label>
              <div className="px-2 py-2 rounded-lg bg-kanoz-bg border border-kanoz-border text-center text-xs font-medium">
                {rm.opening}
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-kanoz-text-tertiary mb-1 text-center">PURCHASED</label>
              <div className="px-2 py-2 rounded-lg bg-kanoz-bg border border-kanoz-border text-center text-xs font-medium">
                {rm.purchased}
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-kanoz-text-tertiary mb-1 text-center">USED</label>
              <input
                type="number"
                value={rm.used || ''}
                onChange={e => updateRM(idx, 'used', e.target.value)}
                placeholder="0"
                className="w-full px-2 py-2 rounded-lg border border-kanoz-border text-center text-xs focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              />
            </div>
            <div>
              <label className="block text-[9px] font-semibold text-kanoz-green mb-1 text-center">CLOSING</label>
              <div className="px-2 py-2 rounded-lg bg-kanoz-green-light/30 border border-kanoz-green-light text-center text-xs font-bold text-kanoz-green">
                {rm.closing}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
