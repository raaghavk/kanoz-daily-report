import { useState } from 'react'
import { Plus, Trash2, Phone } from 'lucide-react'

export default function Step6Dispatch({ data, updateData }) {
  function addDispatch() {
    updateData('dispatches', [...data.dispatches, {
      id: Date.now(), truck_number: '', customer: '', destination: '',
      transporter: '', driver_name: '', driver_phone: '', invoice_no: '',
      pellets: [{ type: '', quantity: '' }],
    }])
  }

  function updateDispatch(idx, field, value) {
    const entries = [...data.dispatches]
    entries[idx] = { ...entries[idx], [field]: value }
    updateData('dispatches', entries)
  }

  function removeDispatch(idx) {
    updateData('dispatches', data.dispatches.filter((_, i) => i !== idx))
  }

  function addPellet(dIdx) {
    const entries = [...data.dispatches]
    entries[dIdx].pellets.push({ type: '', quantity: '' })
    updateData('dispatches', entries)
  }

  function updatePellet(dIdx, pIdx, field, value) {
    const entries = [...data.dispatches]
    entries[dIdx].pellets[pIdx] = { ...entries[dIdx].pellets[pIdx], [field]: value }
    updateData('dispatches', entries)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 12, color: '#5A6B62' }}>Record vehicle dispatches for this shift.</p>

      {data.dispatches.map((d, idx) => (
        <div key={d.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E4', padding: 16, position: 'relative' }}>
          <button onClick={() => removeDispatch(idx)} style={{ position: 'absolute', top: 12, right: 12, color: '#E53E3E', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}>
            <Trash2 size={16} />
          </button>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', marginBottom: 12 }}>Truck #{idx + 1}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>TRUCK NO.</label>
              <input type="text" value={d.truck_number} onChange={e => updateDispatch(idx, 'truck_number', e.target.value)} placeholder="UP-26-XX-1234" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 14, textTransform: 'uppercase', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>DESTINATION</label>
              <input type="text" value={d.destination} onChange={e => updateDispatch(idx, 'destination', e.target.value)} placeholder="City" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>CUSTOMER</label>
            <input type="text" value={d.customer} onChange={e => updateDispatch(idx, 'customer', e.target.value)} placeholder="Customer name" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>DRIVER</label>
              <input type="text" value={d.driver_name} onChange={e => updateDispatch(idx, 'driver_name', e.target.value)} placeholder="Name" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8A9B92', marginBottom: 4 }}>PHONE</label>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="tel" value={d.driver_phone} onChange={e => updateDispatch(idx, 'driver_phone', e.target.value)} placeholder="Number" style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 14, outline: 'none' }} />
                {d.driver_phone && (
                  <a href={`tel:${d.driver_phone}`} style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #1B7A45', color: '#1B7A45', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                    <Phone size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8A9B92', textTransform: 'uppercase', marginBottom: 8 }}>Pellets Loaded</div>
          {d.pellets.map((p, pIdx) => (
            <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select value={p.type} onChange={e => updatePellet(idx, pIdx, 'type', e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 12, outline: 'none' }}>
                <option value="">Pellet type...</option>
                {data.pelletStock.map(pt => <option key={pt.id} value={pt.name}>{pt.name}</option>)}
              </select>
              <input type="number" step="0.1" value={p.quantity} onChange={e => updatePellet(idx, pIdx, 'quantity', e.target.value)} placeholder="MT" style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8E4', fontSize: 12, outline: 'none' }} />
            </div>
          ))}
          <button onClick={() => addPellet(idx)} style={{ fontSize: 12, color: '#1B7A45', fontWeight: 500, marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>+ Add pellet type</button>
        </div>
      ))}

      <button onClick={addDispatch} style={{ width: '100%', padding: '12px 0', border: '2px dashed #C6F6D5', borderRadius: 14, fontSize: 14, fontWeight: 600, color: '#1B7A45', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', cursor: 'pointer' }}>
        <Plus size={18} /> Add Dispatch
      </button>
    </div>
  )
}
