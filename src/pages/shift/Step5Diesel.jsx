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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: '#5A6B62' }}>Track diesel usage for each equipment.</p>

      {data.diesel.map((entry, idx) => (
        <div key={entry.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16, position: 'relative' }}>
          <button onClick={() => removeEntry(idx)} style={{ position: 'absolute', top: 12, right: 12, color: '#E53E3E', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}>
            <Trash2 size={16} />
          </button>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>EQUIPMENT</label>
            <select
              value={entry.equipment_name}
              onChange={e => updateEntry(idx, 'equipment_name', e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }}
            >
              <option value="">Select...</option>
              {equipment.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
            {['opening', 'added', 'closing', 'hours'].map(field => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: '#8A9B92', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' }}>{field === 'hours' ? 'HRS' : field}</label>
                <input
                  type="number"
                  value={entry[field] || ''}
                  onChange={e => updateEntry(idx, field, e.target.value)}
                  placeholder="0"
                  style={{ width: '100%', padding: '8px 8px', borderRadius: 8, border: '1px solid #E2E8E4', fontSize: 12, textAlign: 'center', outline: 'none' }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={addEntry} style={{ width: '100%', padding: '12px 0', border: '2px dashed #C6F6D5', borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#1B7A45', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', cursor: 'pointer' }}>
        <Plus size={18} /> Add Equipment
      </button>
    </div>
  )
}
