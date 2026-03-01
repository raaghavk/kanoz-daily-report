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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-kanoz-text-secondary">Multiple entries per machine allowed.</p>
        <div className="text-xs font-bold text-kanoz-green">Total: {totalMT.toFixed(1)} MT</div>
      </div>

      {data.production.map((entry, idx) => (
        <div key={entry.id} className="bg-kanoz-card rounded-xl border border-kanoz-border p-4 relative">
          <button
            onClick={() => removeEntry(idx)}
            className="absolute top-3 right-3 text-kanoz-red/50 hover:text-kanoz-red"
          >
            <Trash2 size={16} />
          </button>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">MACHINE</label>
              <select
                value={entry.machine_id}
                onChange={e => updateEntry(idx, 'machine_id', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              >
                <option value="">Select...</option>
                {data.machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">PELLET TYPE</label>
              <select
                value={entry.pellet_type}
                onChange={e => updateEntry(idx, 'pellet_type', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              >
                <option value="">Select...</option>
                {data.pelletStock.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">QUANTITY (MT)</label>
            <input
              type="number"
              step="0.1"
              value={entry.quantity}
              onChange={e => updateEntry(idx, 'quantity', e.target.value)}
              placeholder="0.0"
              className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            />
          </div>
        </div>
      ))}

      <button
        onClick={addEntry}
        className="w-full py-3 border-2 border-dashed border-kanoz-green-light rounded-xl text-sm font-semibold text-kanoz-green flex items-center justify-center gap-2 hover:bg-kanoz-green-light/20 transition-colors"
      >
        <Plus size={18} /> Add Production Entry
      </button>
    </div>
  )
}
