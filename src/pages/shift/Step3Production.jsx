import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

const MATERIALS = ['Cow Dung', 'Saw Dust', 'Chicken Litter', 'Ash', 'Press Mud', 'Bagasse', 'Rice Husk', 'Other']

const COLORS = {
  green: '#1B7A45',
  accent: '#D4960A',
  primary: '#1A1A2E',
  secondary: '#5A6B62',
  tertiary: '#C5CFC8',
  bg: '#F5F7F6',
  border: '#E2E8E4',
  red: '#E53E3E',
  lightGray: '#F9FAFB'
}

export default function Step3Production({ data, updateData }) {
  function addEntry() {
    updateData('production', [...data.production, {
      id: Date.now(),
      machine_id: data.machines[0]?.id || '',
      pellet_type: '',
      quantity: '',
      ingredients: [],
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

  function addIngredient(idx) {
    const entries = [...data.production]
    if (!entries[idx].ingredients) {
      entries[idx].ingredients = []
    }
    entries[idx].ingredients.push({ material: '', quantity_kg: '' })
    updateData('production', entries)
  }

  function updateIngredient(entryIdx, ingredientIdx, field, value) {
    const entries = [...data.production]
    entries[entryIdx].ingredients[ingredientIdx] = {
      ...entries[entryIdx].ingredients[ingredientIdx],
      [field]: value
    }
    updateData('production', entries)
  }

  function removeIngredient(entryIdx, ingredientIdx) {
    const entries = [...data.production]
    entries[entryIdx].ingredients = entries[entryIdx].ingredients.filter((_, i) => i !== ingredientIdx)
    updateData('production', entries)
  }

  function calculateIngredientPercentage(quantity_kg, entryIdx) {
    if (!data.production[entryIdx].ingredients) return 0
    const totalKg = data.production[entryIdx].ingredients.reduce((sum, ing) => sum + (parseFloat(ing.quantity_kg) || 0), 0)
    if (totalKg === 0) return 0
    return ((parseFloat(quantity_kg) || 0) / totalKg * 100).toFixed(1)
  }

  function getTotalIngredientsKg(entryIdx) {
    if (!data.production[entryIdx].ingredients) return 0
    return data.production[entryIdx].ingredients.reduce((sum, ing) => sum + (parseFloat(ing.quantity_kg) || 0), 0)
  }

  function getMachineName(machineId) {
    return data.machines.find(m => m.id === machineId)?.name || 'Unknown'
  }

  const totalMT = data.production.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)

  // Group production entries by machine and pellet type for summary
  const productionSummary = data.production.reduce((acc, entry, idx) => {
    const key = `${entry.machine_id}_${entry.pellet_type}`
    if (!acc[key]) {
      acc[key] = { machine_id: entry.machine_id, pellet_type: entry.pellet_type, total_mt: 0, entries: [] }
    }
    acc[key].total_mt += parseFloat(entry.quantity) || 0
    acc[key].entries.push(idx)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, color: COLORS.secondary }}>Multiple entries per machine allowed.</p>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.green }}>Total: {totalMT.toFixed(1)} MT</div>
      </div>

      {data.production.map((entry, idx) => (
        <div key={entry.id} style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${COLORS.border}`, padding: 16, position: 'relative' }}>
          {/* Remove button */}
          <button
            onClick={() => removeEntry(idx)}
            style={{ position: 'absolute', top: 12, right: 12, color: 'rgba(229, 62, 62, 0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={(e) => e.target.style.color = COLORS.red}
            onMouseLeave={(e) => e.target.style.color = 'rgba(229, 62, 62, 0.5)'}
          >
            <Trash2 size={16} />
          </button>

          {/* Machine name header with Entry # label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingRight: 32 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.primary, margin: 0 }}>
              {getMachineName(entry.machine_id) || 'Machine'}
            </h3>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.tertiary, backgroundColor: COLORS.bg, padding: '4px 8px', borderRadius: 6 }}>
              Entry #{idx + 1}
            </span>
          </div>

          {/* Machine and Quantity row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: COLORS.secondary, marginBottom: 4 }}>MACHINE</label>
              <select
                value={entry.machine_id}
                onChange={e => updateEntry(idx, 'machine_id', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${COLORS.border}`, fontSize: 14, outline: 'none', color: COLORS.primary }}
              >
                <option value="">Select...</option>
                {data.machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: COLORS.secondary, marginBottom: 4 }}>QUANTITY (MT)</label>
              <input
                type="number"
                step="0.1"
                value={entry.quantity}
                onChange={e => updateEntry(idx, 'quantity', e.target.value)}
                placeholder="0.0"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${COLORS.border}`, fontSize: 14, outline: 'none', color: COLORS.primary }}
              />
            </div>
          </div>

          {/* Pellet type chips */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: COLORS.secondary, marginBottom: 8 }}>PELLET TYPE</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {data.pelletStock.map(p => (
                <button
                  key={p.id}
                  onClick={() => updateEntry(idx, 'pellet_type', p.name)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: entry.pellet_type === p.name ? `2px solid ${COLORS.green}` : `1.5px solid ${COLORS.border}`,
                    background: entry.pellet_type === p.name ? COLORS.green : '#fff',
                    color: entry.pellet_type === p.name ? '#fff' : COLORS.primary,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (entry.pellet_type !== p.name) {
                      e.target.style.borderColor = COLORS.green
                      e.target.style.background = 'rgba(27, 122, 69, 0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (entry.pellet_type !== p.name) {
                      e.target.style.borderColor = COLORS.border
                      e.target.style.background = '#fff'
                    }
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredient Mix Section */}
          <div style={{ background: COLORS.bg, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: COLORS.primary, marginBottom: 12, marginTop: 0 }}>
              INGREDIENT MIX {entry.pellet_type ? `(${entry.pellet_type})` : '(Sample Blend)'}
            </h4>

            {(!entry.ingredients || entry.ingredients.length === 0) ? (
              <p style={{ fontSize: 12, color: COLORS.tertiary, margin: '8px 0' }}>No materials added yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 40px', gap: 8, alignItems: 'center', paddingBottom: 8, borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.secondary }}>MATERIAL</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.secondary }}>QTY (KG)</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.secondary }}>%</span>
                  <span></span>
                </div>

                {/* Ingredient rows */}
                {entry.ingredients.map((ingredient, ingIdx) => (
                  <div key={ingIdx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 40px', gap: 8, alignItems: 'center' }}>
                    <select
                      value={ingredient.material}
                      onChange={e => updateIngredient(idx, ingIdx, 'material', e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: `1px solid ${COLORS.border}`,
                        fontSize: 12,
                        outline: 'none',
                        color: COLORS.primary,
                        background: '#fff'
                      }}
                    >
                      <option value="">Select...</option>
                      {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>

                    <input
                      type="number"
                      step="0.1"
                      value={ingredient.quantity_kg}
                      onChange={e => updateIngredient(idx, ingIdx, 'quantity_kg', e.target.value)}
                      placeholder="0"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: `1px solid ${COLORS.border}`,
                        fontSize: 12,
                        outline: 'none',
                        color: COLORS.primary
                      }}
                    />

                    <div style={{
                      padding: '8px 8px',
                      borderRadius: 6,
                      background: '#fff',
                      border: `1px solid ${COLORS.border}`,
                      fontSize: 12,
                      fontWeight: 600,
                      color: COLORS.accent,
                      textAlign: 'center'
                    }}>
                      {calculateIngredientPercentage(ingredient.quantity_kg, idx)}%
                    </div>

                    <button
                      onClick={() => removeIngredient(idx, ingIdx)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: 'rgba(229, 62, 62, 0.5)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(229, 62, 62, 0.1)'
                        e.currentTarget.style.color = COLORS.red
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'rgba(229, 62, 62, 0.5)'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Material button */}
            <button
              onClick={() => addIngredient(idx)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1.5px dashed ${COLORS.green}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.green,
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(27, 122, 69, 0.08)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              <Plus size={14} /> Add Material
            </button>

            {/* Total kg display */}
            {entry.ingredients && entry.ingredients.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}`, fontSize: 12, fontWeight: 600, color: COLORS.secondary }}>
                Total: {getTotalIngredientsKg(idx).toFixed(2)} kg
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Production Summary */}
      {Object.keys(productionSummary).length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${COLORS.border}`, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.primary, margin: '0 0 12px 0' }}>PRODUCTION SUMMARY</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.values(productionSummary).map((summary, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < Object.keys(productionSummary).length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                <span style={{ fontSize: 12, color: COLORS.secondary }}>
                  {getMachineName(summary.machine_id)} - {summary.pellet_type || 'Unselected'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.green }}>{summary.total_mt.toFixed(1)} MT</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Production Entry button */}
      <button
        onClick={addEntry}
        style={{ width: '100%', padding: '12px 0', border: '2px dashed #C6F6D5', borderRadius: 12, fontSize: 14, fontWeight: 600, color: COLORS.green, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', cursor: 'pointer', transition: 'background-color 0.3s' }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(198, 246, 213, 0.2)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
      >
        <Plus size={18} /> Add Production Entry
      </button>
    </div>
  )
}
