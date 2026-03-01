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
    <div className="space-y-4">
      <p className="text-xs text-kanoz-text-secondary">Record vehicle dispatches for this shift.</p>

      {data.dispatches.map((d, idx) => (
        <div key={d.id} className="bg-kanoz-card rounded-xl border border-kanoz-border p-4 relative">
          <button onClick={() => removeDispatch(idx)} className="absolute top-3 right-3 text-kanoz-red/50 hover:text-kanoz-red">
            <Trash2 size={16} />
          </button>
          <div className="text-xs font-bold text-kanoz-text-tertiary uppercase mb-3">Truck #{idx + 1}</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">TRUCK NO.</label>
              <input type="text" value={d.truck_number} onChange={e => updateDispatch(idx, 'truck_number', e.target.value)} placeholder="UP-26-XX-1234" className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm uppercase focus:outline-none focus:ring-2 focus:ring-kanoz-green" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">DESTINATION</label>
              <input type="text" value={d.destination} onChange={e => updateDispatch(idx, 'destination', e.target.value)} placeholder="City" className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green" />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">CUSTOMER</label>
            <input type="text" value={d.customer} onChange={e => updateDispatch(idx, 'customer', e.target.value)} placeholder="Customer name" className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">DRIVER</label>
              <input type="text" value={d.driver_name} onChange={e => updateDispatch(idx, 'driver_name', e.target.value)} placeholder="Name" className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">PHONE</label>
              <div className="flex gap-1">
                <input type="tel" value={d.driver_phone} onChange={e => updateDispatch(idx, 'driver_phone', e.target.value)} placeholder="Number" className="flex-1 px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green" />
                {d.driver_phone && (
                  <a href={`tel:${d.driver_phone}`} className="px-3 py-2 rounded-lg border border-kanoz-green text-kanoz-green flex items-center">
                    <Phone size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="text-[10px] font-bold text-kanoz-text-tertiary uppercase mb-2">Pellets Loaded</div>
          {d.pellets.map((p, pIdx) => (
            <div key={pIdx} className="grid grid-cols-2 gap-2 mb-2">
              <select value={p.type} onChange={e => updatePellet(idx, pIdx, 'type', e.target.value)} className="px-3 py-2 rounded-lg border border-kanoz-border text-xs focus:outline-none focus:ring-2 focus:ring-kanoz-green">
                <option value="">Pellet type...</option>
                {data.pelletStock.map(pt => <option key={pt.id} value={pt.name}>{pt.name}</option>)}
              </select>
              <input type="number" step="0.1" value={p.quantity} onChange={e => updatePellet(idx, pIdx, 'quantity', e.target.value)} placeholder="MT" className="px-3 py-2 rounded-lg border border-kanoz-border text-xs focus:outline-none focus:ring-2 focus:ring-kanoz-green" />
            </div>
          ))}
          <button onClick={() => addPellet(idx)} className="text-xs text-kanoz-green font-medium mt-1">+ Add pellet type</button>
        </div>
      ))}

      <button onClick={addDispatch} className="w-full py-3 border-2 border-dashed border-kanoz-green-light rounded-xl text-sm font-semibold text-kanoz-green flex items-center justify-center gap-2 hover:bg-kanoz-green-light/20 transition-colors">
        <Plus size={18} /> Add Dispatch
      </button>
    </div>
  )
}
