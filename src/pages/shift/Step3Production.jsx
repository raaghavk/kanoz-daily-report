import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

export default function Step3Production({ data, updateData }) {
  function addEntry() {
    updateData('production', [...data.production, {
      id: Date.now(),
      machine_id: data.machines[0]?.id || '',
      pellet_type: '',
      quantity: '',
      blend: '',
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

  const totalMT = data.production.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, color: '#5A6B62' }}>Multiple entries per machine allowed.</p>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1B7A45' }}>Total: {totalMT.toFixed(1)} MT</div>
      </div>

      {data.production.map((entry, idx) => (
        <div key={entry.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16, position: 'relative' }}>
          <button
            onClick={() => removeEntry(idx)}
            style={{ position: 'absolute', top: 12, right: 12, color: 'rgba(229, 62, 62, 0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onMouseEnter={(e) => e.target.style.color = '#E53E3E'}
            onMouseLeave={(e) => e.target.style.color = 'rgba(229, 62, 62, 0.5)'}
          >
            <Trash2 size={16} />
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>MACHINE</label>
              <select
                value={entry.machine_id}
                onChange={e => updateEntry(idx, 'machine_id', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }}
              >
                <option value="">Select...</option>
                {data.machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>PELLET TYPE</label>
              <select
                value={entry.pellet_type}
                onChange={e => updateEntry(idx, 'pellet_type', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }}
              >
                <option value="">Select...</option>
                {data.pelletStock.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>QUANTITY (MT)</label>
            <input
              type="number"
              step="0.1"
              value={entry.quantity}
              onChange={e => updateEntry(idx, 'quantity', e.target.value)}
              placeholder="0.0"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }}
            />
          </div>
        </div>
      ))}

      <button
        onClick={addEntry}
        style={{ width: '100%', padding: '12px 0', border: '2px dashed #C6F6D5', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#1B7A45', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', cursor: 'pointer', transition: 'background-color 0.3s' }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(198, 246, 213, 0.2)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
      >
        <Plus size={18} /> Add Production Entry
      </button>
    </div>
  )
}
