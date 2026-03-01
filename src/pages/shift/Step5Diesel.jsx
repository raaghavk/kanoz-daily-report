import { Plus, Trash2 } from 'lucide-react'

export default function Step5Diesel({ data, updateData }) {
  const equipment = ['Generator', 'Tractor', 'Loader', 'JCB']

  function addEntry() {
    updateData('diesel', [...data.diesel, {
      id: Date.now(), equipment_name: '', opening: '', added: '', closing: '', hours: '',
    }])
  }

  function updateEntry(idx, field, value) {
    const entries = [...data.diesel]
    entries[idx] = { ...entries[idx], [field]: value }
    updateData('diesel', entries)
  }

  function removeEntry(idx) {
    updateData('diesel', data.diesel.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-kanoz-text-secondary">Track diesel usage for each equipment.</p>

      {data.diesel.map((entry, idx) => (
        <div key={entry.id} className="bg-kanoz-card rounded-xl border border-kanoz-border p-4 relative">
          <button onClick={() => removeEntry(idx)} className="absolute top-3 right-3 text-kanoz-red/50 hover:text-kanoz-red">
            <Trash2 size={16} />
          </button>
          <div className="mb-3">
            <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">EQUIPMENT</label>
            <select
              value={entry.equipment_name}
              onChange={e => updateEntry(idx, 'equipment_name', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
            >
              <option value="">Select...</option>
              {equipment.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {['opening', 'added', 'closing', 'hours'].map(field => (
              <div key={field}>
                <label className="block text-[9px] font-semibold text-kanoz-text-tertiary mb-1 text-center uppercase">{field === 'hours' ? 'HRS' : field}</label>
                <input
                  type="number"
                  value={entry[field] || ''}
                  onChange={e => updateEntry(idx, field, e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-2 rounded-lg border border-kanoz-border text-center text-xs focus:outline-none focus:ring-2 focus:ring-kanoz-green"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={addEntry} className="w-full py-3 border-2 border-dashed border-kanoz-green-light rounded-xl text-sm font-semibold text-kanoz-green flex items-center justify-center gap-2 hover:bg-kanoz-green-light/20 transition-colors">
        <Plus size={18} /> Add Equipment
      </button>
    </div>
  )
}
