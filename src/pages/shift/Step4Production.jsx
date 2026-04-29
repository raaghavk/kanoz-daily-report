import { memo } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

const COLORS = {
  green: '#2d6a4f',
  primary: '#2c2c2c',
  secondary: '#595c4a',
  tertiary: '#8a8d7a',
  bg: '#fefae0',
  border: '#e5ddd0',
  card: '#fff',
  red: '#d32f2f',
  lightRed: 'rgba(211, 47, 47, 0.1)',
}

export default memo(function Step4Production({ data, updateData }) {
  function addEntry() {
    updateData('production', [...data.production, {
      id: Date.now(),
      machine_id: data.machines[0]?.id || '',
      quantity: '',
      mix_usages: [],
    }])
  }

  function updateEntry(idx, field, value) {
    const entries = [...data.production]
    entries[idx] = { ...entries[idx], [field]: value }
    updateData('production', entries)
  }

  function removeEntry(idx) {
    updateData('production', data.production.filter((_, i) => i !== idx))
  }

  function addMixUsage(entryIdx) {
    const entries = [...data.production]
    if (!entries[entryIdx].mix_usages) {
      entries[entryIdx].mix_usages = []
    }
    entries[entryIdx].mix_usages.push({ mix_local_id: '', quantity_kg: '' })
    updateData('production', entries)
  }

  function updateMixUsage(entryIdx, mixIdx, field, value) {
    const entries = [...data.production]
    entries[entryIdx].mix_usages[mixIdx] = {
      ...entries[entryIdx].mix_usages[mixIdx],
      [field]: value
    }
    updateData('production', entries)
  }

  function removeMixUsage(entryIdx, mixIdx) {
    const entries = [...data.production]
    entries[entryIdx].mix_usages = entries[entryIdx].mix_usages.filter((_, i) => i !== mixIdx)
    updateData('production', entries)
  }

  function getPelletType(entry) {
    if (!entry.mix_usages || entry.mix_usages.length === 0) {
      return null
    }

    const usedMixes = entry.mix_usages
      .map(mu => data.mixes.find(m => m.local_id === mu.mix_local_id))
      .filter(m => m)

    if (usedMixes.length === 0) {
      return null
    }

    // Get all types from used mixes
    const types = usedMixes.map(m => m.type).filter(Boolean)

    if (types.length === 0) {
      return null
    }

    // If all same type, show it
    if (types.every(t => t === types[0])) {
      return types[0]
    }

    // If mixed types, show "Sample"
    return 'Sample'
  }

  const totalMT = data.production.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, color: COLORS.secondary, margin: 0 }}>Enter production per machine.</p>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.green }}>Total: {totalMT.toFixed(1)} MT</div>
      </div>

      {/* Production entries */}
      {data.production.map((entry, idx) => {
        const pelletType = getPelletType(entry)

        return (
          <div
            key={entry.id}
            style={{
              background: COLORS.card,
              borderRadius: 14,
              border: `1.5px solid ${COLORS.border}`,
              padding: 16,
              position: 'relative',
            }}
          >
            {/* Delete button */}
            <button
              onClick={() => removeEntry(idx)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: 'rgba(211, 47, 47, 0.5)',
              }}
              onMouseEnter={(e) => e.target.style.color = COLORS.red}
              onMouseLeave={(e) => e.target.style.color = 'rgba(211, 47, 47, 0.5)'}
            >
              <Trash2 size={16} />
            </button>

            {/* Machine + Quantity row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: COLORS.secondary, marginBottom: 6 }}>MACHINE</label>
                <select
                  value={entry.machine_id}
                  onChange={e => updateEntry(idx, 'machine_id', e.target.value)}
                  style={{
                    width: '100%',
                    height: 44,
                    padding: '0 12px',
                    borderRadius: 12,
                    border: `1.5px solid ${COLORS.border}`,
                    fontSize: 14,
                    outline: 'none',
                    color: COLORS.primary,
                    boxSizing: 'border-box',
                    background: COLORS.card,
                  }}
                >
                  <option value="">Select...</option>
                  {data.machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: COLORS.secondary, marginBottom: 6 }}>QUANTITY (MT)</label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={entry.quantity}
                  onChange={e => updateEntry(idx, 'quantity', e.target.value)}
                  placeholder="0.0"
                  style={{
                    width: '100%',
                    height: 44,
                    padding: '0 12px',
                    borderRadius: 12,
                    border: `1.5px solid ${COLORS.border}`,
                    fontSize: 14,
                    outline: 'none',
                    color: COLORS.primary,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Pellet type badge */}
            {pelletType && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    borderRadius: 20,
                    background: 'rgba(45, 106, 79, 0.1)',
                    color: COLORS.green,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {pelletType}
                </div>
              </div>
            )}

            {/* Mix used section */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: COLORS.secondary, marginBottom: 10, textTransform: 'uppercase' }}>MIX USED</label>

              {(!entry.mix_usages || entry.mix_usages.length === 0) ? (
                data.mixes.length === 0 ? (
                  <p style={{ fontSize: 12, color: COLORS.tertiary, fontStyle: 'italic', margin: 0 }}>No mixes created yet — go back to Step 3</p>
                ) : (
                  <p style={{ fontSize: 12, color: COLORS.tertiary, margin: 0 }}>No mixes added yet</p>
                )
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                  {entry.mix_usages.map((mu, mixIdx) => (
                    <div key={mixIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 32px', gap: 8, alignItems: 'flex-end' }}>
                      <select
                        value={mu.mix_local_id}
                        onChange={e => updateMixUsage(idx, mixIdx, 'mix_local_id', e.target.value)}
                        style={{
                          width: '100%',
                          height: 44,
                          padding: '0 12px',
                          borderRadius: 8,
                          border: `1.5px solid ${COLORS.border}`,
                          fontSize: 13,
                          outline: 'none',
                          color: COLORS.primary,
                          boxSizing: 'border-box',
                          background: COLORS.card,
                        }}
                      >
                        <option value="">Select mix...</option>
                        {data.mixes.map(m => (
                          <option key={m.local_id} value={m.local_id}>
                            {m.name} ({m.type})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={mu.quantity_kg}
                        onChange={e => updateMixUsage(idx, mixIdx, 'quantity_kg', e.target.value)}
                        placeholder="kg"
                        style={{
                          width: '100%',
                          height: 44,
                          padding: '0 8px',
                          borderRadius: 8,
                          border: `1.5px solid ${COLORS.border}`,
                          fontSize: 13,
                          outline: 'none',
                          color: COLORS.primary,
                          boxSizing: 'border-box',
                          textAlign: 'center',
                        }}
                      />

                      <button
                        onClick={() => removeMixUsage(idx, mixIdx)}
                        style={{
                          width: 32,
                          height: 44,
                          borderRadius: 8,
                          border: 'none',
                          background: 'transparent',
                          color: 'rgba(211, 47, 47, 0.5)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = COLORS.lightRed
                          e.currentTarget.style.color = COLORS.red
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'rgba(211, 47, 47, 0.5)'
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Mix button */}
              {data.mixes.length > 0 && (
                <button
                  onClick={() => addMixUsage(idx)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1.5px dashed ${COLORS.green}`,
                    borderRadius: 8,
                    background: 'transparent',
                    color: COLORS.green,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(45, 106, 79, 0.08)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <Plus size={14} /> Add Mix
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* Add Production Entry button */}
      <button
        onClick={addEntry}
        style={{
          width: '100%',
          padding: '12px 0',
          border: `2px dashed ${COLORS.green}`,
          borderRadius: 12,
          background: 'transparent',
          color: COLORS.green,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(45, 106, 79, 0.08)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
      >
        <Plus size={18} /> Add Production Entry
      </button>
    </div>
  )
})
