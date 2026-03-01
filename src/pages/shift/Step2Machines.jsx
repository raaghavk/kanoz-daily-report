import { Clock, AlertCircle } from 'lucide-react'

export default function Step2Machines({ data, updateData }) {
  function updateMachine(idx, field, value) {
    const machines = [...data.machines]
    machines[idx] = { ...machines[idx], [field]: value }
    // Auto-calculate production hours
    if (field === 'from_time' || field === 'to_time' || field === 'breakdown_min') {
      const from = machines[idx].from_time
      const to = machines[idx].to_time
      if (from && to) {
        const [fh, fm] = from.split(':').map(Number)
        const [th, tm] = to.split(':').map(Number)
        let totalMin = (th * 60 + tm) - (fh * 60 + fm)
        if (totalMin < 0) totalMin += 24 * 60 // overnight
        const prodHrs = Math.max(0, (totalMin - (parseInt(machines[idx].breakdown_min) || 0)) / 60)
        machines[idx].production_hours = Math.round(prodHrs * 100) / 100
      }
    }
    updateData('machines', machines)
  }

  if (!data.machines.length) {
    return (
      <div className="text-center py-8">
        <AlertCircle size={32} className="mx-auto text-kanoz-text-tertiary mb-2" />
        <p className="text-sm text-kanoz-text-secondary">No machines found for this plant.</p>
        <p className="text-xs text-kanoz-text-tertiary mt-1">Ask admin to add machines in Settings.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-kanoz-text-secondary">Enter runtime for each machine this shift.</p>
      {data.machines.map((m, idx) => (
        <div key={m.id} className="bg-kanoz-card rounded-xl border border-kanoz-border p-4">
          <div className="font-bold text-sm mb-3 flex items-center gap-2">
            <div className="w-8 h-8 bg-kanoz-green-light/50 rounded-lg flex items-center justify-center text-kanoz-green text-xs font-extrabold">
              {idx + 1}
            </div>
            {m.name}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">FROM</label>
              <input
                type="time"
                value={m.from_time}
                onChange={e => updateMachine(idx, 'from_time', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">TO</label>
              <input
                type="time"
                value={m.to_time}
                onChange={e => updateMachine(idx, 'to_time', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">BREAKDOWN (min)</label>
              <input
                type="number"
                value={m.breakdown_min || ''}
                onChange={e => updateMachine(idx, 'breakdown_min', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-kanoz-border text-sm focus:outline-none focus:ring-2 focus:ring-kanoz-green"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-kanoz-text-tertiary mb-1">PROD. HOURS</label>
              <div className="px-3 py-2 rounded-lg bg-kanoz-green-light/20 border border-kanoz-green-light text-sm font-bold text-kanoz-green">
                {m.production_hours || 0} hrs
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
